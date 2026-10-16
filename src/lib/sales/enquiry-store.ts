/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";
import { db } from "../../prisma/db";
import { getModel } from "../db/legacy-adapter";

export interface SalesEnquiry {
  id: string;
  referenceNumber: string;
  name: string;
  email: string;
  organization: string;
  phone?: string;
  userCount: string;
  modules: string[];
  message?: string;
  createdAt: string;
  ipAddress?: string;
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "CLOSED";
}

export type SalesEnquiryInput = Omit<SalesEnquiry, "id" | "referenceNumber" | "createdAt" | "status">;

// In-memory tracking for rate limiting & rapid duplicate submissions
const rateLimitMap = new Map<string, number[]>();
const duplicateSubmissionMap = new Map<string, number>();

export function checkRateLimit(identifier: string, limit = 5, windowMs = 60000): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(identifier) || [];
  const recent = timestamps.filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    return false;
  }
  recent.push(now);
  rateLimitMap.set(identifier, recent);
  return true;
}

export function isDuplicateSubmission(fingerprint: string, windowMs = 15000): boolean {
  const now = Date.now();
  const lastTime = duplicateSubmissionMap.get(fingerprint);
  if (lastTime && now - lastTime < windowMs) {
    return true;
  }
  duplicateSubmissionMap.set(fingerprint, now);
  return false;
}

export function clearRateLimits(): void {
  rateLimitMap.clear();
  duplicateSubmissionMap.clear();
}

export function generateReferenceNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ENQ-${timestamp}-${randomSuffix}`;
}

/**
 * Persists a sales enquiry directly to PostgreSQL with automatic reference-number
 * collision retries and sanitized logging without PII leakage.
 */
export async function persistSalesEnquiry(
  data: SalesEnquiryInput,
  options?: { client?: any; maxRetries?: number }
): Promise<SalesEnquiry> {
  const dbClient = options?.client || db;
  const SalesEnquiryModel = getModel(dbClient, "SalesEnquiry");

  if (!SalesEnquiryModel) {
    console.error("[SalesEnquiry] SalesEnquiry model is not available on database client");
    throw new Error("Persistence store unavailable");
  }

  const maxRetries = options?.maxRetries ?? 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    const refNum = generateReferenceNumber();

    try {
      const record = await SalesEnquiryModel.create({
        data: {
          reference_number: refNum,
          contact_name: data.name,
          email: data.email,
          company: data.organization,
          phone: data.phone || null,
          user_count: data.userCount || "10-50",
          modules: JSON.stringify(data.modules || []),
          message: data.message || null,
          ip_address: data.ipAddress || null,
          status: "NEW",
        },
      });

      if (!record) {
        throw new Error("No record confirmation returned from database");
      }

      const returnedRef = record.reference_number || refNum;
      console.info(`[SalesEnquiry] Successfully persisted enquiry with reference ${returnedRef}`);

      let parsedModules = data.modules;
      if (typeof record.modules === "string") {
        try {
          parsedModules = JSON.parse(record.modules);
        } catch {
          parsedModules = data.modules;
        }
      }

      return {
        id: record.id || returnedRef,
        referenceNumber: returnedRef,
        name: record.contact_name || data.name,
        email: record.email || data.email,
        organization: record.company || data.organization,
        phone: record.phone || data.phone,
        userCount: record.user_count || data.userCount,
        modules: parsedModules,
        message: record.message || data.message,
        createdAt: record.created_at ? new Date(record.created_at).toISOString() : new Date().toISOString(),
        status: (record.status as any) || "NEW",
      };
    } catch (err: any) {
      const isUniqueCollision =
        err?.code === "P2002" ||
        (typeof err?.message === "string" && (
          err.message.includes("reference_number") ||
          err.message.includes("unique constraint") ||
          err.message.includes("duplicate key")
        ));

      if (isUniqueCollision && attempt < maxRetries) {
        console.warn(`[SalesEnquiry] Collision on reference number ${refNum}, retrying (${attempt}/${maxRetries})...`);
        continue;
      }

      // Sanitized error logging: do not expose emails, phone numbers, or credentials
      console.error(
        `[SalesEnquiry] Failed to persist sales enquiry: ${err instanceof Error ? err.message : "Database write error"}`
      );
      throw new Error("Durable enquiry persistence failed");
    }
  }

  throw new Error("Failed to allocate a unique reference number after retries");
}
