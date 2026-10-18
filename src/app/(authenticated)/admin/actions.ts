/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { requirePermission } from "../../../lib/auth/boundary";
import { getTenantDb } from "../../../lib/db/tenant-db";
import { logAudit } from "../../../lib/audit/logger";
import { getTenantContext } from "../../../lib/tenant/context";
import { db } from "../../../prisma/db"; // Root DB used selectively for operations that modify Tenant directly
import { getModel } from "../../../lib/db/legacy-adapter";

// Actions use granular permissions instead of global ensureAdmin.

// --- ORGANIZATION ---
export async function updateOrganization(formData: FormData) {
  await requirePermission("organization.update");
  const context = await getTenantContext();

  const { runTransaction } = await import("../../../lib/db/legacy-adapter");
  const { logAuditTx } = await import("../../../lib/audit/logger");

  const { isTenantSuspended, getTenantRestrictions } = await import("../../../lib/platform/tenant-service");
  if (await isTenantSuspended(context.tenantId)) {
    throw new Error("FORBIDDEN: Tenant account is suspended. Organization updates are prohibited.");
  }
  const restrictions = await getTenantRestrictions(context.tenantId);
  if (restrictions.is_administrative_restricted) {
    throw new Error("FORBIDDEN: Tenant account is locked under administrative restriction. Organization updates are prohibited.");
  }
  if (restrictions.is_security_restricted) {
    throw new Error("FORBIDDEN: Tenant account is locked under security isolation. Organization updates are prohibited.");
  }

  await runTransaction(db, async (tx: any) => {
    const Tenant = getModel(tx, "Tenant");
    if (!Tenant) throw new Error("Tenant model not available");

    const now = new Date();
    // 1. Acquire row lock
    await Tenant.update({
      where: { id: context.tenantId },
      data: { updated_at: now },
    });

    // 2. Read authoritative state under lock (with legacy schema fallback)
    let currentTenant: any = null;
    let hasIncrement2Columns = true;
    try {
      currentTenant = await Tenant.findUnique({
        where: { id: context.tenantId },
        select: {
          id: true,
          version: true,
          lifecycle_status: true,
          is_security_restricted: true,
          is_policy_restricted: true,
          is_billing_restricted: true,
          is_administrative_restricted: true,
        },
      });
    } catch {
      hasIncrement2Columns = false;
      currentTenant = await Tenant.findUnique({
        where: { id: context.tenantId },
        select: {
          id: true,
          name: true,
        },
      });
    }
    if (!currentTenant) throw new Error("Tenant not found");

    const currentVersion = (hasIncrement2Columns && typeof currentTenant.version === "number") ? currentTenant.version : 1;
    const targetVersion = hasIncrement2Columns ? currentVersion + 1 : currentVersion;

    // 3. Mutate organization profile fields and increment version if column exists
    const updateData: any = {
      name: formData.get("name") as string,
      legal_name: formData.get("legal_name") as string,
      registration_number: formData.get("registration_number") as string,
      gstin: formData.get("gstin") as string,
      pan: formData.get("pan") as string,
      website: formData.get("website") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      address: formData.get("address") as string,
      city: formData.get("city") as string,
      state: formData.get("state") as string,
      country: formData.get("country") as string,
      postal_code: formData.get("postal_code") as string,
      timezone: (formData.get("timezone") as string) || "UTC",
      updated_at: now,
    };
    if (hasIncrement2Columns) {
      updateData.version = targetVersion;
    }

    await Tenant.update({
      where: { id: context.tenantId },
      data: updateData,
    });

    // 4. Atomically record Class B audit log with fromVersion and toVersion
    await logAuditTx(tx, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: "TENANT_UPDATE",
      entity: "Tenant",
      entityId: context.tenantId,
      details: {
        fromVersion: currentVersion,
        toVersion: targetVersion,
        actionClass: "CLASS_B",
        updatedFields: [
          "name", "legal_name", "registration_number", "gstin", "pan",
          "website", "email", "phone", "address", "city", "state", "country", "postal_code", "timezone"
        ],
        source: "RUNTIME",
      },
    });
  });
}

// --- BUSINESS UNITS ---
export async function createBusinessUnit(data: any) {
  await requirePermission("business_unit.create");
  const tenantDb = await getTenantDb();

  const bu = await tenantDb.BusinessUnit.create({
    data: {
      name: data.name,
      code: data.code,
      description: data.description,
      status: data.status || "ACTIVE"
    }
  });

  await logAudit("CREATE", "BusinessUnit", bu.id);
  return { success: true, id: bu.id };
}

