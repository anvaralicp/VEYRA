/* eslint-disable @typescript-eslint/no-explicit-any */
import { cache } from "react";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "../auth/session";
import { db } from "../../prisma/db";
import { getModel } from "../db/legacy-adapter";

export interface TenantContext {
  tenantId: string;
  userId: string;
  role: string;
}

// Determines the tenant context based on the authenticated session
// and the requested tenant (from headers, cookies, or database membership).
// It VERIFIES that the user is actually an ACTIVE member of the requested tenant.
export const getTenantContext = cache(async (): Promise<TenantContext> => {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED: Missing session");
  }

  const headersList = await headers();
  const cookieStore = await cookies();

  // The client may provide a candidate tenant hint via header (from middleware) or active_tenant_id cookie
  const requestedTenantId = headersList.get("x-tenant-id") || cookieStore.get("active_tenant_id")?.value;

  const TenantMember = getModel(db, "TenantMember");

  // If a specific tenant was requested as a hint:
  if (requestedTenantId) {
    if (!TenantMember || typeof TenantMember.findUnique !== "function") {
      throw new Error("SERVICE_UNAVAILABLE: Membership service is unavailable");
    }

    let membership: any;
    try {
      membership = await TenantMember.findUnique({
        where: {
          user_id_tenant_id: {
            user_id: session.userId,
            tenant_id: requestedTenantId,
          },
        },
        select: {
          user_id: true,
          tenant_id: true,
          role: true,
          status: true,
        },
      });
    } catch (error: any) {
      if (error?.message?.startsWith("SERVICE_UNAVAILABLE") || error?.message?.startsWith("FORBIDDEN")) {
        throw error;
      }
      throw new Error("SERVICE_UNAVAILABLE: Failed to verify tenant membership");
    }

    if (!membership || (membership.status && membership.status !== "ACTIVE")) {
      throw new Error("FORBIDDEN: User is not a member of this tenant");
    }

    const { isTenantSuspended } = await import("../platform/tenant-service");
    if (await isTenantSuspended(membership.tenant_id)) {
      throw new Error("FORBIDDEN: Tenant account is suspended. Please contact platform administration.");
    }

    return {
      tenantId: membership.tenant_id,
      userId: membership.user_id,
      role: membership.role,
    };
  }

  // If no tenant hint was supplied, query active memberships to resolve safely
  if (!TenantMember || typeof TenantMember.findMany !== "function") {
    throw new Error("SERVICE_UNAVAILABLE: Membership service is unavailable");
  }

  let activeMemberships: any[];
  try {
    activeMemberships = await TenantMember.findMany({
      where: {
        user_id: session.userId,
        status: "ACTIVE",
      },
      select: {
        user_id: true,
        tenant_id: true,
        role: true,
        status: true,
      },
    });
  } catch (error: any) {
    if (error?.message?.startsWith("SERVICE_UNAVAILABLE") || error?.message?.startsWith("FORBIDDEN")) {
      throw error;
    }
    throw new Error("SERVICE_UNAVAILABLE: Failed to query tenant memberships");
  }

  if (!Array.isArray(activeMemberships)) {
    throw new Error("SERVICE_UNAVAILABLE: Invalid membership data returned");
  }

  // User has exactly 1 active membership: resolve it automatically
  if (activeMemberships.length === 1) {
    const single = activeMemberships[0];
    const { isTenantSuspended } = await import("../platform/tenant-service");
    if (await isTenantSuspended(single.tenant_id)) {
      throw new Error("FORBIDDEN: Tenant account is suspended. Please contact platform administration.");
    }
    return {
      tenantId: single.tenant_id,
      userId: single.user_id,
      role: single.role,
    };
  }

  // User has multiple active memberships: prompt safe selection
  if (activeMemberships.length > 1) {
    redirect("/select-tenant");
  }

  // User has 0 active memberships legitimately
  throw new Error("FORBIDDEN: User has no active tenant membership");
});
