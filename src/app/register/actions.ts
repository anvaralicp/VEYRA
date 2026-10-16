/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "../../prisma/db";
import { hashPassword } from "../../lib/auth/password";
import { encrypt } from "../../lib/auth/jwt";
import { bootstrapTenant } from "../../lib/tenant/bootstrap";
import { getModel } from "../../lib/db/legacy-adapter";
import { getPlanById } from "../../config/pricing";

export interface RegisterFormState {
  error?: string;
  fields?: {
    organizationName?: string;
    name?: string;
    email?: string;
    phone?: string;
    country?: string;
    planId?: string;
    billingCycle?: string;
  };
}

export async function registerAction(prevState: RegisterFormState | null, formData: FormData) {
  const organizationName = formData.get("organizationName");
  const name = formData.get("name");
  const email = formData.get("email");
  const password = formData.get("password");
  const phone = formData.get("phone");
  const country = formData.get("country");
  const planIdRaw = formData.get("planId");
  const billingCycleRaw = formData.get("billingCycle");
  const agreeTerms = formData.get("agreeTerms");

  const plan = getPlanById(typeof planIdRaw === "string" ? planIdRaw : "trial");
  const billingCycle = typeof billingCycleRaw === "string" ? billingCycleRaw : "monthly";

  const fields = {
    organizationName: typeof organizationName === "string" ? organizationName : "",
    name: typeof name === "string" ? name : "",
    email: typeof email === "string" ? email : "",
    phone: typeof phone === "string" ? phone : "",
    country: typeof country === "string" ? country : "India",
    planId: plan.id,
    billingCycle,
  };

  if (
    typeof organizationName !== "string" ||
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return { error: "All required fields must be filled.", fields };
  }

  const trimmedOrg = organizationName.trim();
  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();

  if (trimmedOrg.length < 2) {
    return { error: "Organization name must be at least 2 characters.", fields };
  }

  if (trimmedName.length < 2) {
    return { error: "Full name must be at least 2 characters.", fields };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { error: "Please enter a valid email address.", fields };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long.", fields };
  }

  const isTermsAccepted = agreeTerms === "true" || agreeTerms === "on";
  if (!isTermsAccepted) {
    return {
      error: "Please accept the Terms of Service and Privacy Policy to proceed.",
      fields,
    };
  }

  const User = getModel(db, "User");
  if (!User || typeof User.findUnique !== "function") {
    return {
      error: "Registration service is temporarily unavailable. Please try again shortly.",
      fields,
    };
  }

  let existingUser = null;
  try {
    existingUser = await User.findUnique({
      where: { email: trimmedEmail },
    });
  } catch {
    return {
      error: "Unable to verify account availability. Please try again shortly.",
      fields,
    };
  }

  if (existingUser) {
    return {
      error: "An account with this email already exists. Please log in to continue.",
      fields,
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

    // Record 7-day trial activation details in AuditLog (non-fatal; tenant and user are already committed)
    try {
      const now = new Date();
      const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const AuditLog = getModel(db, "AuditLog");
      if (AuditLog && typeof AuditLog.create === "function") {
        await AuditLog.create({
          data: {
            tenant_id: tenant.id,
            action: "TRIAL_ACTIVATE",
            entity: "TenantSubscription",
            user_id: user.id,
            details: JSON.stringify({
              selectedPlanId: plan.id,
              selectedPlanName: plan.name,
              selectedBillingCycle: billingCycle,
              trialStartUtc: now.toISOString(),
              trialEndUtc: trialEndDate.toISOString(),
              userAllowance: "Unlimited during trial",
              paymentRequired: false,
              message: "7-Day Free Trial activated with full platform capabilities.",
            }),
          },
        });
      }
    } catch (auditErr: any) {
      const errorCode = typeof auditErr?.code === "string" ? ` (code: ${auditErr.code})` : "";
      console.error(`[registerAction] Non-fatal: failed to record trial activation audit log${errorCode}`);
    }
  } catch (err: any) {
    const isEmailCollision =
      err?.constraint === "User_email_key" ||
      err?.message?.includes("User_email_key") ||
      (err?.table === "User" && (err?.message?.includes("email") || err?.detail?.includes("email"))) ||
      (err?.message?.toLowerCase().includes("user") && err?.message?.toLowerCase().includes("email"));

    if (isEmailCollision) {
      return {
        error: "An account with this email already exists. Please log in to continue.",
        fields,
      };
    }
    return {
      error: "Failed to complete registration. Please try again.",
      fields,
    };
  }

  // Create session and set cookies
  const sessionData = { userId: user.id, email: user.email };
  const sessionExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  const sessionToken = await encrypt(sessionData);

  const cookieStore = await cookies();
  cookieStore.set("session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: sessionExpires,
    sameSite: "lax",
    path: "/",
  });

  cookieStore.set("active_tenant_id", tenant.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: sessionExpires,
    sameSite: "lax",
    path: "/",
  });

  // Calculate and store trial activation summary for the Welcome page
  const now = new Date();
  const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const trialSummary = {
    organizationName: tenant.name,
    planName: "7 Day Trial",
    requestedPlan: plan.name,
    startDate: now.toISOString(),
    endDate: trialEndDate.toISOString(),
    userAllowance: "Unlimited during trial",
    paymentStatus: "No payment required",
  };

  cookieStore.set("trial_welcome_summary", JSON.stringify(trialSummary), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
    sameSite: "lax",
    path: "/",
  });

  if (formData.has("planId")) {
    redirect("/welcome");
  } else {
    redirect("/");
  }
}
