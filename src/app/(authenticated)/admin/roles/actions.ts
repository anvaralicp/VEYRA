/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { requirePermission } from "../../../../lib/auth/boundary";
import { getTenantDb } from "../../../../lib/db/tenant-db";
import { logAudit } from "../../../../lib/audit/logger";
import { db } from "../../../../prisma/db";
import { getModel } from "../../../../lib/db/legacy-adapter";

// -- ROLE ADMINISTRATION --
export async function createRole(data: any) {
  await requirePermission("role.create");
  const tenantDb = await getTenantDb();

  const role = await tenantDb.Role.create({
    data: {
      name: data.name,
      code: data.code,
      description: data.description,
      status: "ACTIVE"
    }
  });

  await logAudit("CREATE", "Role", role.id);
  return { success: true, id: role.id };
}

export async function updateRole(id: string, data: any) {
  await requirePermission("role.update");
  const tenantDb = await getTenantDb();

  // Safety: Cannot deactivate the final OWNER role
  if (data.status === "INACTIVE") {
    const role = await tenantDb.Role.findUnique({ where: { id } });
    if (role && role.code === "OWNER") {
      // Check if there are other active OWNER roles
      const activeOwners = await tenantDb.Role.count({
        where: { code: "OWNER", status: "ACTIVE", id: { not: id } }
      });
      if (activeOwners === 0) {
        throw new Error("Cannot deactivate the final OWNER role");
      }
    }
  }

  await tenantDb.Role.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      status: data.status
    }
  });

  await logAudit("UPDATE", "Role", id);
  return { success: true };
}

// -- PERMISSION ASSIGNMENT --
export async function assignPermissionsToRole(roleId: string, permissionKeys: string[]) {
  await requirePermission("role.assign_permission");
  const tenantDb = await getTenantDb();

  // Enforce strict separation: Tenant roles can never be assigned platform permissions
  if (permissionKeys.some((k) => k.startsWith("platform."))) {
    throw new Error("FORBIDDEN: Platform permissions cannot be assigned to tenant roles.");
  }

  // Validate that the target role belongs to the current tenant
  const role = await tenantDb.Role.findUnique({
    where: { id: roleId },
  });
  if (!role) {
    throw new Error("Record not found in the current tenant.");
  }

  // Verify permissions exist globally and are strictly tenant permissions
  const Permission = getModel(db, "Permission");
  const validPerms = Permission
    ? await Permission.findMany({
        where: {
          key: {
            in: permissionKeys.filter((k) => !k.startsWith("platform.")),
          },
        },
      })
    : [];

  await tenantDb.transaction(async (tx: any) => {
    // Clear existing permissions for this role within the tenant
    await (tx.RolePermission || tx.rolePermission).deleteMany({
      where: { role_id: roleId },
    });

    // Create new role permissions scoped to current tenant
    for (const p of validPerms) {
      await (tx.RolePermission || tx.rolePermission).create({
        data: {
          role_id: roleId,
          permission_id: p.id,
        },
      });
    }
  });

  await logAudit("UPDATE", "RolePermissions", roleId);
  return { success: true };
}

// -- USER ROLE ASSIGNMENT --
export async function assignRolesToUser(memberId: string, roleIds: string[]) {
  await requirePermission("role.assign_user"); // Or user.update
  const tenantDb = await getTenantDb();

  // Validate that the target TenantMember belongs to the current tenant
  const targetMember = await tenantDb.TenantMember.findUnique({
    where: { id: memberId },
  });
  if (!targetMember) {
    throw new Error("Record not found in the current tenant.");
  }

  // Validate that all assigned roles belong to the current tenant
  if (roleIds.length > 0) {
    const roles = await tenantDb.Role.findMany({
      where: { id: { in: roleIds } },
    });
    if (roles.length !== roleIds.length) {
      throw new Error("One or more roles do not exist in the current tenant.");
    }
  }

  // Safety: Cannot remove the final active OWNER from the tenant
  const rolesBeingRemoved = await tenantDb.MemberRole.findMany({
    where: { member_id: memberId, role_id: { notIn: roleIds } },
    include: { role: true },
  });

  for (const mr of rolesBeingRemoved) {
    if (mr.role?.code === "OWNER") {
      // Count other active owners in the tenant
      const otherOwners = await tenantDb.MemberRole.count({
        where: {
          member_id: { not: memberId },
          role: { code: "OWNER", status: "ACTIVE" },
        },
      });
      if (otherOwners === 0) {
        throw new Error("Cannot remove the final OWNER role from the final owner.");
      }
    }
  }

  await tenantDb.transaction(async (tx: any) => {
    await (tx.MemberRole || tx.memberRole).deleteMany({
      where: { member_id: memberId },
    });

    for (const rid of roleIds) {
      await (tx.MemberRole || tx.memberRole).create({
        data: {
          member_id: memberId,
          role_id: rid,
        },
      });
    }
  });

  await logAudit("UPDATE", "UserRoles", memberId);
  return { success: true };
}
