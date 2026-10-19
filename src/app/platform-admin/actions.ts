"use server";

import { revalidatePath } from "next/cache";
import {
  suspendTenant,
  reactivateTenant,
  inviteTenantAdmin,
  revokeTenantAdminInvitation,
} from "../../lib/platform/tenant-service";
import { requirePlatformAdmin } from "../../lib/auth/platform";

export async function suspendTenantAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const tenantId = formData.get("tenantId") as string;
  const reason = formData.get("reason") as string;

  if (!tenantId) {
    throw new Error("Tenant ID is required.");
  }

  await suspendTenant(tenantId, reason);
  revalidatePath(`/platform-admin/tenants/${tenantId}`);
  revalidatePath("/platform-admin/tenants");
  revalidatePath("/platform-admin");
}

export async function reactivateTenantAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const tenantId = formData.get("tenantId") as string;

  if (!tenantId) {
    throw new Error("Tenant ID is required.");
  }

  await reactivateTenant(tenantId);
  revalidatePath(`/platform-admin/tenants/${tenantId}`);
  revalidatePath("/platform-admin/tenants");
  revalidatePath("/platform-admin");
}

export async function inviteTenantAdminAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const tenantId = formData.get("tenantId") as string;
  const email = formData.get("email") as string;
  const role = (formData.get("role") as string) || "ADMIN";

  if (!tenantId || !email) {
    throw new Error("Tenant ID and destination email are required.");
  }

  await inviteTenantAdmin(tenantId, {
    email,
    role: role === "OWNER" ? "OWNER" : "ADMIN",
  });

  revalidatePath(`/platform-admin/tenants/${tenantId}`);
  revalidatePath("/platform-admin/invitations");
}

export async function revokeTenantAdminInvitationAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const invitationId = formData.get("invitationId") as string;
  const tenantId = formData.get("tenantId") as string;

  if (!invitationId) {
    throw new Error("Invitation ID is required.");
  }

  await revokeTenantAdminInvitation(invitationId);
  if (tenantId) {
    revalidatePath(`/platform-admin/tenants/${tenantId}`);
  }
  revalidatePath("/platform-admin/invitations");
}

import type { SalesEnquiryStatus } from "../../lib/platform/sales-service";

export async function updateSalesEnquiryStatusAction(formData: FormData): Promise<void> {
  const enquiryId = formData.get("enquiryId") as string;
  const status = formData.get("status") as SalesEnquiryStatus;
  const reason = (formData.get("reason") as string) || undefined;

  if (!enquiryId || !status) {
    throw new Error("Enquiry ID and target status are required.");
  }

  const { updateSalesEnquiryStatus } = await import("../../lib/platform/sales-service");
  await updateSalesEnquiryStatus(enquiryId, status, reason);
  revalidatePath("/platform-admin/sales");
  revalidatePath("/platform-admin");
}

