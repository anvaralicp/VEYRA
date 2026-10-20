"use server";

import { revalidatePath } from "next/cache";
import {
  suspendTenant,
  reactivateTenant,
  inviteTenantAdmin,
  revokeTenantAdminInvitation,
} from "../../lib/platform/tenant-service";
import { requirePlatformAdmin } from "../../lib/auth/platform";

function handleActionError(error: any): never {
  const msg = String(error?.message || "");
  if (msg.includes("CONFLICT") || msg.includes("STALE_DATA")) {
    throw new Error("CONFLICT: STALE_DATA: The tenant record was updated by another administrator. Please refresh the page and try again.");
  }
  if (
    msg.startsWith("UNAUTHORIZED") ||
    msg.startsWith("FORBIDDEN") ||
    msg.startsWith("SERVICE_UNAVAILABLE") ||
    msg.startsWith("Invalid") ||
    msg.includes("must be between") ||
    msg.includes("already on plan") ||
    msg.includes("already suspended") ||
    msg.includes("not currently suspended") ||
    msg.includes("already active") ||
    msg.includes("already disabled")
  ) {
    throw error;
  }
  console.error("[PlatformAdminActionError]", error);
  throw new Error("An unexpected error occurred while executing the platform action. Please try again.");
}

export async function suspendTenantAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const tenantId = formData.get("tenantId") as string;
  const reason = formData.get("reason") as string;

  if (!tenantId) {
    throw new Error("Tenant ID is required.");
  }

  try {
    await suspendTenant(tenantId, reason);
    revalidatePath(`/platform-admin/tenants/${tenantId}`);
    revalidatePath("/platform-admin/tenants");
    revalidatePath("/platform-admin");
  } catch (err: any) {
    handleActionError(err);
  }
}

export async function reactivateTenantAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const tenantId = formData.get("tenantId") as string;

  if (!tenantId) {
    throw new Error("Tenant ID is required.");
  }

  try {
    await reactivateTenant(tenantId);
    revalidatePath(`/platform-admin/tenants/${tenantId}`);
    revalidatePath("/platform-admin/tenants");
    revalidatePath("/platform-admin");
  } catch (err: any) {
    handleActionError(err);
  }
}

export async function inviteTenantAdminAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const tenantId = formData.get("tenantId") as string;
  const email = formData.get("email") as string;
  const role = (formData.get("role") as string) || "ADMIN";

  if (!tenantId || !email) {
    throw new Error("Tenant ID and destination email are required.");
  }

  try {
    await inviteTenantAdmin(tenantId, {
      email,
      role: role === "OWNER" ? "OWNER" : "ADMIN",
    });

    revalidatePath(`/platform-admin/tenants/${tenantId}`);
    revalidatePath("/platform-admin/invitations");
  } catch (err: any) {
    handleActionError(err);
  }
}

export async function revokeTenantAdminInvitationAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const invitationId = formData.get("invitationId") as string;
  const tenantId = formData.get("tenantId") as string;

  if (!invitationId) {
    throw new Error("Invitation ID is required.");
  }

  try {
    await revokeTenantAdminInvitation(invitationId);
    if (tenantId) {
      revalidatePath(`/platform-admin/tenants/${tenantId}`);
    }
    revalidatePath("/platform-admin/invitations");
  } catch (err: any) {
    handleActionError(err);
  }
}

import type { SalesEnquiryStatus } from "../../lib/platform/sales-service";

export async function updateSalesEnquiryStatusAction(formData: FormData): Promise<void> {
  const enquiryId = formData.get("enquiryId") as string;
  const status = formData.get("status") as SalesEnquiryStatus;
  const reason = (formData.get("reason") as string) || undefined;

  if (!enquiryId || !status) {
    throw new Error("Enquiry ID and target status are required.");
  }

  try {
    const { updateSalesEnquiryStatus } = await import("../../lib/platform/sales-service");
    await updateSalesEnquiryStatus(enquiryId, status, reason);
    revalidatePath("/platform-admin/sales");
    revalidatePath("/platform-admin");
  } catch (err: any) {
    handleActionError(err);
  }
}

import type { TenantRestrictionType } from "../../lib/platform/tenant-service";
import { requirePlatformPermission } from "../../lib/auth/platform";

export async function updateTenantRestrictionAction(formData: FormData): Promise<void> {
  await requirePlatformPermission("platform.tenant.restrict");
  const tenantId = formData.get("tenantId") as string;
  const restrictionType = formData.get("restrictionType") as TenantRestrictionType;
  const enable = formData.get("enable") === "true";
  const reason = formData.get("reason") as string;

  if (!tenantId || !restrictionType) {
    throw new Error("Tenant ID and restriction type are required.");
  }

  try {
    const { updateTenantRestriction } = await import("../../lib/platform/tenant-service");
    await updateTenantRestriction(tenantId, restrictionType, enable, reason);
    revalidatePath(`/platform-admin/tenants/${tenantId}`);
    revalidatePath("/platform-admin/tenants");
    revalidatePath("/platform-admin");
  } catch (err: any) {
    handleActionError(err);
  }
}

export async function updateTenantPlanAction(formData: FormData): Promise<void> {
  await requirePlatformPermission("platform.subscription.manage");
  const tenantId = formData.get("tenantId") as string;
  const planId = formData.get("planId") as string;
  const reason = formData.get("reason") as string;

  if (!tenantId || !planId) {
    throw new Error("Tenant ID and plan identifier are required.");
  }

  try {
    const { updateTenantSubscriptionPlan } = await import("../../lib/platform/tenant-service");
    await updateTenantSubscriptionPlan(tenantId, planId, reason);
    revalidatePath(`/platform-admin/tenants/${tenantId}`);
    revalidatePath("/platform-admin/tenants");
    revalidatePath("/platform-admin/financials");
    revalidatePath("/platform-admin");
  } catch (err: any) {
    handleActionError(err);
  }
}

export async function extendTenantTrialAction(formData: FormData): Promise<void> {
  await requirePlatformPermission("platform.subscription.manage");
  const tenantId = formData.get("tenantId") as string;
  const daysStr = formData.get("days") as string;
  const reason = formData.get("reason") as string;

  const days = parseInt(daysStr, 10);
  if (!tenantId || isNaN(days)) {
    throw new Error("Tenant ID and valid extension days are required.");
  }

  try {
    const { extendTenantTrial } = await import("../../lib/platform/tenant-service");
    await extendTenantTrial(tenantId, days, reason);
    revalidatePath(`/platform-admin/tenants/${tenantId}`);
    revalidatePath("/platform-admin/tenants");
    revalidatePath("/platform-admin/financials");
    revalidatePath("/platform-admin");
  } catch (err: any) {
    handleActionError(err);
  }
}

