/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "../../prisma/db";
import { SYSTEM_PERMISSIONS } from "../auth/permissions";
import { SYSTEM_ROLE_TEMPLATES } from "../auth/roles";
import { getModel, runTransaction } from "../../lib/db/legacy-adapter";

// Seed the global permissions catalog. Safe to run repeatedly.
export async function seedGlobalPermissions() {
  const Permission = getModel(db, "Permission");

  for (const perm of SYSTEM_PERMISSIONS) {
    await Permission.upsert({
      where: { key: perm.key },
      update: {
        resource: perm.resource,
        action: perm.action,
        description: perm.description
      },
      create: perm
    });
  }
}

// Bootstrap a completely new tenant with OWNER and templates
export async function bootstrapTenant(
  tenantName: string,
  creator: { id: string } | { name: string; email: string; password_hash: string }
) {
  // Ensure global permissions are seeded first (in a real system this might run at startup,
  // but it's safe to run here idempotently just in case).
  await seedGlobalPermissions();

  return await runTransaction(db, async (tx: any) => {
    // 0. Resolve or create user atomically inside the transaction
    let creatorId = (creator as any).id;
    let createdUser: any = null;

    if (!creatorId) {
      const User = getModel(tx, "User");
      createdUser = await User.create({
        data: {
          name: (creator as any).name,
          email: (creator as any).email,
          password_hash: (creator as any).password_hash,
          status: "ACTIVE",
        },
      });
      creatorId = createdUser.id;
    }

    // 1. Create Tenant with Canonical Increment 2 Defaults (with legacy fallback)
    const Tenant = getModel(tx, "Tenant");
    let tenant: any = null;
    try {
      tenant = await Tenant.create({
        data: {
          name: tenantName,
          version: 1,
          lifecycle_status: "ACTIVE",
          is_security_restricted: false,
          is_policy_restricted: false,
          is_billing_restricted: false,
          is_administrative_restricted: false,
        }
      });
    } catch {
      // Legacy schema fallback when Increment 2 columns are absent from database
      tenant = await Tenant.create({
        data: {
          name: tenantName,
        }
      });
    }

    // 2. Fetch all global permissions for mapping
    const Permission = getModel(tx, "Permission");
    const allPermissions = await Permission.findMany();
    const permMap = new Map(allPermissions.map((p: any) => [p.key, p.id]));

    // 3. Create Default Roles & RolePermissions
    let ownerRoleId = null;
    const Role = getModel(tx, "Role");
    const RolePermission = getModel(tx, "RolePermission");

    for (const template of SYSTEM_ROLE_TEMPLATES) {
      const role = await Role.create({
        data: {
          tenant_id: tenant.id,
          code: template.code,
          name: template.name,
          description: template.description,
          status: "ACTIVE"
        }
      });

      if (template.code === "OWNER") {
        ownerRoleId = role.id;
      }

      // Determine which permissions to assign (deduplicated; exclude platform admin permissions)
      const rawKeys = template.permissions.includes("*")
        ? allPermissions.filter((p: any) => !p.key.startsWith("platform.")).map((p: any) => p.key)
        : template.permissions;
      const keysToAssign = Array.from(new Set(rawKeys));

      for (const key of keysToAssign) {
        const permId = permMap.get(key);
        if (permId) {
          await RolePermission.create({
            data: {
              tenant_id: tenant.id,
              role_id: role.id,
              permission_id: permId
            }
          });
        }
      }
    }

    if (!ownerRoleId) {
      throw new Error("Bootstrap failed: OWNER role template is missing");
    }

    // 4. Create TenantMember for creator
    const TenantMember = getModel(tx, "TenantMember");
    const member = await TenantMember.create({
      data: {
        user_id: creatorId,
        tenant_id: tenant.id,
        role: "OWNER", // Legacy fundamental string flag
        status: "ACTIVE"
      }
    });

    // 5. Assign OWNER role via MemberRole
    const MemberRole = getModel(tx, "MemberRole");
    await MemberRole.create({
      data: {
        tenant_id: tenant.id,
        member_id: member.id,
        role_id: ownerRoleId
      }
    });

    // 6. Audit log for bootstrap
    const AuditLog = getModel(tx, "AuditLog");
    await AuditLog.create({
      data: {
        tenant_id: tenant.id,
        action: "CREATE",
        entity: "TenantBootstrap",
        user_id: creatorId,
        details: JSON.stringify({ message: "Tenant initialized with system role templates" })
      }
    });

    if (createdUser) {
      (tenant as any).creatorUser = createdUser;
    }

    return tenant;
  });
}
