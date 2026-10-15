/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "../../prisma/db";
import { hashPassword } from "../../lib/auth/password";
import { encrypt } from "../../lib/auth/jwt";
import { bootstrapTenant } from "../../lib/tenant/bootstrap";
import { getModel } from "../../lib/db/legacy-adapter";

export async function registerAction(prevState: any, formData: FormData) {
  const organizationName = formData.get("organizationName");
  const name = formData.get("name");
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof organizationName !== "string" ||
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return { error: "All fields are required and must be valid strings." };
  }

  const trimmedOrg = organizationName.trim();
  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();

  if (trimmedOrg.length < 2) {
    return { error: "Organization name must be at least 2 characters." };
  }

  if (trimmedName.length < 2) {
    return { error: "Full name must be at least 2 characters." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { error: "Please enter a valid email address." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }

  const User = getModel(db, "User");

  let existingUser = null;
  try {
    existingUser = await User.findUnique({
      where: { email: trimmedEmail },
    });
  } catch {
    // If error checking user, proceed or fail safely
  }

  if (existingUser) {
    return {
      error: "An account with this email already exists. Please log in to continue.",
    };
  }

  let user: any;
  let tenant: any;

  try {
    const hashedPassword = await hashPassword(password);
    tenant = await bootstrapTenant(trimmedOrg, {
      name: trimmedName,
      email: trimmedEmail,
      password_hash: hashedPassword,
    });
    user = tenant.creatorUser || { id: tenant.creator_id, email: trimmedEmail };
  } catch (err: any) {
    const isEmailCollision =
      err?.constraint === "User_email_key" ||
      err?.message?.includes("User_email_key") ||
      (err?.table === "User" && (err?.message?.includes("email") || err?.detail?.includes("email"))) ||
      (err?.message?.toLowerCase().includes("user") && err?.message?.toLowerCase().includes("email"));

    if (isEmailCollision) {
      return {
        error: "An account with this email already exists. Please log in to continue.",
      };
    }
    return {
      error: err?.message || "Failed to complete registration. Please try again.",
    };
  }

  // Create session and set cookies
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

  cookieStore.set("active_tenant_id", tenant.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires,
    sameSite: "lax",
    path: "/",
  });

  redirect("/");
}
