/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "../../prisma/db";
import { getModel } from "../db/legacy-adapter";
import { requirePlatformPermission } from "../auth/platform";

export type SalesEnquiryStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "CLOSED";

export interface PlatformSalesEnquirySummary {
  id: string;
  referenceNumber: string;
  contactName: string;
  email: string;
  company: string;
  phone: string | null;
  userCount: string;
  modules: string[];
  message: string | null;
  status: SalesEnquiryStatus;
  createdAt: string;
  matchedTenant: {
    id: string;
    name: string;
  } | null;
}

export interface PlatformSalesMetrics {
  total: number;
  newCount: number;
  contactedCount: number;
  qualifiedCount: number;
  closedCount: number;
  convertedCount: number;
  conversionRatePct: number;
}

export interface PlatformSalesFilterOptions {
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Normalizes text keys by trimming leading/trailing whitespace,
 * collapsing internal consecutive whitespace, and lowercasing.
 */
export function normalizeStringKey(str?: string | null): string {
  if (!str) return "";
  return str.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * List of overly generic, non-unique company names that should never
 * be used as the sole basis for an enquiry-to-tenant conversion match.
 */
export const AMBIGUOUS_COMPANY_NAMES = new Set([
  "test",
  "demo",
  "sample",
  "admin",
  "company",
  "organization",
  "agency",
  "enterprise",
  "business",
  "services",
  "solutions",
  "technologies",
  "tech",
  "global",
  "consulting",
  "holdings",
  "group",
  "llc",
  "inc",
  "corp",
  "ltd",
  "pvt ltd",
]);

export interface TenantLookupCandidate {
  id: string;
  name: string;
  email: string | null;
}

/**
 * Resolves whether an enquiry can be safely and unambiguously matched to an existing tenant.
 *
 * Rules:
 * 1. Exact normalized email matches are preferred first.
 *    - If exactly one tenant matches the enquiry email, that tenant is returned.
 *    - If multiple tenants match the enquiry email, matching is ambiguous -> returns null.
 * 2. If no email match exists, matching by company name is evaluated with strict safeguards:
 *    - Normalized company name must be at least 4 characters.
 *    - Normalized company name must not be in AMBIGUOUS_COMPANY_NAMES.
 *    - Exactly one tenant must have this normalized company name (if multiple exist -> ambiguous, returns null).
 *    - If the tenant has an email and enquiry has an email, their email domains must not conflict.
 * 3. Never mutates tenant records, creates duplicates, or alters ownership.
 */
export function matchEnquiryToTenant(
  enquiry: { email?: string | null; company?: string | null },
  tenantsByEmail: Map<string, TenantLookupCandidate[]>,
  tenantsByName: Map<string, TenantLookupCandidate[]>
): { id: string; name: string } | null {
  const normEmail = normalizeStringKey(enquiry.email);
  const normCompany = normalizeStringKey(enquiry.company);

  // 1. Prefer exact normalized email match
  if (normEmail && normEmail.includes("@")) {
    const emailMatches = tenantsByEmail.get(normEmail);
    if (emailMatches && emailMatches.length > 0) {
      // Ambiguous email match across multiple tenants -> return unlinked
      if (emailMatches.length > 1) {
        return null;
      }
      const singleMatch = emailMatches[0];
      return { id: singleMatch.id, name: singleMatch.name };
    }
  }

  // 2. Company name match with strict safeguards if no email match exists
  if (normCompany) {
    // Reject short names (<= 3 characters) and common generic placeholders
    if (normCompany.length <= 3 || AMBIGUOUS_COMPANY_NAMES.has(normCompany)) {
      return null;
    }

    const nameMatches = tenantsByName.get(normCompany);
    if (!nameMatches || nameMatches.length === 0) {
      return null;
    }

    // Duplicate company names across multiple tenants -> ambiguous, return unlinked
    if (nameMatches.length > 1) {
      return null;
    }

    const candidate = nameMatches[0];

    // Reject conflicting email domains if both tenant and enquiry provide emails
    if (candidate.email && normEmail && normEmail.includes("@")) {
      const candidateEmail = normalizeStringKey(candidate.email);
      if (candidateEmail.includes("@")) {
        const candidateDomain = candidateEmail.split("@")[1];
        const enquiryDomain = normEmail.split("@")[1];
        if (candidateDomain && enquiryDomain && candidateDomain !== enquiryDomain) {
          return null; // Conflicting email domain
        }
      }
    }

    return { id: candidate.id, name: candidate.name };
  }

  return null;
}

/**
 * Retrieves sales enquiries with status filtering, date range filtering,
 * and tenant conversion cross-referencing.
 * Fail-closed: Requires platform.sales.view authorization.
 */
export async function getPlatformSalesEnquiries(
  options: PlatformSalesFilterOptions = {},
  client: any = db
): Promise<{
  enquiries: PlatformSalesEnquirySummary[];
  metrics: PlatformSalesMetrics;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  await requirePlatformPermission("platform.sales.view");

  const SalesEnquiryModel = getModel(client, "SalesEnquiry");
  if (!SalesEnquiryModel || typeof SalesEnquiryModel.findMany !== "function") {
    throw new Error("SERVICE_UNAVAILABLE: Sales enquiry storage service is unavailable");
  }

  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, Math.min(100, options.pageSize || 15));
  const skip = (page - 1) * pageSize;

  let allEnquiries: any[] = [];
  try {
    allEnquiries = await SalesEnquiryModel.findMany({
      select: {
        id: true,
        reference_number: true,
        contact_name: true,
        email: true,
        company: true,
        phone: true,
        user_count: true,
        modules: true,
        message: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });
  } catch (err: any) {
    throw new Error(`SERVICE_UNAVAILABLE: Failed to query sales enquiries: ${err?.message || "Storage error"}`);
  }

  if (!Array.isArray(allEnquiries)) {
    throw new Error("SERVICE_UNAVAILABLE: Invalid sales enquiry response from storage");
  }

  // Cross-reference existing tenants to detect conversions without querying private tenant data
  const TenantModel = getModel(client, "Tenant");
  let existingTenants: Array<{ id: string; name: string; email: string | null }> = [];
  if (TenantModel && typeof TenantModel.findMany === "function") {
    try {
      existingTenants = await TenantModel.findMany({
        select: {
          id: true,
          name: true,
          email: true,
        },
      });
    } catch {
      existingTenants = [];
    }
  }

  // Index tenants by normalized email and company name
  const tenantsByEmail = new Map<string, TenantLookupCandidate[]>();
  const tenantsByName = new Map<string, TenantLookupCandidate[]>();

  for (const t of existingTenants) {
    const normEmail = normalizeStringKey(t.email);
    if (normEmail && normEmail.includes("@")) {
      const list = tenantsByEmail.get(normEmail) || [];
      list.push(t);
      tenantsByEmail.set(normEmail, list);
    }

    const normName = normalizeStringKey(t.name);
    if (normName) {
      const list = tenantsByName.get(normName) || [];
      list.push(t);
      tenantsByName.set(normName, list);
    }
  }

  // Compute overall aggregate pipeline metrics across all enquiries
  let newCount = 0;
  let contactedCount = 0;
  let qualifiedCount = 0;
  let closedCount = 0;
  let convertedCount = 0;

  const processedAll: PlatformSalesEnquirySummary[] = allEnquiries.map((e: any) => {
    const status = (e.status as SalesEnquiryStatus) || "NEW";
    if (status === "NEW") newCount++;
    else if (status === "CONTACTED") contactedCount++;
    else if (status === "QUALIFIED") qualifiedCount++;
    else if (status === "CLOSED") closedCount++;

    // Unambiguously match existing tenant (email prioritized, common/ambiguous company names rejected)
    const matchedTenant = matchEnquiryToTenant(
      { email: e.email, company: e.company },
      tenantsByEmail,
      tenantsByName
    );

    if (matchedTenant) {
      convertedCount++;
    }

    let parsedModules: string[] = [];
    if (typeof e.modules === "string") {
      try {
        parsedModules = JSON.parse(e.modules);
      } catch {
        parsedModules = [];
      }
    } else if (Array.isArray(e.modules)) {
      parsedModules = e.modules;
    }

    return {
      id: e.id,
      referenceNumber: e.reference_number || `ENQ-${e.id.slice(0, 8)}`,
      contactName: e.contact_name || "Unknown Contact",
      email: e.email || "No email",
      company: e.company || "Unnamed Organization",
      phone: e.phone || null,
      userCount: e.user_count || "10-50",
      modules: parsedModules,
      message: e.message || null,
      status,
      createdAt: e.created_at ? new Date(e.created_at).toISOString() : new Date().toISOString(),
      matchedTenant,
    };
  });

  const total = processedAll.length;
  const conversionRatePct = total > 0 ? Math.round((convertedCount / total) * 100) : 0;

  const metrics: PlatformSalesMetrics = {
    total,
    newCount,
    contactedCount,
    qualifiedCount,
    closedCount,
    convertedCount,
    conversionRatePct,
  };

  // Filter in memory for search, status, and dates
  let filtered = processedAll;

  if (options.status && options.status !== "ALL") {
    filtered = filtered.filter((e) => e.status === options.status);
  }

  if (options.search && options.search.trim()) {
    const q = options.search.trim().toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.referenceNumber.toLowerCase().includes(q) ||
        e.contactName.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.company.toLowerCase().includes(q)
    );
  }

  if (options.startDate) {
    const startMs = new Date(options.startDate).getTime();
    if (!isNaN(startMs)) {
      filtered = filtered.filter((e) => new Date(e.createdAt).getTime() >= startMs);
    }
  }

  if (options.endDate) {
    const endMs = new Date(options.endDate).getTime();
    if (!isNaN(endMs)) {
      // Include the entire end day
      filtered = filtered.filter((e) => new Date(e.createdAt).getTime() <= endMs + 86400000);
    }
  }

  const filteredTotal = filtered.length;
  const totalPages = Math.ceil(filteredTotal / pageSize) || 1;
  const paginated = filtered.slice(skip, skip + pageSize);

  return {
    enquiries: paginated,
    metrics,
    total: filteredTotal,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Updates the qualification lifecycle status of a sales enquiry with auditing.
 * Fail-closed: Requires platform.sales.manage authorization.
 */
export async function updateSalesEnquiryStatus(
  enquiryId: string,
  newStatus: SalesEnquiryStatus,
  reason?: string,
  client: any = db
): Promise<{ success: boolean; previousStatus: string; newStatus: string }> {
  const session = await requirePlatformPermission("platform.sales.manage");

  if (!enquiryId || typeof enquiryId !== "string") {
    throw new Error("Enquiry ID is required.");
  }

  const validStatuses: SalesEnquiryStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "CLOSED"];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid sales enquiry status: '${newStatus}'. Permitted: ${validStatuses.join(", ")}`);
  }

  const SalesEnquiryModel = getModel(client, "SalesEnquiry");
  if (!SalesEnquiryModel || typeof SalesEnquiryModel.findUnique !== "function" || typeof SalesEnquiryModel.update !== "function") {
    throw new Error("SERVICE_UNAVAILABLE: Sales enquiry storage service is unavailable");
  }

  const existing = await SalesEnquiryModel.findUnique({
    where: { id: enquiryId },
    select: {
      id: true,
      reference_number: true,
      email: true,
      company: true,
      status: true,
    },
  });

  if (!existing) {
    throw new Error("Sales enquiry not found.");
  }

  const previousStatus = existing.status || "NEW";

  await SalesEnquiryModel.update({
    where: { id: enquiryId },
    data: {
      status: newStatus,
    },
  });

  // Record platform audit log without exposing PII
  const AuditLog = getModel(client, "AuditLog");
  const Tenant = getModel(client, "Tenant");

  // Attempt to link to matched tenant, or fallback to first available tenant to satisfy schema FK limitation
  let auditTenantId: string | null = null;
  if (Tenant && typeof Tenant.findMany === "function") {
    try {
      const allTenants = await Tenant.findMany({
        select: { id: true, name: true, email: true },
      });
      const tByEmail = new Map<string, TenantLookupCandidate[]>();
      const tByName = new Map<string, TenantLookupCandidate[]>();
      for (const t of allTenants) {
        const normEmail = normalizeStringKey(t.email);
        if (normEmail && normEmail.includes("@")) {
          const list = tByEmail.get(normEmail) || [];
          list.push(t);
          tByEmail.set(normEmail, list);
        }
        const normName = normalizeStringKey(t.name);
        if (normName) {
          const list = tByName.get(normName) || [];
          list.push(t);
          tByName.set(normName, list);
        }
      }
      const match = matchEnquiryToTenant(
        { email: existing.email, company: existing.company },
        tByEmail,
        tByName
      );
      if (match) {
        auditTenantId = match.id;
      } else {
        const fallbackTenant = allTenants[0];
        if (fallbackTenant) auditTenantId = fallbackTenant.id;
      }
    } catch {
      auditTenantId = null;
    }
  }

  if (auditTenantId && AuditLog && typeof AuditLog.create === "function") {
    try {
      await AuditLog.create({
        data: {
          tenant_id: auditTenantId,
          action: "SALES_ENQUIRY_STATUS_UPDATE",
          entity: "SalesEnquiry",
          entity_id: existing.id,
          user_id: session.userId,
          details: JSON.stringify({
            actorEmail: session.email,
            referenceNumber: existing.reference_number,
            company: existing.company,
            fromStatus: previousStatus,
            toStatus: newStatus,
            reason: reason ? reason.trim().slice(0, 200) : "Status updated by platform operator",
          }),
        },
      });
    } catch (auditErr) {
      console.warn("[PlatformSales] Could not record AuditLog for enquiry update:", auditErr);
    }
  }

  return {
    success: true,
    previousStatus,
    newStatus,
  };
}
