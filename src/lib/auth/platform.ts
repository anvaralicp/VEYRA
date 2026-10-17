import { getSession } from "./session";
import { PLATFORM_PERMISSIONS } from "./permissions";

export interface PlatformAdminUser {
  userId: string;
  email: string;
  isPlatformAdmin: true;
}

/**
 * Returns the set of normalized emails authorized as Platform Administrators.
 * Sourced from PLATFORM_ADMIN_EMAILS environment variable (comma-separated).
 */
export function getPlatformAdminEmails(): Set<string> {
  const envEmails = process.env.PLATFORM_ADMIN_EMAILS;
  const emails = new Set<string>();

  if (envEmails) {
    for (const email of envEmails.split(",")) {
      const trimmed = email.trim().toLowerCase();
      if (trimmed) emails.add(trimmed);
    }
  }

  // Fallback for development/testing environments only
  if (emails.size === 0 && (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")) {
    emails.add("platform-admin@veyra.io");
    emails.add("ops@veyra.io");
  }

  return emails;
}

/**
 * Checks whether a given user email is an authorized Platform Administrator.
 * If user is omitted, checks the current active session.
 */
export async function isPlatformAdmin(user?: { email?: string | null } | null): Promise<boolean> {
  const targetUser = user !== undefined ? user : await getSession();
  if (!targetUser || !targetUser.email) return false;
  const adminEmails = getPlatformAdminEmails();
  return adminEmails.has(targetUser.email.trim().toLowerCase());
}

/**
 * Returns the current authenticated platform user or null if not authenticated or not a platform admin.
 */
export async function getPlatformUser(): Promise<PlatformAdminUser | null> {
  const session = await getSession();
  if (!session || !session.email) return null;

  const isAdmin = await isPlatformAdmin(session);
  if (!isAdmin) return null;

  return {
    userId: session.userId,
    email: session.email,
    isPlatformAdmin: true,
  };
}

/**
 * Enforces server-side platform administrator authentication.
 * Throws UNAUTHORIZED if not authenticated, or FORBIDDEN if the user is not a platform administrator.
 */
export async function requirePlatformAdmin(): Promise<PlatformAdminUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED: Platform administration requires an active session");
  }

  const isAdmin = await isPlatformAdmin(session);
  if (!isAdmin) {
    throw new Error("FORBIDDEN: User does not have platform administrator privileges");
  }

  return {
    userId: session.userId,
    email: session.email,
    isPlatformAdmin: true,
  };
}

/**
 * Validates that the caller is a platform administrator authorized for a specific platform permission.
 * Deny-by-default: only defined platform.* permissions can be validated.
 */
export async function requirePlatformPermission(permissionKey: string): Promise<PlatformAdminUser> {
  const platformAdmin = await requirePlatformAdmin();

  // Validate that permissionKey is an exact registered platform permission
  const validPlatformPerm = PLATFORM_PERMISSIONS.some((p) => p.key === permissionKey);
  if (!validPlatformPerm) {
    throw new Error(`FORBIDDEN: Invalid or unassigned platform permission '${permissionKey}'`);
  }

  return platformAdmin;
}
