
import { db } from "../src/prisma/db";
import { hashPassword } from "../src/lib/auth/password";
import { bootstrapTenant } from "../src/lib/tenant/bootstrap";
import { adaptPrisma7 } from "../src/lib/db/legacy-adapter";

interface DatabaseClient {
    orm?: {
        public?: Record<string, unknown>;
    };
    [key: string]: unknown;
}

interface ModelRecord {
    id: string;
    [key: string]: unknown;
}

interface LegacyPrismaModel {
    findFirst: (args?: { where?: Record<string, unknown> }) => Promise<ModelRecord | null>;
    findUnique: (args?: { where?: Record<string, unknown> }) => Promise<ModelRecord | null>;
    create: (args: { data: Record<string, unknown> }) => Promise<ModelRecord>;
    [key: string]: unknown;
}

function getModel(client: DatabaseClient | unknown, modelName: string): LegacyPrismaModel {
    const c = client as DatabaseClient;
    const rawModel =
        c?.orm?.public?.[modelName] ||
        c?.orm?.public?.[
            modelName.charAt(0).toUpperCase() + modelName.slice(1)
        ] ||
        c?.[modelName] ||
        c?.[
            modelName.charAt(0).toLowerCase() + modelName.slice(1)
        ];

    return adaptPrisma7(rawModel) as LegacyPrismaModel;
}

async function main() {
    const dbUrl = process.env.DATABASE_URL || "";

    // 1. Fail-closed production safeguard via URL parsing
    try {
        const parsedUrl = new URL(dbUrl);

        if (
            parsedUrl.protocol !== "postgres:" &&
            parsedUrl.protocol !== "postgresql:"
        ) {
            throw new Error(
                "DATABASE_URL protocol must be postgresql."
            );
        }

        if (
            parsedUrl.hostname !== "localhost" &&
            parsedUrl.hostname !== "127.0.0.1"
        ) {
            throw new Error(
                `Hostname is '${parsedUrl.hostname}', expected 'localhost' or '127.0.0.1'.`
            );
        }

        const dbName = parsedUrl.pathname.replace(/^\//, "");

        if (dbName !== "veyra") {
            throw new Error(
                `Database name is '${dbName}', expected 'veyra'.`
            );
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
            `Refusing to run. Target database cannot be verified as local development: ${msg}`
        );
    }

    const email = "admin@veyra.local";

    const User = getModel(db, "User");
    const Tenant = getModel(db, "Tenant");

    try {
        console.log("Verifying database connection...");

        // Harmless read-only query to verify connectivity and initialization
        await User.findFirst({
            where: { email: "healthcheck@veyra.local" }
        });

        console.log("✓ Database connection successful.");
    } catch (err: unknown) {
        throw new Error(
            "Database connection or initialization failed.\nOperation: Harmless read-only query (healthcheck)",
            { cause: err }
        );
    }

    console.log(`Checking for development user (${email})...`);

    let user = await User.findUnique({ where: { email } });

    // 2. Create the development user only when it does not exist
    if (!user) {
        const devPassword = process.env.VEYRA_DEV_PASSWORD;

        if (!devPassword || devPassword.length < 12) {
            throw new Error(
                "Set VEYRA_DEV_PASSWORD to a development password of at least 12 characters."
            );
        }

        const password_hash = await hashPassword(devPassword);

        user = await User.create({
            data: {
                email,
                password_hash,
                name: "Local Dev Admin",
                status: "ACTIVE"
            }
        });

        console.log("✅ Created new development user.");
        console.log(`   Email: ${email}`);
        console.log("   Password: supplied securely through VEYRA_DEV_PASSWORD.");
    } else {
        console.log(`✅ Found existing user: ${email}`);
        console.log(
            "   (Password remains unchanged. Use your application's password-reset process if needed.)"
        );
    }

    const tenantName = "Local Dev Tenant";

    let tenant = await Tenant.findFirst({
        where: { name: tenantName }
    });

    // 3. Safe tenant and membership orchestration
    if (!tenant) {
        console.log(`Bootstrapping new tenant '${tenantName}'...`);

        tenant = await bootstrapTenant(tenantName, { id: user.id });

        console.log(
            "✅ Bootstrapped new tenant and automatically assigned OWNER role."
        );
    } else {
        const existingTenant = tenant;
        console.log(
            `✅ Found existing tenant '${tenantName}'. Verifying formal membership...`
        );

        // 4. Supported transaction API
        const runTx = db.transaction.bind(db);

        await runTx(async (tx: unknown) => {
            const TenantMember = getModel(tx, "TenantMember");
            const Role = getModel(tx, "Role");
            const MemberRole = getModel(tx, "MemberRole");

            let member = await TenantMember.findFirst({
                where: {
                    tenant_id: existingTenant.id,
                    user_id: user.id
                }
            });

            if (!member) {
                member = await TenantMember.create({
                    data: {
                        user_id: user.id,
                        tenant_id: existingTenant.id,
                        role: "OWNER",
                        status: "ACTIVE"
                    }
                });

                console.log("✅ Added user as a formal TenantMember.");
            }

            const ownerRole = await Role.findFirst({
                where: {
                    tenant_id: existingTenant.id,
                    code: "OWNER"
                }
            });

            // Stop safely if the required OWNER role is missing
            if (!ownerRole) {
                throw new Error(
                    `Tenant '${tenantName}' exists but the system 'OWNER' role is missing. Cannot safely assign OWNER permissions.`
                );
            }

            const memberRole = await MemberRole.findFirst({
                where: {
                    tenant_id: existingTenant.id,
                    member_id: member.id,
                    role_id: ownerRole.id
                }
            });

            if (!memberRole) {
                await MemberRole.create({
                    data: {
                        tenant_id: existingTenant.id,
                        member_id: member.id,
                        role_id: ownerRole.id
                    }
                });

                console.log("✅ Mapped formal OWNER role to user.");
            } else {
                console.log("✅ User already holds formal OWNER mapping.");
            }
        });
    }

    // Reached only if setup completes without an error
    console.log(
        "\nSetup verified cleanly. You can log in at http://localhost:3000/login"
    );
}

main()
    .catch((error: unknown) => {
        // 5. Hard failure propagation
        const errObj = error as { message?: string; cause?: unknown; code?: string; errors?: unknown[] } | null;
        const msg = error instanceof Error ? error.message : errObj?.message || String(error);
        console.error(
            "\n❌ Fatal Error during local setup:",
            msg
        );

        let currentCause: unknown = errObj?.cause;
        let depth = 1;

        while (currentCause && depth <= 3) {
            const causeObj = currentCause as {
                message?: string;
                code?: string;
                cause?: unknown;
                errors?: unknown[];
            };
            console.error(
                `   [Cause ${depth}]: ${
                    causeObj.message ||
                    causeObj.code ||
                    String(currentCause)
                }`
            );

            currentCause =
                causeObj.cause || causeObj.errors?.[0];

            depth++;
        }

        process.exitCode = 1;
    })
    .finally(async () => {
        // 6. Protected teardown to avoid masking the original error
        try {
            const closeableDb = db as unknown as {
                close?: () => Promise<void>;
                $disconnect?: () => Promise<void>;
            };
            if ("close" in db && typeof closeableDb.close === "function") {
                await closeableDb.close();
            } else if ("$disconnect" in db && typeof closeableDb.$disconnect === "function") {
                await closeableDb.$disconnect();
            }
        } catch (cleanupError) {
            console.error(
                "\n⚠️ Warning: Failed to close database connection cleanly:",
                cleanupError
            );
        }
    });
