import { getSession } from "./session";
import { getTenantContext } from "../tenant/context";

export async function requireAuthenticatedUser() {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED: User is not authenticated");
  }
  return session;
}

export async function requireTenantContext() {
  // getTenantContext already verifies authentication and tenant membership internally
  const context = await getTenantContext();
  if (!context || !context.tenantId) {
    throw new Error("FORBIDDEN: Missing or invalid tenant context");
  }
  return context;
}

import { db } from "../../prisma/db";
import { getModel } from "../db/legacy-adapter";

export async function requirePermission(permissionKey: string) {
  const context = await requireTenantContext();

  const TenantMember = getModel(db, "TenantMember");
  if (!TenantMember) {
    throw new Error("FORBIDDEN: Membership service unavailable");
  }
  const member = await TenantMember.findUnique({
    where: { user_id_tenant_id: { user_id: context.userId, tenant_id: context.tenantId } },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!member || member.status !== "ACTIVE") {
    throw new Error("FORBIDDEN: Missing or inactive tenant membership");
  }

  let hasPermission = false;
  let isOwner = false;

  for (const memberRole of member.roles) {
    if (memberRole.role.status !== "ACTIVE") continue;
    if (memberRole.role.code === "OWNER") isOwner = true;
    for (const rp of memberRole.role.permissions) {
      if (rp.permission.key === permissionKey) {
        hasPermission = true;
        break;
      }
    }
    if (hasPermission) break;
  }

  // As per legacy safety and explicit prompt requirement, OWNER bypasses specific permission checks
  // or we can just ensure OWNER has all permissions. But treating OWNER explicitly is safer.
  if (!hasPermission && !isOwner) {
    throw new Error(`FORBIDDEN: Requires permission ${permissionKey}`);
  }

  return true;
}

export async function checkPermissionForUI(permissionKey: string): Promise<boolean> {
  try {
    await requirePermission(permissionKey);
    return true;
  } catch {
    return false;
  }
}

export async function getAllUserPermissions(): Promise<{ isOwner: boolean, permissions: string[] }> {
  try {
    const context = await requireTenantContext();
    const currentDb = (await import("../../prisma/db")).db;
    const TenantMember = getModel(currentDb, "TenantMember");
    if (!TenantMember) {
      return { isOwner: false, permissions: [] };
    }
    const member = await TenantMember.findUnique({
      where: { user_id_tenant_id: { user_id: context.userId, tenant_id: context.tenantId } },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } }
            }
          }
        }
      }
    });

    if (!member || member.status !== "ACTIVE") {
      return { isOwner: false, permissions: [] };
    }

    let isOwner = false;
    const perms = new Set<string>();

    for (const memberRole of member.roles) {
      if (memberRole.role.status !== "ACTIVE") continue;
      if (memberRole.role.code === "OWNER") isOwner = true;
      for (const rp of memberRole.role.permissions) {
        perms.add(rp.permission.key);
      }
    }

    return { isOwner, permissions: Array.from(perms) };
  } catch {
    return { isOwner: false, permissions: [] };
  }
}