export async function updateBusinessUnit(id: string, data: any) {
  await requirePermission("business_unit.update");
  const tenantDb = await getTenantDb();

  await tenantDb.BusinessUnit.update({
    where: { id },
    data
  });

  await logAudit("UPDATE", "BusinessUnit", id);
  return { success: true };
}

// --- BRANCHES ---
export async function createBranch(data: any) {
  await requirePermission("branch.create");
  const tenantDb = await getTenantDb();

  // Validate BU belongs to tenant happens automatically if we try to connect it,
  // but to be absolutely sure, we can check via tenantDb:
  await tenantDb.BusinessUnit.findUniqueOrThrow({ where: { id: data.business_unit_id }});

  const branch = await tenantDb.Branch.create({
    data: {
      name: data.name,
      code: data.code,
      business_unit_id: data.business_unit_id,
      address: data.address,
      city: data.city,
      state: data.state,
      country: data.country,
      postal_code: data.postal_code,
      phone: data.phone,
      email: data.email,
      status: data.status || "ACTIVE"
    }
  });

  await logAudit("CREATE", "Branch", branch.id);
  return { success: true, id: branch.id };
}

export async function updateBranch(id: string, data: any) {
  await requirePermission("branch.update");
  const tenantDb = await getTenantDb();

  if (data.business_unit_id) {
    await tenantDb.BusinessUnit.findUniqueOrThrow({ where: { id: data.business_unit_id }});
  }

  await tenantDb.Branch.update({
    where: { id },
    data
  });

  await logAudit("UPDATE", "Branch", id);
  return { success: true };
}

// --- DEPARTMENTS ---
export async function createDepartment(data: any) {
  await requirePermission("department.create");
  const tenantDb = await getTenantDb();

  await tenantDb.Branch.findUniqueOrThrow({ where: { id: data.branch_id }});

  if (data.manager_id) {
     // Verify manager belongs to tenant
     const TenantMember = getModel(db, "TenantMember");
     const membership = TenantMember
       ? await TenantMember.findFirst({
           where: { user_id: data.manager_id, tenant_id: (await getTenantContext()).tenantId }
         })
       : null;
     if (!membership) throw new Error("Manager must belong to this tenant");
  }

  const dept = await tenantDb.Department.create({
    data: {
      name: data.name,
      code: data.code,
      branch_id: data.branch_id,
      description: data.description,
      manager_id: data.manager_id,
      status: data.status || "ACTIVE"
    }
  });

  await logAudit("CREATE", "Department", dept.id);
  return { success: true, id: dept.id };
}

import crypto from "crypto";

// --- USERS & MEMBERSHIPS ---
export async function inviteUser(data: any) {
  await requirePermission("user.create");
  const context = await getTenantContext();
  const tenantDb = await getTenantDb();

  const User = getModel(db, "User");
  const TenantMember = getModel(db, "TenantMember");
  if (!User || !TenantMember) throw new Error("Database models unavailable");

  const normalizedEmail = (data.email || "").trim().toLowerCase();
  const user = await User.findUnique({ where: { email: normalizedEmail } });

  if (user) {
    const existingMembership = await TenantMember.findUnique({
      where: { user_id_tenant_id: { user_id: user.id, tenant_id: context.tenantId } }
    });
    if (existingMembership) {
      throw new Error("User is already a member of this tenant.");
    }
  }

  // Generate a random token
  const token = crypto.randomBytes(32).toString("hex");
  const token_hash = crypto.createHash("sha256").update(token).digest("hex");

  // Expires in 7 days
  const expires_at = new Date();
  expires_at.setDate(expires_at.getDate() + 7);

  const invitation = await tenantDb.Invitation.create({
    data: {
      email: normalizedEmail,
      token_hash,
      invited_by: context.userId,
      role: data.role || "MEMBER",
      employee_code: data.employee_code,
      department_id: data.department_id,
      branch_id: data.branch_id,
      expires_at
    }
  });

  await logAudit("CREATE", "Invitation", invitation.id);

  // In development, return the token so it can be used in the UI.
  // In production, this would be emailed instead.
  return { success: true, invitationId: invitation.id, token };
}
