/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { cookies } from "next/headers";
import { encrypt } from "../../lib/auth/jwt";
import { verifyPassword } from "../../lib/auth/password";
import { db } from "../../prisma/db";
import { getModel } from "../../lib/db/legacy-adapter";
import { redirect } from "next/navigation";
import { getSafeRedirectUrl, isPlatformAdminRoute } from "../../lib/auth/redirect";

export async function loginAction(prevState: any, formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");
  const rawRedirectTo = formData.get("redirectTo");
  let targetDestination = getSafeRedirectUrl(rawRedirectTo, "/");

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Invalid input format" };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const User = getModel(db, "User");
  const user = User
    ? await User.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          email: true,
          password_hash: true,
          status: true,
        },
      })
    : null;

  // To prevent timing attacks, we would ideally still hash/compare against a dummy password,
  // but for VEYRA foundation, just ensure we do not leak "User not found".
  let passwordValid = false;
  if (user && user.password_hash) {
    passwordValid = await verifyPassword(password, user.password_hash);
  } else {
    // Dummy verification to mitigate timing attacks on nonexistent emails
    await verifyPassword(password, "$2a$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
  }

  if (!user || !passwordValid) {
    return { error: "Invalid email or password" };
  }

  if (user.status !== "ACTIVE") {
    return { error: "Account deactivated" };
  }

  // Create session
  const sessionData = { userId: user.id, email: user.email };
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  const sessionToken = await encrypt(sessionData);

  const cookieStore = await cookies();
  cookieStore.set("session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires,
    sameSite: "lax",
    path: "/",
  });

  // Check active memberships to configure initial tenant context
  try {
    const { isPlatformAdmin } = await import("../../lib/auth/platform");
    const userIsAdmin = await isPlatformAdmin(user);
    const isTargetingPlatformAdmin = isPlatformAdminRoute(targetDestination);

    // If an ordinary user attempts to target platform administration, sanitize destination
    if (isTargetingPlatformAdmin && !userIsAdmin) {
      targetDestination = "/";
    }

    // Allowlisted platform administrator requesting platform console reaches it directly
    if (userIsAdmin && isTargetingPlatformAdmin) {
      redirect(targetDestination);
      return;
    }

    const TenantMember = getModel(db, "TenantMember");
    let memberships: any[] = [];
    if (TenantMember && typeof TenantMember.findMany === "function") {
      memberships = await TenantMember.findMany({
        where: { user_id: user.id, status: "ACTIVE" },
        select: { tenant_id: true, role: true },
      });
    }

    if (Array.isArray(memberships)) {
      if (memberships.length === 1) {
        const { isTenantSuspended } = await import("../../lib/platform/tenant-service");
        if (await isTenantSuspended(memberships[0].tenant_id)) {
          cookieStore.delete("session");
          cookieStore.delete("active_tenant_id");
          return { error: "Your organization account is suspended. Please contact platform administration." };
        }

        cookieStore.set("active_tenant_id", memberships[0].tenant_id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          expires,
          sameSite: "lax",
          path: "/",
        });
        redirect(targetDestination);
        return;
      } else if (memberships.length > 1) {
        redirect("/select-tenant");
        return;
      }
    }

    // If user is a platform administrator with no tenant memberships, direct to platform console
    if (userIsAdmin) {
      redirect("/platform-admin");
      return;
    }
  } catch (err: any) {
    if (err?.message?.includes("NEXT_REDIRECT") || err?.digest?.includes("NEXT_REDIRECT")) {
      throw err;
    }
    cookieStore.delete("session");
    cookieStore.delete("active_tenant_id");
    return { error: "Account verification failed. Please try again or contact support." };
  }

  redirect(targetDestination);
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  cookieStore.delete("active_tenant_id");
  redirect("/login");
}
