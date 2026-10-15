/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { cookies } from "next/headers";
import { encrypt } from "../../lib/auth/jwt";
import { verifyPassword } from "../../lib/auth/password";
import { db } from "../../prisma/db";
import { getModel } from "../../lib/db/legacy-adapter";
import { redirect } from "next/navigation";

export async function loginAction(prevState: any, formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Invalid input format" };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const User = getModel(db, "User");
  const user = User
    ? await User.findUnique({
        where: { email: normalizedEmail },
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
    const TenantMember = getModel(db, "TenantMember");
    if (TenantMember && typeof TenantMember.findMany === "function") {
      const memberships = await TenantMember.findMany({
        where: { user_id: user.id, status: "ACTIVE" },
      });

      if (Array.isArray(memberships)) {
        if (memberships.length === 1) {
          cookieStore.set("active_tenant_id", memberships[0].tenant_id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            expires,
            sameSite: "lax",
            path: "/",
          });
          redirect("/");
          return;
        } else if (memberships.length > 1) {
          redirect("/select-tenant");
          return;
        }
      }
    }
  } catch (err: any) {
    if (err?.message?.includes("NEXT_REDIRECT") || err?.digest?.includes("NEXT_REDIRECT")) {
      throw err;
    }
  }

  redirect("/");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  cookieStore.delete("active_tenant_id");
  redirect("/login");
}
