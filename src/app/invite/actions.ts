/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "../../prisma/db";
import { hashPassword, verifyPassword } from "../../lib/auth/password";
import { encrypt } from "../../lib/auth/jwt";
import { getSession } from "../../lib/auth/session";
import { getModel, runTransaction } from "../../lib/db/legacy-adapter";

export async function acceptInvitation(
  invitationId: string,
  token: string,
  newPassword?: string,
  name?: string
) {
  const token_hash = crypto.createHash("sha256").update(token).digest("hex");

  // Transaction to update invitation and user/membership atomically
  return await runTransaction(db, async (tx: any) => {
    const txInvitation = getModel(tx, "Invitation");
    const txUser = getModel(tx, "User");
    const txTenantMember = getModel(tx, "TenantMember");

    // 1. Atomically find and lock/check invitation inside the transaction
    const invitation = await txInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new Error("Invalid invitation.");
    }

    if (invitation.status !== "PENDING") {
      throw new Error("Invitation is already used or cancelled.");
    }

    if (new Date() > new Date(invitation.expires_at)) {
      await txInvitation.update({
        where: { id: invitationId },
        data: { status: "EXPIRED" },
      });
      throw new Error("Invitation has expired.");
    }

    if (token_hash !== invitation.token_hash) {
      throw new Error("Invalid token.");
    }

    // 2. Mark invitation accepted atomically
    await txInvitation.update({
      where: { id: invitationId },
      data: {
        status: "ACCEPTED",
        accepted_at: new Date(),
      },
    });

    const normalizedEmail = (invitation.email || "").trim().toLowerCase();

    let user = await txUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      if (!newPassword || !name) {
        throw new Error("Name and password are required for new users.");
      }
      const hashed = await hashPassword(newPassword);
      user = await txUser.create({
        data: {
          email: normalizedEmail,
          name,
          password_hash: hashed,
          status: "ACTIVE",
        },
      });
    }

    // Existing users don't have their password overwritten

    // 3. Create TenantMember if not already existing
    const existingMembership = await txTenantMember.findUnique({
      where: {
        user_id_tenant_id: {
          user_id: user.id,
          tenant_id: invitation.tenant_id,
        },
      },
    });

    if (!existingMembership) {
      await txTenantMember.create({
        data: {
          user_id: user.id,
          tenant_id: invitation.tenant_id,
          role: invitation.role,
          employee_code: invitation.employee_code,
          department_id: invitation.department_id,
          branch_id: invitation.branch_id,
          status: "ACTIVE",
        },
      });
    }

    return {
      success: true,
      userId: user.id,
      tenantId: invitation.tenant_id,
      email: normalizedEmail,
    };
  });
}

export async function getInvitationDetails(token: string) {
  if (!token || typeof token !== "string") {
    return { error: "Invalid invitation link." };
  }

  const token_hash = crypto.createHash("sha256").update(token).digest("hex");
  const Invitation = getModel(db, "Invitation");

  let invitation = null;
  try {
    invitation = await Invitation.findFirst({
      where: { token_hash },
    });
  } catch {
    return { error: "Invalid invitation link." };
  }

  if (!invitation) {
    return { error: "Invalid invitation link." };
  }

  if (invitation.status === "ACCEPTED") {
    return {
      error: "This invitation has already been accepted.",
      isAccepted: true,
    };
  }

  if (invitation.status === "EXPIRED" || new Date() > new Date(invitation.expires_at)) {
    return {
      error: "This invitation has expired.",
      isExpired: true,
    };
  }

  let tenantName = invitation.tenant?.name;
  if (!tenantName && invitation.tenant_id) {
    try {
      const Tenant = getModel(db, "Tenant");
      const tenant = await Tenant.findUnique({
        where: { id: invitation.tenant_id },
        select: { id: true, name: true },
      });
      tenantName = tenant?.name;
    } catch {
      // Ignore if tenant fetch fails
    }
  }

  const normalizedEmail = (invitation.email || "").trim().toLowerCase();

  // Check if user already exists
  let existingUser = null;
  try {
    const User = getModel(db, "User");
    existingUser = await User.findUnique({
      where: { email: normalizedEmail },
    });
  } catch {
    // Ignore error
  }

  // Check current session
  let session = null;
  try {
    session = await getSession();
  } catch {
    session = null;
  }

  const isAuthenticatedAsInvitee =
    !!session && session.email?.trim().toLowerCase() === normalizedEmail;
  const isAuthenticatedAsOther =
    !!session && session.email?.trim().toLowerCase() !== normalizedEmail;

  return {
    success: true,
    invitation: {
      id: invitation.id,
      email: normalizedEmail,
      role: invitation.role,
      tenantName: tenantName || "the organization",
      isExistingUser: !!existingUser,
      userName: existingUser?.name || "",
      isAuthenticatedAsInvitee,
      isAuthenticatedAsOther,
      currentSessionEmail: session?.email || null,
    },
  };
}

export async function acceptInvitationAction(
  token: string,
  prevState: any,
  formData: FormData
) {
  if (!token || typeof token !== "string") {
    return { error: "Invalid token" };
  }

  const token_hash = crypto.createHash("sha256").update(token).digest("hex");
  const Invitation = getModel(db, "Invitation");

  const invitation = await Invitation.findFirst({
    where: { token_hash },
  });

  if (!invitation) {
    return { error: "Invalid invitation link" };
  }

  const normalizedEmail = (invitation.email || "").trim().toLowerCase();

  const User = getModel(db, "User");
  const existingUser = await User.findUnique({
    where: { email: normalizedEmail },
  });

  // Verify active session against invitation email to prevent identity confusion
  const session = await getSession();
  if (session && session.email?.trim().toLowerCase() !== normalizedEmail) {
    return {
      error: `You are currently signed in as ${session.email}. This invitation was sent to ${normalizedEmail}. Please sign out or switch accounts to accept.`,
    };
  }

  const name = formData.get("name") as string | null;
  const password = formData.get("password") as string | null;

  if (existingUser) {
    // If not authenticated as the invited user, password verification is required
    // to prevent zero-knowledge account takeover via stolen or intercepted invite tokens.
    if (!session || session.email?.trim().toLowerCase() !== normalizedEmail) {
      if (!password) {
        return { error: "Please enter your account password to accept this invitation." };
      }
      const valid = await verifyPassword(password, existingUser.password_hash || "");
      if (!valid) {
        return { error: "Invalid account password. Please try again." };
      }
    }
  } else {
    // New user requires name and password
    if (!name || name.trim().length < 2) {
      return { error: "Please provide a valid full name (minimum 2 characters)" };
    }
    if (!password || password.length < 8) {
      return { error: "Password must be at least 8 characters long" };
    }
  }

  let result: any;
  try {
    result = await acceptInvitation(
      invitation.id,
      token,
      password || undefined,
      name ? name.trim() : undefined
    );
  } catch (err: any) {
    return { error: err.message || "Failed to accept invitation" };
  }

  // Create session and set cookies
  const sessionData = { userId: result.userId, email: result.email };
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const sessionToken = await encrypt(sessionData);

  const cookieStore = await cookies();
  cookieStore.set("session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires,
    sameSite: "lax",
    path: "/",
  });

  cookieStore.set("active_tenant_id", result.tenantId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires,
    sameSite: "lax",
    path: "/",
  });

  redirect("/");
}
