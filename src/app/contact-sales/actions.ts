"use server";

import { checkRateLimit, isDuplicateSubmission, persistSalesEnquiry } from "../../lib/sales/enquiry-store";
import { headers } from "next/headers";

export interface ContactSalesState {
  success?: boolean;
  enquiryId?: string;
  error?: string;
  fields?: Record<string, string>;
}

export async function submitContactSalesAction(
  prevState: ContactSalesState | null,
  formData: FormData
): Promise<ContactSalesState> {
  const name = formData.get("name");
  const email = formData.get("email");
  const organization = formData.get("organization");
  const phone = formData.get("phone");
  const userCount = formData.get("userCount");
  const message = formData.get("message");
  const modules = formData.getAll("modules");

  const fields = {
    name: typeof name === "string" ? name : "",
    email: typeof email === "string" ? email : "",
    organization: typeof organization === "string" ? organization : "",
    phone: typeof phone === "string" ? phone : "",
    userCount: typeof userCount === "string" ? userCount : "10-50",
    message: typeof message === "string" ? message : "",
  };

  // Basic validation
  if (!fields.name || fields.name.trim().length < 2) {
    return { error: "Please provide your full name (minimum 2 characters).", fields };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!fields.email || !emailRegex.test(fields.email.trim())) {
    return { error: "Please enter a valid work email address.", fields };
  }

  if (!fields.organization || fields.organization.trim().length < 2) {
    return { error: "Please provide your organization name.", fields };
  }

  // Duplicate submission check
  const duplicateKey = `${fields.email.trim().toLowerCase()}-${fields.organization.trim().toLowerCase()}`;
  if (isDuplicateSubmission(duplicateKey, 15000)) {
    return {
      error: "A submission with these details was recently received. Please allow our team time to respond.",
      fields,
    };
  }

  // Rate limiting / abuse prevention
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown-ip";
  const rateLimitKey = `${ip}-${fields.email.trim().toLowerCase()}`;

  if (!checkRateLimit(rateLimitKey, 4, 60000)) {
    return {
      error: "Too many requests. Please wait a minute before submitting again.",
      fields,
    };
  }

  try {
    const saved = await persistSalesEnquiry({
      name: fields.name.trim(),
      email: fields.email.trim().toLowerCase(),
      organization: fields.organization.trim(),
      phone: fields.phone.trim() || undefined,
      userCount: fields.userCount,
      modules: modules.map((m) => String(m)),
      message: fields.message.trim() || undefined,
      ipAddress: ip,
    });

    return {
      success: true,
      enquiryId: saved.referenceNumber || saved.id,
    };
  } catch {
    return {
      error: "Unable to submit your enquiry at this moment. Please try again shortly or reach out to support.",
      fields,
    };
  }
}
