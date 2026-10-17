"use server";

import { cookies } from "next/headers";
import { getSession } from "../../lib/auth/session";
import { db } from "../../prisma/db";
import { getModel } from "../../lib/db/legacy-adapter";
import { redirect } from "next/navigation";

export async function switchTenantAction(tenantId: string) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (!tenantId || typeof tenantId !== "string") {
    throw new Error("Invalid tenant ID");
  }

  // Authorize: Verify that the user is an ACTIVE member of the requested tenant
  const TenantMember = getModel(db, "TenantMember");
  if (!TenantMember) {
    throw new Error("Membership service unavailable");
  }

  const membership = await TenantMember.findUnique({
    where: {
      user_id_tenant_id: {
        user_id: session.userId,
        tenant_id: tenantId,
      },
    },
    select: {
      user_id: true,
      tenant_id: true,
      role: true,
      status: true,
    },
  });

  if (!membership || (membership.status && membership.status !== "ACTIVE")) {
    throw new Error("FORBIDDEN: User is not an active member of this organization");
  }

  const { isTenantSuspended } = await import("../../lib/platform/tenant-service");
  if (await isTenantSuspended(tenantId)) {
    throw new Error("FORBIDDEN: Tenant account is suspended. Please contact platform administration.");
  }

  // Set the active_tenant_id cookie
  const cookieStore = await cookies();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  cookieStore.set("active_tenant_id", tenantId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });

  redirect("/");
}
