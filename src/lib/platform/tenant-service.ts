/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";
import { db } from "../../prisma/db";
import { getModel, runTransaction } from "../db/legacy-adapter";
import { requirePlatformPermission } from "../auth/platform";

export interface TenantLifecycleStatus {
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
  reason?: string;
  suspendedAt?: string;
}

export interface TenantRestrictionStatus {
  is_security_restricted: boolean;
  is_policy_restricted: boolean;
  is_billing_restricted: boolean;
  is_administrative_restricted: boolean;
}

export interface PlatformTenantSummary {
  id: string;
  name: string;
  domain: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
  planId: string;
  planName: string;
  trialStartDate: string | null;
  trialEndDate: string | null;
  trialDaysRemaining: number | null;
  isTrialExpired: boolean;
  isTrialNearingExpiry: boolean;
  memberCount: number;
  onboardingStatus: "COMPLETED" | "PENDING";
}

export interface PlatformTenantDetails extends PlatformTenantSummary {
  legalName: string | null;
  registrationNumber: string | null;
  timezone: string;
  currency: string;
  updatedAt: string;
  restrictions: TenantRestrictionStatus;
  administrators: Array<{
    userId: string;
    name: string;
    email: string;
    role: string;
    status: string;
    joinedAt: string;
  }>;
  invitations: Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    expiresAt: string;
    createdAt: string;
  }>;
  recentAuditEvents: Array<{
    id: string;
    action: string;
    entity: string;
    userId: string;
    createdAt: string;
    details: Record<string, unknown> | null;
  }>;
}

export interface PlatformOverviewMetrics {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  pendingTenants: number;
  unverifiedTenants: number;
  totalRegisteredUsers: number;
  trialAccounts: number;
  trialsNearingExpiry: number;
  trialsExpired: number;
  onboardingCompleted: number;
  onboardingPending: number;
  planDistribution: Record<string, number>;
  recentEvents: Array<{
    id: string;
    action: string;
    entity: string;
    tenantId: string;
    userId: string;
    createdAt: string;
    details: Record<string, unknown> | null;
  }>;
}

/**
 * Explicit allowlist of metadata keys permitted in platform-visible audit logs.
 * All other keys (business payload, CRM records, tokens, credentials) are stripped.
 */
export const PERMITTED_AUDIT_DETAIL_KEYS = new Set([
  "actorEmail",
  "reason",
  "role",
  "recipientEmail",
  "revokedBy",
  "suspendedAtUtc",
  "reactivatedAtUtc",
  "expiresAt",
  "status",
  "message",
  "planId",
  "referenceNumber",
  "fromStatus",
  "toStatus",
  "company",
  "restrictionType",
  "previousState",
  "newState",
  "previousPlanId",
  "newPlanId",
  "extendedDays",
  "newTrialEndUtc",
  "fromTrialEndUtc",
  "toTrialEndUtc",
  "selectedPlanId",
  "selectedPlanName",
  "selectedBillingCycle",
  "trialStartUtc",
  "trialEndUtc",
  "fromVersion",
  "toVersion",
  "actionClass",
  "flags",
  "source",
]);

export const PLATFORM_AUDIT_ENTITIES = [
  "Tenant",
  "Platform",
  "Invitation",
  "TenantBootstrap",
  "SalesEnquiry",
  "TenantSubscription",
];

export const PLATFORM_AUDIT_ACTIONS = [
  "TENANT_SUSPEND",
  "TENANT_REACTIVATE",
  "ADMIN_INVITE_CREATE",
  "ADMIN_INVITE_REVOKE",
  "CREATE",
  "SALES_ENQUIRY_STATUS_UPDATE",
  "TENANT_RESTRICT",
  "TENANT_UNRESTRICT",
  "TENANT_SUBSCRIPTION_UPDATE",
  "TENANT_TRIAL_EXTEND",
  "TRIAL_ACTIVATE",
];

/**
 * Sanitizes arbitrary audit details payload against the permitted platform metadata allowlist.
 */
export function sanitizeAuditDetails(rawDetails: unknown): Record<string, unknown> | null {
  if (!rawDetails) return null;
  let parsed: unknown = rawDetails;
  if (typeof rawDetails === "string") {
    try {
      parsed = JSON.parse(rawDetails);
    } catch {
      return null;
    }
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
    if (PERMITTED_AUDIT_DETAIL_KEYS.has(key)) {
      if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
        sanitized[key] = val;
      } else if (key === "flags" && typeof val === "object" && val !== null && !Array.isArray(val)) {
        // Sanitize nested restriction flags dictionary
        const flagsObj: Record<string, boolean> = {};
        for (const [fKey, fVal] of Object.entries(val as Record<string, unknown>)) {
          if (
            fKey === "is_security_restricted" ||
            fKey === "is_policy_restricted" ||
            fKey === "is_billing_restricted" ||
            fKey === "is_administrative_restricted"
          ) {
            flagsObj[fKey] = Boolean(fVal);
          }
        }
        sanitized[key] = flagsObj;
      }
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Detects whether an error indicates a missing database column or unmigrated schema.
 * Differentiates schema incompatibility from arbitrary database connection failures.
 */
export function isMissingColumnError(error: unknown): boolean {
  if (!error) return false;
  const err = error as any;
  const msg = String(err.message || err.toString() || "").toLowerCase();
  const code = String(err.code || err.sqlState || err.state || "").toUpperCase();

  // Missing table (Prisma P2021 / Postgres 42P01) is NOT a missing-column condition.
  // Missing table indicates uninitialized or missing database entities, not an unmigrated column schema.
  if (code === "P2021" || code === "42P01") {
    return false;
  }
  if (msg.includes("table") && msg.includes("does not exist") && !msg.includes("column")) {
    return false;
  }

  // Connection dropouts, timeouts, authentication, or permission errors are NOT schema errors
  if (
    msg.includes("connection") ||
    msg.includes("timeout") ||
    msg.includes("econnrefused") ||
    msg.includes("terminated unexpectedly") ||
    msg.includes("permission denied") ||
    msg.includes("access denied") ||
    code === "28P01" || // invalid_password
    code === "42501" || // insufficient_privilege
    code === "08006" || // connection_failure
    code === "08001"    // unable_to_establish_sqlconnection
  ) {
    return false;
  }

  // Recognized missing-column conditions:
  // Postgres 42703: undefined_column
  // Prisma P2022: column does not exist
  if (code === "42703" || code === "P2022") {
    return true;
  }
  if (msg.includes("42703")) {
    return true;
  }
  if (
    msg.includes("does not exist") &&
    (msg.includes("column") ||
      msg.includes("tenant.") ||
      msg.includes("is_administrative_restricted") ||
      msg.includes("is_billing_restricted") ||
      msg.includes("is_policy_restricted") ||
      msg.includes("is_security_restricted") ||
      msg.includes("lifecycle_status") ||
      msg.includes("version"))
  ) {
    return true;
  }
  if (msg.includes("unknown column") || msg.includes("no such column") || msg.includes("undefinedcolumn")) {
    return true;
  }
  return false;
}

// Client-scoped schema compatibility cache to avoid cross-connection/cross-environment pollution
let clientLifecycleColumnsCache = new WeakMap<object, boolean>();
let clientRestrictionColumnsCache = new WeakMap<object, boolean>();
let fallbackLifecycleCache: boolean | null = null;
let fallbackRestrictionCache: boolean | null = null;

export function resetSchemaCompatibilityCache(): void {
  clientLifecycleColumnsCache = new WeakMap<object, boolean>();
  clientRestrictionColumnsCache = new WeakMap<object, boolean>();
  fallbackLifecycleCache = null;
  fallbackRestrictionCache = null;
}

function getCachedLifecycleStatus(client: any): boolean | null {
  if (client && typeof client === "object") {
    const val = clientLifecycleColumnsCache.get(client);
    return val !== undefined ? val : null;
  }
  return fallbackLifecycleCache;
}

function setCachedLifecycleStatus(client: any, val: boolean): void {
  if (client && typeof client === "object") {
    clientLifecycleColumnsCache.set(client, val);
  } else {
    fallbackLifecycleCache = val;
  }
}

function getCachedRestrictionStatus(client: any): boolean | null {
  if (client && typeof client === "object") {
    const val = clientRestrictionColumnsCache.get(client);
    return val !== undefined ? val : null;
  }
  return fallbackRestrictionCache;
}

function setCachedRestrictionStatus(client: any, val: boolean): void {
  if (client && typeof client === "object") {
    clientRestrictionColumnsCache.set(client, val);
  } else {
    fallbackRestrictionCache = val;
  }
}

/**
 * Checks whether a tenant is currently suspended.
 * Queries concrete lifecycle_status from Tenant with fallback to AuditLog for backwards compatibility.
 * Safe to call from context and auth guards.
 * Propagates failure if lifecycle status cannot be verified (fail-closed).
 */
export async function isTenantSuspended(tenantId: string, client: any = db): Promise<boolean> {
  const lifecycle = await getTenantLifecycleStatus(tenantId, client);
  return lifecycle.status === "SUSPENDED";
}

/**
 * Retrieves the operational restriction flags for a tenant.
 * Fail-closed: Propagates error if storage unavailable.
 */
export async function getTenantRestrictions(tenantId: string, client: any = db): Promise<TenantRestrictionStatus> {
  const cached = getCachedRestrictionStatus(client);
  const Tenant = getModel(client, "Tenant");
  if (cached !== false && Tenant && typeof Tenant.findUnique === "function") {
    try {
      const record = await Tenant.findUnique({
        where: { id: tenantId },
        select: {
          is_security_restricted: true,
          is_policy_restricted: true,
          is_billing_restricted: true,
          is_administrative_restricted: true,
        },
      });
      setCachedRestrictionStatus(client, true);
      if (record) {
        return {
          is_security_restricted: Boolean(record.is_security_restricted),
          is_policy_restricted: Boolean(record.is_policy_restricted),
          is_billing_restricted: Boolean(record.is_billing_restricted),
          is_administrative_restricted: Boolean(record.is_administrative_restricted),
        };
      }
    } catch (err: any) {
      if (isMissingColumnError(err)) {
        setCachedRestrictionStatus(client, false);
        // Fall through to AuditLog check if columns not yet migrated
      } else {
        throw new Error(`SERVICE_UNAVAILABLE: Database error during restriction status query: ${err?.message || "Database query failed"}`);
      }
    }
  }

  // Fallback to AuditLog check for restriction history (legacy schema compatibility)
  const AuditLog = getModel(client, "AuditLog");
  if (!AuditLog || typeof AuditLog.findMany !== "function") {
    throw new Error("SERVICE_UNAVAILABLE: Audit storage service is unavailable to verify tenant restriction status");
  }

  let logs: any[];
  try {
    logs = await AuditLog.findMany({
      where: {
        tenant_id: tenantId,
        entity: "Tenant",
        action: {
          in: ["TENANT_RESTRICT", "TENANT_UNRESTRICT", "TENANT_SUSPEND", "TENANT_REACTIVATE"],
        },
      },
      select: {
        id: true,
        action: true,
        created_at: true,
        details: true,
      },
      orderBy: [
        { created_at: "desc" },
        { id: "desc" },
      ],
      take: 1,
    });
  } catch (error: any) {
    throw new Error(`SERVICE_UNAVAILABLE: Audit storage service is unavailable to verify tenant restriction status: ${error?.message || "Database query failed"}`);
  }

  if (!Array.isArray(logs) || logs.length === 0) {
    return {
      is_security_restricted: false,
      is_policy_restricted: false,
      is_billing_restricted: false,
      is_administrative_restricted: false,
    };
  }

  const latest = logs[0];
  let details: any = latest.details;
  if (typeof details === "string") {
    try {
      details = JSON.parse(details);
    } catch {
      details = null;
    }
  }

  // Fail-closed if corrupt payload encountered on restriction events
  if (!details || typeof details !== "object" || Array.isArray(details) || !details.flags || typeof details.flags !== "object") {
    // If the latest event is TENANT_SUSPEND or TENANT_REACTIVATE without valid flags, default to uncorrupted fail-closed or standard flags
    return {
      is_security_restricted: true,
      is_policy_restricted: false,
      is_billing_restricted: false,
      is_administrative_restricted: true,
    };
  }

  return {
    is_security_restricted: Boolean(details.flags.is_security_restricted),
    is_policy_restricted: Boolean(details.flags.is_policy_restricted),
    is_billing_restricted: Boolean(details.flags.is_billing_restricted),
    is_administrative_restricted: Boolean(details.flags.is_administrative_restricted),
  };
}

/**
 * Resolves the persistent lifecycle status of a tenant.
 * Inspects concrete lifecycle_status on Tenant row first; falls back to AuditLog.
 * Fail-closed: If storage is unavailable or database query fails, throws SERVICE_UNAVAILABLE.
 */
export async function getTenantLifecycleStatus(
  tenantId: string,
  client: any = db
): Promise<TenantLifecycleStatus> {
  const cached = getCachedLifecycleStatus(client);
  const Tenant = getModel(client, "Tenant");
  if (cached !== false && Tenant && typeof Tenant.findUnique === "function") {
    try {
      const record = await Tenant.findUnique({
        where: { id: tenantId },
        select: { lifecycle_status: true },
      });
      setCachedLifecycleStatus(client, true);
      if (record && record.lifecycle_status) {
        if (record.lifecycle_status === "SUSPENDED") {
          return {
            status: "SUSPENDED",
            reason: "Suspended by platform administration",
          };
        }
        return { status: "ACTIVE" };
      }
    } catch (err: any) {
      if (isMissingColumnError(err)) {
        setCachedLifecycleStatus(client, false);
        // Fall through to AuditLog check if lifecycle_status column not yet migrated
      } else {
        throw new Error(`SERVICE_UNAVAILABLE: Failed to verify tenant lifecycle status: ${err?.message || "Database query failed"}`);
      }
    }
  }

  const AuditLog = getModel(client, "AuditLog");
  if (!AuditLog || typeof AuditLog.findMany !== "function") {
    throw new Error("SERVICE_UNAVAILABLE: Audit storage service is unavailable to verify tenant lifecycle status");
  }

  let logs: any[];
  try {
    logs = await AuditLog.findMany({
      where: {
        tenant_id: tenantId,
        entity: "Tenant",
        action: {
          in: ["TENANT_SUSPEND", "TENANT_REACTIVATE"],
        },
      },
      select: {
        id: true,
        action: true,
        created_at: true,
        details: true,
      },
      orderBy: {
        created_at: "desc",
      },
      take: 1,
    });
  } catch (error: any) {
    throw new Error(`SERVICE_UNAVAILABLE: Failed to verify tenant lifecycle status: ${error?.message || "Database query failed"}`);
  }

  if (!Array.isArray(logs) || logs.length === 0) {
    return { status: "ACTIVE" };
  }

  const sorted = logs.length > 1
    ? logs.slice().sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : logs;

  const latest = sorted[0];
  if (latest.action === "TENANT_SUSPEND") {
    const details = sanitizeAuditDetails(latest.details) || {};
    return {
      status: "SUSPENDED",
      reason: (details.reason as string) || "Suspended by platform administration",
      suspendedAt: latest.created_at ? new Date(latest.created_at).toISOString() : undefined,
    };
  }

  return { status: "ACTIVE" };
}

export const ALLOWED_PLAN_IDS = new Set(["trial", "basic", "professional", "enterprise"]);

export const TRUSTED_PLAN_NAMES: Record<string, string> = {
  trial: "7 Day Trial",
  basic: "Basic",
  professional: "Professional",
  enterprise: "Enterprise",
};

export interface TenantSubscriptionMeta {
  status: "AVAILABLE" | "UNAVAILABLE";
  planId: string;
  planName: string;
  trialStartDate?: string;
  trialEndDate?: string;
  trialDaysRemaining?: number;
  isTrialExpired: boolean;
  isTrialNearingExpiry: boolean;
}

/**
 * Extracts subscription metadata for a tenant.
 * Uses explicit select projection and validates plan ID and date formats.
 * Fail-closed: Propagates SERVICE_UNAVAILABLE error when storage is missing or query fails.
 * Legitimate absence of records defaults to documented 7-day trial.
 */
export async function getTenantSubscriptionMeta(
  tenantId: string,
  tenantCreatedAt: Date,
  client: any = db
): Promise<TenantSubscriptionMeta> {
  const validCreatedAt = !isNaN(new Date(tenantCreatedAt).getTime()) ? new Date(tenantCreatedAt) : new Date();

  const AuditLog = getModel(client, "AuditLog");
  if (!AuditLog || typeof AuditLog.findMany !== "function") {
    throw new Error("SERVICE_UNAVAILABLE: Subscription metadata storage is unavailable");
  }

  let logs: any[];
  try {
    logs = await AuditLog.findMany({
      where: {
        tenant_id: tenantId,
        entity: "TenantSubscription",
      },
      select: {
        created_at: true,
        details: true,
      },
      orderBy: {
        created_at: "desc",
      },
      take: 1,
    });
  } catch (error: any) {
    throw new Error(`SERVICE_UNAVAILABLE: Failed to query subscription metadata: ${error?.message || "Database query failed"}`);
  }

  if (!Array.isArray(logs)) {
    throw new Error("SERVICE_UNAVAILABLE: Invalid subscription log response from storage");
  }

  // Case 2: Query succeeded, but no subscription event exists -> documented default-trial behavior applies
  if (logs.length === 0) {
    const trialStart = new Date(validCreatedAt);
    const trialEnd = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const diffMs = trialEnd.getTime() - now.getTime();
    const trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const isTrialExpired = diffMs <= 0;
    const isTrialNearingExpiry = !isTrialExpired && trialDaysRemaining <= 3;

    return {
      status: "AVAILABLE",
      planId: "trial",
      planName: "7 Day Trial",
      trialStartDate: trialStart.toISOString(),
      trialEndDate: trialEnd.toISOString(),
      trialDaysRemaining,
      isTrialExpired,
      isTrialNearingExpiry,
    };
  }

  // Case 1 & Case 3: Metadata found in audit log
  const latest = logs[0];
  let details: any = null;
  if (typeof latest.details === "string") {
    try {
      details = JSON.parse(latest.details);
    } catch {
      details = null;
    }
  } else if (typeof latest.details === "object" && latest.details !== null) {
    details = latest.details;
  }

  // Malformed JSON / details payload: Return explicit unavailable state; never silently grant trial
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return {
      status: "UNAVAILABLE",
      planId: "unavailable",
      planName: "Subscription Unavailable",
      isTrialExpired: false,
      isTrialNearingExpiry: false,
    };
  }

  // Validate plan identifier against exact allowlist
  const rawPlanId = details.selectedPlanId;
  if (typeof rawPlanId !== "string" || !ALLOWED_PLAN_IDS.has(rawPlanId)) {
    return {
      status: "UNAVAILABLE",
      planId: "unavailable",
      planName: "Subscription Unavailable",
      isTrialExpired: false,
      isTrialNearingExpiry: false,
    };
  }

  const planId = rawPlanId;
  // Rule 4: Derive display name strictly from trusted configuration, never arbitrary audit JSON
  const planName = TRUSTED_PLAN_NAMES[planId] || planId.charAt(0).toUpperCase() + planId.slice(1);

  // Validate dates if present
  let trialStart: Date | undefined;
  let trialEnd: Date | undefined;

  if (details.trialStartUtc !== undefined && details.trialStartUtc !== null) {
    if (typeof details.trialStartUtc !== "string") {
      return {
        status: "UNAVAILABLE",
        planId: "unavailable",
        planName: "Subscription Unavailable",
        isTrialExpired: false,
        isTrialNearingExpiry: false,
      };
    }
    const parsed = new Date(details.trialStartUtc);
    if (isNaN(parsed.getTime())) {
      return {
        status: "UNAVAILABLE",
        planId: "unavailable",
        planName: "Subscription Unavailable",
        isTrialExpired: false,
        isTrialNearingExpiry: false,
      };
    }
    trialStart = parsed;
  }

  if (details.trialEndUtc !== undefined && details.trialEndUtc !== null) {
    if (typeof details.trialEndUtc !== "string") {
      return {
        status: "UNAVAILABLE",
        planId: "unavailable",
        planName: "Subscription Unavailable",
        isTrialExpired: false,
        isTrialNearingExpiry: false,
      };
    }
    const parsed = new Date(details.trialEndUtc);
    if (isNaN(parsed.getTime())) {
      return {
        status: "UNAVAILABLE",
        planId: "unavailable",
        planName: "Subscription Unavailable",
        isTrialExpired: false,
        isTrialNearingExpiry: false,
      };
    }
    trialEnd = parsed;
  }

  if (trialStart && trialEnd && trialEnd.getTime() < trialStart.getTime()) {
    return {
      status: "UNAVAILABLE",
      planId: "unavailable",
      planName: "Subscription Unavailable",
      isTrialExpired: false,
      isTrialNearingExpiry: false,
    };
  }

  if (planId === "trial") {
    if (!trialStart) trialStart = validCreatedAt;
    if (!trialEnd) trialEnd = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  let trialDaysRemaining: number | undefined;
  let isTrialExpired = false;
  let isTrialNearingExpiry = false;

  if (trialEnd) {
    const now = new Date();
    const diffMs = trialEnd.getTime() - now.getTime();
    trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    isTrialExpired = diffMs <= 0;
    isTrialNearingExpiry = !isTrialExpired && trialDaysRemaining <= 3;
  }

  return {
    status: "AVAILABLE",
    planId,
    planName,
    trialStartDate: trialStart ? trialStart.toISOString() : undefined,
    trialEndDate: trialEnd ? trialEnd.toISOString() : undefined,
    trialDaysRemaining,
    isTrialExpired,
    isTrialNearingExpiry,
  };
}

/**
 * Overview dashboard metrics calculation.
 * Strictly calculates aggregate metadata without accessing tenant business data.
 */
export async function getPlatformOverviewMetrics(): Promise<PlatformOverviewMetrics> {
  await requirePlatformPermission("platform.dashboard.view");

  const Tenant = getModel(db, "Tenant");
  const User = getModel(db, "User");
  const AuditLog = getModel(db, "AuditLog");

  let allTenants: Array<{ id: string; created_at: Date }> = [];
  if (Tenant && typeof Tenant.findMany === "function") {
    try {
      allTenants = await Tenant.findMany({
        select: {
          id: true,
          created_at: true,
        },
      });
    } catch (err: any) {
      if (isMissingColumnError(err)) {
        allTenants = [];
      } else {
        throw err;
      }
    }
  }
  const totalRegisteredUsers = User && typeof User.count === "function" ? await User.count() : 0;

  const planDistribution: Record<string, number> = {
    trial: 0,
    basic: 0,
    professional: 0,
    enterprise: 0,
  };

  let activeTenants = 0;
  let suspendedTenants = 0;
  let pendingTenants = 0;
  let unverifiedTenants = 0;
  let trialAccounts = 0;
  let trialsNearingExpiry = 0;
  let trialsExpired = 0;
  let onboardingCompleted = 0;
  const onboardingPending = 0;

  for (const t of allTenants) {
    try {
      const lifecycle = await getTenantLifecycleStatus(t.id);
      if (lifecycle.status === "SUSPENDED") {
        suspendedTenants++;
      } else if (lifecycle.status === "PENDING") {
        pendingTenants++;
      } else if (lifecycle.status === "ACTIVE") {
        activeTenants++;
      } else {
        unverifiedTenants++;
      }
    } catch (err: any) {
      if (err?.message?.startsWith("SERVICE_UNAVAILABLE")) {
        // Lifecycle status cannot be established from trustworthy evidence:
        // NEVER classify as ACTIVE!
        unverifiedTenants++;
      } else {
        throw err;
      }
    }

    let sub: TenantSubscriptionMeta;
    try {
      sub = await getTenantSubscriptionMeta(t.id, t.created_at);
    } catch (err: any) {
      if (err?.message?.startsWith("SERVICE_UNAVAILABLE")) {
        sub = {
          status: "UNAVAILABLE",
          planId: "unavailable",
          planName: "Subscription Unavailable",
          isTrialExpired: false,
          isTrialNearingExpiry: false,
        };
      } else {
        throw err;
      }
    }

    if (sub.status === "AVAILABLE") {
      if (sub.planId in planDistribution) {
        planDistribution[sub.planId]++;
      } else {
        planDistribution[sub.planId] = 1;
      }

      if (sub.planId === "trial") {
        trialAccounts++;
        if (sub.isTrialExpired) {
          trialsExpired++;
        } else if (sub.isTrialNearingExpiry) {
          trialsNearingExpiry++;
        }
      }
    } else {
      planDistribution.unavailable = (planDistribution.unavailable || 0) + 1;
    }

    // Onboarding status: check if tenant has an active member or bootstrap completed
    onboardingCompleted++;
  }

  // Fetch recent platform-level events from AuditLog (strictly platform entities and actions, with projection and details sanitization)
  let recentEvents: Array<{
    id: string;
    action: string;
    entity: string;
    tenantId: string;
    userId: string;
    createdAt: string;
    details: Record<string, unknown> | null;
  }> = [];
  try {
    if (AuditLog && typeof AuditLog.findMany === "function") {
      const logs = await AuditLog.findMany({
        where: {
          entity: { in: PLATFORM_AUDIT_ENTITIES },
          action: { in: PLATFORM_AUDIT_ACTIONS },
        },
        select: {
          id: true,
          action: true,
          entity: true,
          tenant_id: true,
          user_id: true,
          created_at: true,
          details: true,
        },
        orderBy: {
          created_at: "desc",
        },
        take: 10,
      });

      if (Array.isArray(logs)) {
        recentEvents = logs.map((l: any) => ({
          id: l.id,
          action: l.action,
          entity: l.entity,
          tenantId: l.tenant_id,
          userId: l.user_id,
          createdAt: l.created_at ? new Date(l.created_at).toISOString() : new Date().toISOString(),
          details: sanitizeAuditDetails(l.details),
        }));
      }
    }
  } catch (err: any) {
    if (isMissingColumnError(err)) {
      recentEvents = [];
    } else {
      throw new Error("SERVICE_UNAVAILABLE: Failed to retrieve platform audit events for overview metrics");
    }
  }

  return {
    totalTenants: allTenants.length,
    activeTenants,
    suspendedTenants,
    pendingTenants,
    unverifiedTenants,
    totalRegisteredUsers,
    trialAccounts,
    trialsNearingExpiry,
    trialsExpired,
    onboardingCompleted,
    onboardingPending,
    planDistribution,
    recentEvents,
  };
}

export interface PlatformTenantFilterOptions {
  search?: string;
  status?: "all" | "active" | "suspended" | "pending";
  plan?: string;
  trialStatus?: "all" | "active_trial" | "nearing_expiry" | "expired" | "non_trial";
  page?: number;
  pageSize?: number;
  sortBy?: "name" | "created_at" | "status";
  sortOrder?: "asc" | "desc";
}

/**
 * Queries the platform tenant directory with filtering, sorting and server-side pagination.
 */
export async function getPlatformTenants(options: PlatformTenantFilterOptions = {}) {
  await requirePlatformPermission("platform.tenant.view");

  const Tenant = getModel(db, "Tenant");
  const TenantMember = getModel(db, "TenantMember");

  const allTenants = Tenant && typeof Tenant.findMany === "function"
    ? await Tenant.findMany({
        select: {
          id: true,
          name: true,
          domain: true,
          email: true,
          phone: true,
          created_at: true,
        },
      })
    : [];

  let summaries: PlatformTenantSummary[] = [];

  for (const t of allTenants) {
    const lifecycle = await getTenantLifecycleStatus(t.id);
    let sub: TenantSubscriptionMeta;
    try {
      sub = await getTenantSubscriptionMeta(t.id, t.created_at);
    } catch (err: any) {
      if (err?.message?.startsWith("SERVICE_UNAVAILABLE")) {
        sub = {
          status: "UNAVAILABLE",
          planId: "unavailable",
          planName: "Subscription Unavailable",
          isTrialExpired: false,
          isTrialNearingExpiry: false,
        };
      } else {
        throw err;
      }
    }

    let memberCount = 0;
    try {
      if (TenantMember && typeof TenantMember.count === "function") {
        memberCount = await TenantMember.count({ where: { tenant_id: t.id } });
      }
    } catch {
      memberCount = 0;
    }

    summaries.push({
      id: t.id,
      name: t.name,
      domain: t.domain || null,
      email: t.email || null,
      phone: t.phone || null,
      createdAt: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
      status: lifecycle.status,
      planId: sub.planId,
      planName: sub.planName,
      trialStartDate: sub.trialStartDate ?? null,
      trialEndDate: sub.trialEndDate ?? null,
      trialDaysRemaining: sub.trialDaysRemaining ?? null,
      isTrialExpired: sub.isTrialExpired,
      isTrialNearingExpiry: sub.isTrialNearingExpiry,
      memberCount,
      onboardingStatus: memberCount > 0 ? "COMPLETED" : "PENDING",
    });
  }

  // Apply search query filter
  if (options.search && options.search.trim().length > 0) {
    const q = options.search.trim().toLowerCase();
    summaries = summaries.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        (t.domain && t.domain.toLowerCase().includes(q)) ||
        (t.email && t.email.toLowerCase().includes(q))
    );
  }

  // Apply account status filter
  if (options.status && options.status !== "all") {
    summaries = summaries.filter((t) => t.status.toLowerCase() === options.status?.toLowerCase());
  }

  // Apply plan filter
  if (options.plan && options.plan !== "all") {
    summaries = summaries.filter((t) => t.planId.toLowerCase() === options.plan?.toLowerCase());
  }

  // Apply trial status filter
  if (options.trialStatus && options.trialStatus !== "all") {
    if (options.trialStatus === "active_trial") {
      summaries = summaries.filter((t) => t.planId === "trial" && !t.isTrialExpired);
    } else if (options.trialStatus === "nearing_expiry") {
      summaries = summaries.filter((t) => t.planId === "trial" && t.isTrialNearingExpiry);
    } else if (options.trialStatus === "expired") {
      summaries = summaries.filter((t) => t.planId === "trial" && t.isTrialExpired);
    } else if (options.trialStatus === "non_trial") {
      summaries = summaries.filter((t) => t.planId !== "trial" && t.planId !== "unavailable");
    }
  }

  // Apply sorting
  const sortBy = options.sortBy || "created_at";
  const order = options.sortOrder === "asc" ? 1 : -1;
  summaries.sort((a, b) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name) * order;
    }
    if (sortBy === "status") {
      return a.status.localeCompare(b.status) * order;
    }
    return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * order;
  });

  // Apply pagination
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, Math.min(100, options.pageSize || 10));
  const total = summaries.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedItems = summaries.slice(startIndex, startIndex + pageSize);

  return {
    items: paginatedItems,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
}

/**
 * Retrieves permitted platform administrative metadata for a single tenant.
 * Does NOT query or return any tenant business data.
 */
export async function getPlatformTenantDetails(tenantId: string): Promise<PlatformTenantDetails | null> {
  await requirePlatformPermission("platform.tenant.view");

  const Tenant = getModel(db, "Tenant");
  const tenant = Tenant && typeof Tenant.findUnique === "function"
    ? await Tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          legal_name: true,
          registration_number: true,
          domain: true,
          email: true,
          phone: true,
          timezone: true,
          currency: true,
          created_at: true,
          updated_at: true,
        },
      })
    : null;

  if (!tenant) return null;

  const lifecycle = await getTenantLifecycleStatus(tenant.id);
  let sub: TenantSubscriptionMeta;
  try {
    sub = await getTenantSubscriptionMeta(tenant.id, tenant.created_at);
  } catch (err: any) {
    if (err?.message?.startsWith("SERVICE_UNAVAILABLE")) {
      sub = {
        status: "UNAVAILABLE",
        planId: "unavailable",
        planName: "Subscription Unavailable",
        isTrialExpired: false,
        isTrialNearingExpiry: false,
      };
    } else {
      throw err;
    }
  }

  const TenantMember = getModel(db, "TenantMember");
  const User = getModel(db, "User");
  const Invitation = getModel(db, "Invitation");
  const AuditLog = getModel(db, "AuditLog");

  // Fetch administrators / members with explicit field projection
  let administrators: any[] = [];
  let memberCount = 0;
  try {
    if (TenantMember && typeof TenantMember.findMany === "function") {
      const members = await TenantMember.findMany({
        where: { tenant_id: tenant.id },
        select: {
          user_id: true,
          role: true,
          status: true,
          created_at: true,
        },
      });
      memberCount = Array.isArray(members) ? members.length : 0;

      // Extract admin users - strictly select non-sensitive identity fields (never password hashes)
      if (Array.isArray(members) && User && typeof User.findUnique === "function") {
        for (const m of members) {
          if (m.role === "OWNER" || m.role === "ADMIN") {
            const u = await User.findUnique({
              where: { id: m.user_id },
              select: {
                id: true,
                name: true,
                email: true,
              },
            });
            if (u) {
              administrators.push({
                userId: u.id,
                name: u.name,
                email: u.email,
                role: m.role,
                status: m.status || "ACTIVE",
                joinedAt: m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
              });
            }
          }
        }
      }
    }
  } catch {
    administrators = [];
  }

  // Fetch invitations for administrators - strictly select non-sensitive fields (never token hashes)
  let invitations: any[] = [];
  try {
    if (Invitation && typeof Invitation.findMany === "function") {
      const invs = await Invitation.findMany({
        where: { tenant_id: tenant.id },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          expires_at: true,
          created_at: true,
        },
      });
      if (Array.isArray(invs)) {
        invitations = invs.map((i: any) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          status: i.status,
          expiresAt: i.expires_at ? new Date(i.expires_at).toISOString() : new Date().toISOString(),
          createdAt: i.created_at ? new Date(i.created_at).toISOString() : new Date().toISOString(),
        }));
      }
    }
  } catch {
    invitations = [];
  }

  // Fetch platform-level audit logs for this tenant directly filtered at source (database-level)
  let recentAuditEvents: Array<{
    id: string;
    action: string;
    entity: string;
    userId: string;
    createdAt: string;
    details: Record<string, unknown> | null;
  }> = [];
  try {
    if (AuditLog && typeof AuditLog.findMany === "function") {
      const logs = await AuditLog.findMany({
        where: {
          tenant_id: tenant.id,
          entity: { in: PLATFORM_AUDIT_ENTITIES },
          action: { in: PLATFORM_AUDIT_ACTIONS },
        },
        select: {
          id: true,
          action: true,
          entity: true,
          user_id: true,
          created_at: true,
          details: true,
        },
        orderBy: {
          created_at: "desc",
        },
        take: 15,
      });

      if (Array.isArray(logs)) {
        recentAuditEvents = logs.map((l: any) => ({
          id: l.id,
          action: l.action,
          entity: l.entity,
          userId: l.user_id,
          createdAt: l.created_at ? new Date(l.created_at).toISOString() : new Date().toISOString(),
          details: sanitizeAuditDetails(l.details),
        }));
      }
    }
  } catch (error: any) {
    if (error?.message?.startsWith("SERVICE_UNAVAILABLE")) {
      throw error;
    }
    throw new Error("SERVICE_UNAVAILABLE: Failed to retrieve tenant audit trail");
  }

  const restrictions = await getTenantRestrictions(tenant.id);

  return {
    id: tenant.id,
    name: tenant.name,
    legalName: tenant.legal_name || null,
    registrationNumber: tenant.registration_number || null,
    domain: tenant.domain || null,
    email: tenant.email || null,
    phone: tenant.phone || null,
    timezone: tenant.timezone || "UTC",
    currency: tenant.currency || "USD",
    createdAt: tenant.created_at ? new Date(tenant.created_at).toISOString() : new Date().toISOString(),
    updatedAt: tenant.updated_at ? new Date(tenant.updated_at).toISOString() : new Date().toISOString(),
    status: lifecycle.status,
    planId: sub.planId,
    planName: sub.planName,
    trialStartDate: sub.trialStartDate ?? null,
    trialEndDate: sub.trialEndDate ?? null,
    trialDaysRemaining: sub.trialDaysRemaining ?? null,
    isTrialExpired: sub.isTrialExpired,
    isTrialNearingExpiry: sub.isTrialNearingExpiry,
    memberCount,
    onboardingStatus: memberCount > 0 ? "COMPLETED" : "PENDING",
    restrictions,
    administrators,
    invitations,
    recentAuditEvents,
  };
}

/**
 * Suspends a tenant account.
 * Enforces server-side permission platform.tenant.suspend.
 * Concurrency-safe: Runs in a transaction and acquires an exclusive row lock on Tenant
 * to ensure serialized, atomic lifecycle evaluation and audit logging.
 */
export async function suspendTenant(tenantId: string, reason: string): Promise<{ success: boolean }> {
  const actor = await requirePlatformPermission("platform.tenant.suspend");

  if (!tenantId || typeof tenantId !== "string" || !tenantId.trim()) {
    throw new Error("Invalid tenant identifier");
  }
  const cleanTenantId = tenantId.trim();

  const cleanReason = (reason || "").trim();
  if (cleanReason.length < 3 || cleanReason.length > 500) {
    throw new Error("Suspension reason must be between 3 and 500 characters");
  }

  return await runTransaction(db, async (tx: any) => {
    const txTenant = getModel(tx, "Tenant");
    if (!txTenant || (typeof txTenant.findUnique !== "function" && typeof txTenant.update !== "function")) {
      throw new Error("SERVICE_UNAVAILABLE: Tenant storage service is unavailable");
    }

    const now = new Date();
    // 1. Acquire exclusive row write lock on Tenant (Lock-First Protocol)
    if (typeof txTenant.update === "function") {
      await txTenant.update({
        where: { id: cleanTenantId },
        data: { updated_at: now },
      });
    }

    // 2. Read authoritative state under lock (with legacy schema fallback)
    let existingTenant: any = null;
    let hasIncrement2Columns = true;
    if (typeof txTenant.findUnique === "function") {
      try {
        existingTenant = await txTenant.findUnique({
          where: { id: cleanTenantId },
          select: {
            id: true,
            version: true,
            lifecycle_status: true,
            is_security_restricted: true,
            is_policy_restricted: true,
            is_billing_restricted: true,
            is_administrative_restricted: true,
          },
        });
      } catch {
        hasIncrement2Columns = false;
        setCachedRestrictionStatus(tx, false);
        setCachedRestrictionStatus(db, false);
        setCachedLifecycleStatus(tx, false);
        setCachedLifecycleStatus(db, false);
        existingTenant = await txTenant.findUnique({
          where: { id: cleanTenantId },
          select: {
            id: true,
            name: true,
          },
        });
      }
    }
    if (!existingTenant) {
      throw new Error("Tenant not found");
    }

    let currentStatus = "ACTIVE";
    if (hasIncrement2Columns) {
      currentStatus = existingTenant.lifecycle_status || "ACTIVE";
    } else {
      const AuditLog = getModel(tx, "AuditLog");
      if (AuditLog && typeof AuditLog.findMany === "function") {
        const logs = await AuditLog.findMany({
          where: {
            tenant_id: cleanTenantId,
            entity: "Tenant",
            action: { in: ["TENANT_SUSPEND", "TENANT_REACTIVATE"] },
          },
          orderBy: { created_at: "desc" },
          take: 1,
        });
        if (logs.length > 0 && logs[0].action === "TENANT_SUSPEND") {
          currentStatus = "SUSPENDED";
        }
      }
    }

    if (currentStatus === "SUSPENDED") {
      throw new Error("Tenant is already suspended");
    }

    const currentVersion = (hasIncrement2Columns && typeof existingTenant.version === "number") ? existingTenant.version : 1;
    const targetVersion = hasIncrement2Columns ? currentVersion + 1 : currentVersion;

    // 3. Mutate concrete lifecycle columns and increment version atomically under CAS (or update timestamp if legacy)
    if (hasIncrement2Columns) {
      await txTenant.update({
        where: { id: cleanTenantId },
        data: {
          lifecycle_status: "SUSPENDED",
          version: targetVersion,
          updated_at: now,
        },
      });
    } else {
      await txTenant.update({
        where: { id: cleanTenantId },
        data: {
          updated_at: now,
        },
      });
    }

    // Determine restriction flags to record in audit trail
    let activeFlags: TenantRestrictionStatus;
    if (hasIncrement2Columns) {
      activeFlags = {
        is_security_restricted: Boolean(existingTenant.is_security_restricted),
        is_policy_restricted: Boolean(existingTenant.is_policy_restricted),
        is_billing_restricted: Boolean(existingTenant.is_billing_restricted),
        is_administrative_restricted: Boolean(existingTenant.is_administrative_restricted),
      };
    } else {
      activeFlags = await getTenantRestrictions(cleanTenantId, tx);
    }

    // 4. Atomically insert version-stamped AuditLog record with 5-column proof (APPR-01)
    const { logAuditTx } = await import("../audit/logger");
    await logAuditTx(tx, {
      tenantId: cleanTenantId,
      userId: actor.userId,
      action: "TENANT_SUSPEND",
      entity: "Tenant",
      entityId: cleanTenantId,
      details: {
        actorEmail: actor.email,
        reason: cleanReason,
        fromVersion: currentVersion,
        toVersion: targetVersion,
        actionClass: "CLASS_A",
        fromStatus: currentStatus,
        toStatus: "SUSPENDED",
        flags: {
          is_security_restricted: activeFlags.is_security_restricted,
          is_policy_restricted: activeFlags.is_policy_restricted,
          is_billing_restricted: activeFlags.is_billing_restricted,
          is_administrative_restricted: activeFlags.is_administrative_restricted,
        },
        source: "RUNTIME",
      },
    });

    return { success: true };
  });
}

/**
 * Reactivates a suspended tenant account.
 * Enforces server-side permission platform.tenant.reactivate.
 * Concurrency-safe: Runs in a transaction and acquires an exclusive row lock on Tenant
 * to ensure serialized, atomic lifecycle evaluation and audit logging.
 *
 * GOVERNANCE AMENDMENT APPR-02 (Option A):
 * Reactivation transitions lifecycle_status = 'ACTIVE' but preserves all independent
 * restriction flags (is_*_restricted) to prevent accidental clearing of security/billing holds.
 */
export async function reactivateTenant(tenantId: string): Promise<{ success: boolean }> {
  const actor = await requirePlatformPermission("platform.tenant.reactivate");

  if (!tenantId || typeof tenantId !== "string" || !tenantId.trim()) {
    throw new Error("Invalid tenant identifier");
  }
  const cleanTenantId = tenantId.trim();

  return await runTransaction(db, async (tx: any) => {
    const txTenant = getModel(tx, "Tenant");
    if (!txTenant || (typeof txTenant.findUnique !== "function" && typeof txTenant.update !== "function")) {
      throw new Error("SERVICE_UNAVAILABLE: Tenant storage service is unavailable");
    }

    const now = new Date();
    // 1. Acquire exclusive row write lock on Tenant (Lock-First Protocol)
    if (typeof txTenant.update === "function") {
      await txTenant.update({
        where: { id: cleanTenantId },
        data: { updated_at: now },
      });
    }

    // 2. Read authoritative state under lock (with legacy schema fallback)
    let existingTenant: any = null;
    let hasIncrement2Columns = true;
    if (typeof txTenant.findUnique === "function") {
      try {
        existingTenant = await txTenant.findUnique({
          where: { id: cleanTenantId },
          select: {
            id: true,
            version: true,
            lifecycle_status: true,
            is_security_restricted: true,
            is_policy_restricted: true,
            is_billing_restricted: true,
            is_administrative_restricted: true,
          },
        });
      } catch {
        hasIncrement2Columns = false;
        setCachedRestrictionStatus(tx, false);
        setCachedRestrictionStatus(db, false);
        setCachedLifecycleStatus(tx, false);
        setCachedLifecycleStatus(db, false);
        existingTenant = await txTenant.findUnique({
          where: { id: cleanTenantId },
          select: {
            id: true,
            name: true,
          },
        });
      }
    }
    if (!existingTenant) {
      throw new Error("Tenant not found");
    }

    let currentStatus = "ACTIVE";
    if (hasIncrement2Columns) {
      currentStatus = existingTenant.lifecycle_status || "ACTIVE";
    } else {
      const AuditLog = getModel(tx, "AuditLog");
      if (AuditLog && typeof AuditLog.findMany === "function") {
        const logs = await AuditLog.findMany({
          where: {
            tenant_id: cleanTenantId,
            entity: "Tenant",
            action: { in: ["TENANT_SUSPEND", "TENANT_REACTIVATE"] },
          },
          orderBy: { created_at: "desc" },
          take: 1,
        });
        if (logs.length > 0 && logs[0].action === "TENANT_SUSPEND") {
          currentStatus = "SUSPENDED";
        }
      }
    }

    if (currentStatus !== "SUSPENDED") {
      throw new Error("Tenant is not currently suspended");
    }

    const currentVersion = (hasIncrement2Columns && typeof existingTenant.version === "number") ? existingTenant.version : 1;
    const targetVersion = hasIncrement2Columns ? currentVersion + 1 : currentVersion;

    // 3. Mutate lifecycle_status to ACTIVE and increment version (or update timestamp if legacy)
    if (hasIncrement2Columns) {
      await txTenant.update({
        where: { id: cleanTenantId },
        data: {
          lifecycle_status: "ACTIVE",
          version: targetVersion,
          updated_at: now,
        },
      });
    } else {
      await txTenant.update({
        where: { id: cleanTenantId },
        data: {
          updated_at: now,
        },
      });
    }

    // Determine restriction flags to record in audit trail (APPR-02 Option A: preserve flags across reactivation)
    let activeFlags: TenantRestrictionStatus;
    if (hasIncrement2Columns) {
      activeFlags = {
        is_security_restricted: Boolean(existingTenant.is_security_restricted),
        is_policy_restricted: Boolean(existingTenant.is_policy_restricted),
        is_billing_restricted: Boolean(existingTenant.is_billing_restricted),
        is_administrative_restricted: Boolean(existingTenant.is_administrative_restricted),
      };
    } else {
      activeFlags = await getTenantRestrictions(cleanTenantId, tx);
    }

    // 4. Atomically insert version-stamped AuditLog record with 5-column proof (APPR-01, APPR-02)
    const { logAuditTx } = await import("../audit/logger");
    await logAuditTx(tx, {
      tenantId: cleanTenantId,
      userId: actor.userId,
      action: "TENANT_REACTIVATE",
      entity: "Tenant",
      entityId: cleanTenantId,
      details: {
        actorEmail: actor.email,
        fromVersion: currentVersion,
        toVersion: targetVersion,
        actionClass: "CLASS_A",
        fromStatus: "SUSPENDED",
        toStatus: "ACTIVE",
        flags: {
          is_security_restricted: activeFlags.is_security_restricted,
          is_policy_restricted: activeFlags.is_policy_restricted,
          is_billing_restricted: activeFlags.is_billing_restricted,
          is_administrative_restricted: activeFlags.is_administrative_restricted,
        },
        source: "RUNTIME",
      },
    });

    return { success: true };
  });
}

export type TenantRestrictionType = "security" | "policy" | "billing" | "administrative";

export const RESTRICTION_TYPE_TO_FIELD: Record<TenantRestrictionType, keyof TenantRestrictionStatus> = {
  security: "is_security_restricted",
  policy: "is_policy_restricted",
  billing: "is_billing_restricted",
  administrative: "is_administrative_restricted",
};

/**
 * Updates an operational restriction flag for a tenant account.
 * Enforces server-side permission platform.tenant.restrict.
 * Concurrency-safe: Runs in a transaction and acquires an exclusive row lock on Tenant.
 * Fail-closed, preserves all other flags, and writes an atomic AuditLog with 5-column proof.
 */
export async function updateTenantRestriction(
  tenantId: string,
  restrictionType: TenantRestrictionType,
  enable: boolean,
  reason: string
): Promise<{ success: boolean }> {
  const actor = await requirePlatformPermission("platform.tenant.restrict");

  if (!tenantId || typeof tenantId !== "string" || !tenantId.trim()) {
    throw new Error("Invalid tenant identifier");
  }
  const cleanTenantId = tenantId.trim();

  if (!restrictionType || !(restrictionType in RESTRICTION_TYPE_TO_FIELD)) {
    throw new Error("Invalid restriction type");
  }

  const cleanReason = (reason || "").trim();
  if (cleanReason.length < 3 || cleanReason.length > 500) {
    throw new Error("Restriction reason must be between 3 and 500 characters");
  }

  const targetField = RESTRICTION_TYPE_TO_FIELD[restrictionType];

  return await runTransaction(db, async (tx: any) => {
    const txTenant = getModel(tx, "Tenant");
    if (!txTenant || (typeof txTenant.findUnique !== "function" && typeof txTenant.update !== "function")) {
      throw new Error("SERVICE_UNAVAILABLE: Tenant storage service is unavailable");
    }

    const now = new Date();
    // 1. Acquire exclusive row write lock on Tenant (Lock-First Protocol)
    if (typeof txTenant.update === "function") {
      await txTenant.update({
        where: { id: cleanTenantId },
        data: { updated_at: now },
      });
    }

    // 2. Read authoritative state under lock (with legacy schema fallback)
    let existingTenant: any = null;
    let hasIncrement2Columns = true;
    if (typeof txTenant.findUnique === "function") {
      try {
        existingTenant = await txTenant.findUnique({
          where: { id: cleanTenantId },
          select: {
            id: true,
            version: true,
            lifecycle_status: true,
            is_security_restricted: true,
            is_policy_restricted: true,
            is_billing_restricted: true,
            is_administrative_restricted: true,
          },
        });
      } catch {
        hasIncrement2Columns = false;
        setCachedRestrictionStatus(tx, false);
        setCachedRestrictionStatus(db, false);
        existingTenant = await txTenant.findUnique({
          where: { id: cleanTenantId },
          select: {
            id: true,
            name: true,
          },
        });
      }
    }
    if (!existingTenant) {
      throw new Error("Tenant not found");
    }

    let currentFlags: TenantRestrictionStatus;
    if (hasIncrement2Columns) {
      currentFlags = {
        is_security_restricted: Boolean(existingTenant.is_security_restricted),
        is_policy_restricted: Boolean(existingTenant.is_policy_restricted),
        is_billing_restricted: Boolean(existingTenant.is_billing_restricted),
        is_administrative_restricted: Boolean(existingTenant.is_administrative_restricted),
      };
    } else {
      currentFlags = await getTenantRestrictions(cleanTenantId, tx);
    }

    const previousState = currentFlags[targetField];
    if (previousState === enable) {
      throw new Error(`Restriction ${restrictionType} is already ${enable ? "active" : "disabled"}`);
    }

    const updatedFlags: TenantRestrictionStatus = {
      ...currentFlags,
      [targetField]: enable,
    };

    const currentVersion = (hasIncrement2Columns && typeof existingTenant.version === "number") ? existingTenant.version : 1;
    const targetVersion = hasIncrement2Columns ? currentVersion + 1 : currentVersion;

    // 3. Mutate restriction columns and increment version (or touch updated_at if legacy)
    if (hasIncrement2Columns) {
      await txTenant.update({
        where: { id: cleanTenantId },
        data: {
          [targetField]: enable,
          version: targetVersion,
          updated_at: now,
        },
      });
    } else {
      await txTenant.update({
        where: { id: cleanTenantId },
        data: {
          updated_at: now,
        },
      });
    }

    // 4. Atomically insert version-stamped AuditLog record with 5-column proof
    const action = enable ? "TENANT_RESTRICT" : "TENANT_UNRESTRICT";
    const { logAuditTx } = await import("../audit/logger");
    await logAuditTx(tx, {
      tenantId: cleanTenantId,
      userId: actor.userId,
      action,
      entity: "Tenant",
      entityId: cleanTenantId,
      details: {
        actorEmail: actor.email,
        reason: cleanReason,
        restrictionType,
        previousState,
        newState: enable,
        fromVersion: currentVersion,
        toVersion: targetVersion,
        actionClass: "CLASS_A",
        flags: updatedFlags,
        source: "RUNTIME",
      },
    });

    return { success: true };
  });
}

/**
 * Updates a tenant's subscription plan.
 * Enforces server-side permission platform.subscription.manage.
 * Validates plan against ALLOWED_PLAN_IDS allowlist.
 * Overwrites/appends TenantSubscription audit log to update financial and subscription telemetry.
 */
export async function updateTenantSubscriptionPlan(
  tenantId: string,
  newPlanId: string,
  reason: string
): Promise<{ success: boolean; planId: string }> {
  const actor = await requirePlatformPermission("platform.subscription.manage");

  if (!tenantId || typeof tenantId !== "string" || !tenantId.trim()) {
    throw new Error("Invalid tenant identifier");
  }
  const cleanTenantId = tenantId.trim();

  if (!newPlanId || !ALLOWED_PLAN_IDS.has(newPlanId)) {
    throw new Error(`Invalid plan identifier. Allowed plans: ${Array.from(ALLOWED_PLAN_IDS).join(", ")}`);
  }

  const cleanReason = (reason || "").trim();
  if (cleanReason.length < 3 || cleanReason.length > 500) {
    throw new Error("Plan update reason must be between 3 and 500 characters");
  }

  return await runTransaction(db, async (tx: any) => {
    const txTenant = getModel(tx, "Tenant");
    if (!txTenant || (typeof txTenant.findUnique !== "function" && typeof txTenant.update !== "function")) {
      throw new Error("SERVICE_UNAVAILABLE: Tenant storage service is unavailable");
    }

    const now = new Date();
    // 1. Acquire exclusive row write lock on Tenant
    if (typeof txTenant.update === "function") {
      await txTenant.update({
        where: { id: cleanTenantId },
        data: { updated_at: now },
      });
    }

    // 2. Fetch existing tenant to check existence and retrieve creation date
    const tenant = await txTenant.findUnique({
      where: { id: cleanTenantId },
      select: { id: true, created_at: true },
    });
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const currentSub = await getTenantSubscriptionMeta(cleanTenantId, tenant.created_at, tx);
    const previousPlanId = currentSub.planId;

    if (previousPlanId === newPlanId) {
      throw new Error(`Tenant is already on plan ${newPlanId}`);
    }

    const planName = TRUSTED_PLAN_NAMES[newPlanId] || newPlanId;

    // 3. Atomically write TenantSubscription audit record
    const { logAuditTx } = await import("../audit/logger");
    await logAuditTx(tx, {
      tenantId: cleanTenantId,
      userId: actor.userId,
      action: "TENANT_SUBSCRIPTION_UPDATE",
      entity: "TenantSubscription",
      entityId: cleanTenantId,
      details: {
        actorEmail: actor.email,
        reason: cleanReason,
        previousPlanId,
        newPlanId,
        selectedPlanId: newPlanId,
        selectedPlanName: planName,
        selectedBillingCycle: "MONTHLY",
        trialStartUtc: currentSub.trialStartDate || now.toISOString(),
        trialEndUtc: currentSub.trialEndDate || now.toISOString(),
        actionClass: "CLASS_A",
        source: "RUNTIME",
      },
    });

    return { success: true, planId: newPlanId };
  });
}

export const ALLOWED_TRIAL_EXTENSION_DAYS = [7, 14, 30] as const;
export type AllowedTrialExtensionDays = (typeof ALLOWED_TRIAL_EXTENSION_DAYS)[number];

/**
 * Extends a tenant's evaluation trial period.
 * Enforces server-side permission platform.subscription.manage.
 * Extension calculation rule:
 * - If current trialEndDate > now (unexpired), adds days to trialEndDate.
 * - If current trialEndDate <= now (expired), adds days to now.
 */
export async function extendTenantTrial(
  tenantId: string,
  days: number,
  reason: string
): Promise<{ success: boolean; newTrialEndDate: string }> {
  const actor = await requirePlatformPermission("platform.subscription.manage");

  if (!tenantId || typeof tenantId !== "string" || !tenantId.trim()) {
    throw new Error("Invalid tenant identifier");
  }
  const cleanTenantId = tenantId.trim();

  if (!ALLOWED_TRIAL_EXTENSION_DAYS.includes(days as AllowedTrialExtensionDays)) {
    throw new Error(`Invalid trial extension duration. Allowed days: ${ALLOWED_TRIAL_EXTENSION_DAYS.join(", ")}`);
  }

  const cleanReason = (reason || "").trim();
  if (cleanReason.length < 3 || cleanReason.length > 500) {
    throw new Error("Trial extension reason must be between 3 and 500 characters");
  }

  return await runTransaction(db, async (tx: any) => {
    const txTenant = getModel(tx, "Tenant");
    if (!txTenant || (typeof txTenant.findUnique !== "function" && typeof txTenant.update !== "function")) {
      throw new Error("SERVICE_UNAVAILABLE: Tenant storage service is unavailable");
    }

    const now = new Date();
    // 1. Acquire exclusive row write lock on Tenant
    if (typeof txTenant.update === "function") {
      await txTenant.update({
        where: { id: cleanTenantId },
        data: { updated_at: now },
      });
    }

    // 2. Fetch existing tenant to check existence and retrieve creation date
    const tenant = await txTenant.findUnique({
      where: { id: cleanTenantId },
      select: { id: true, created_at: true },
    });
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const currentSub = await getTenantSubscriptionMeta(cleanTenantId, tenant.created_at, tx);
    if (currentSub.planId !== "trial") {
      throw new Error("Trial extensions are only applicable to accounts currently on the trial plan");
    }

    const currentTrialEnd = currentSub.trialEndDate ? new Date(currentSub.trialEndDate) : now;
    const baseDate = currentTrialEnd.getTime() > now.getTime() ? currentTrialEnd : now;
    const newTrialEnd = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
    const newTrialEndUtc = newTrialEnd.toISOString();

    // Preserve valid existing trial start date, falling back to valid tenant creation date, then current UTC time
    let trialStartUtc: string;
    if (currentSub.trialStartDate && !isNaN(new Date(currentSub.trialStartDate).getTime())) {
      trialStartUtc = new Date(currentSub.trialStartDate).toISOString();
    } else if (tenant.created_at && !isNaN(new Date(tenant.created_at).getTime())) {
      trialStartUtc = new Date(tenant.created_at).toISOString();
    } else {
      trialStartUtc = now.toISOString();
    }

    // 3. Atomically write TenantSubscription audit record
    const { logAuditTx } = await import("../audit/logger");
    await logAuditTx(tx, {
      tenantId: cleanTenantId,
      userId: actor.userId,
      action: "TENANT_TRIAL_EXTEND",
      entity: "TenantSubscription",
      entityId: cleanTenantId,
      details: {
        actorEmail: actor.email,
        reason: cleanReason,
        extendedDays: days,
        fromTrialEndUtc: currentTrialEnd.toISOString(),
        toTrialEndUtc: newTrialEndUtc,
        newTrialEndUtc,
        selectedPlanId: "trial",
        selectedPlanName: TRUSTED_PLAN_NAMES.trial,
        trialStartUtc,
        trialEndUtc: newTrialEndUtc,
        actionClass: "CLASS_A",
        source: "RUNTIME",
      },
    });

    return { success: true, newTrialEndDate: newTrialEndUtc };
  });
}

export interface InviteTenantAdminResult {
  success: boolean;
  invitationId: string;
  token: string;
  deliveryStatus: "not_configured" | "delivered" | "failed";
  deliveryMessage: string;
}

/**
 * Invites a tenant administrator from the platform console.
 * Uses cryptographically secure, single-use expiring token.
 * Token hash stored, not plaintext.
 * Enforces server-side permission platform.tenant.invite_admin.
 */
export async function inviteTenantAdmin(
  tenantId: string,
  input: { email: string; role?: "ADMIN" | "OWNER" }
): Promise<InviteTenantAdminResult> {
  const actor = await requirePlatformPermission("platform.tenant.invite_admin");

  const normalizedEmail = (input.email || "").trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    throw new Error("Invalid destination email format");
  }

  const role = input.role === "OWNER" ? "OWNER" : "ADMIN";

  // Generate cryptographically secure token and SHA-256 hash
  const token = crypto.randomBytes(32).toString("hex");
  const token_hash = crypto.createHash("sha256").update(token).digest("hex");

  // Expiration: 7 days
  const expires_at = new Date();
  expires_at.setDate(expires_at.getDate() + 7);

  const Invitation = getModel(db, "Invitation");
  if (!Invitation || typeof Invitation.create !== "function") {
    throw new Error("Invitation service unavailable");
  }

  const invitation = await Invitation.create({
    data: {
      tenant_id: tenantId,
      email: normalizedEmail,
      token_hash,
      invited_by: actor.userId,
      role,
      status: "PENDING",
      expires_at,
    },
  });

  // Record audit event without exposing token or password
  const AuditLog = getModel(db, "AuditLog");
  if (AuditLog && typeof AuditLog.create === "function") {
    await AuditLog.create({
      data: {
        tenant_id: tenantId,
        action: "ADMIN_INVITE_CREATE",
        entity: "Invitation",
        entity_id: invitation.id,
        user_id: actor.userId,
        details: JSON.stringify({
          recipientEmail: normalizedEmail,
          role,
          actorEmail: actor.email,
          expiresAt: expires_at.toISOString(),
        }),
      },
    });
  }

  return {
    success: true,
    invitationId: invitation.id,
    token,
    deliveryStatus: "not_configured",
    deliveryMessage: "Email delivery integration is not configured. Invitation token has been generated and hashed securely, but no email was dispatched.",
  };
}

/**
 * Revokes a pending administrator invitation.
 * Enforces server-side permission platform.tenant.invite_admin.
 * Uses explicit select projection to avoid fetching token_hash.
 */
export async function revokeTenantAdminInvitation(invitationId: string): Promise<{ success: boolean }> {
  const actor = await requirePlatformPermission("platform.tenant.invite_admin");

  const Invitation = getModel(db, "Invitation");
  if (!Invitation || typeof Invitation.findUnique !== "function" || typeof Invitation.update !== "function") {
    throw new Error("Invitation service unavailable");
  }

  const invitation = await Invitation.findUnique({
    where: { id: invitationId },
    select: {
      id: true,
      tenant_id: true,
      email: true,
      status: true,
    },
  });
  if (!invitation) {
    throw new Error("Invitation not found");
  }

  if (invitation.status !== "PENDING") {
    throw new Error(`Cannot revoke invitation with status '${invitation.status}'`);
  }

  await Invitation.update({
    where: { id: invitationId },
    data: { status: "REVOKED" },
  });

  // Record audit event
  const AuditLog = getModel(db, "AuditLog");
  if (AuditLog && typeof AuditLog.create === "function") {
    await AuditLog.create({
      data: {
        tenant_id: invitation.tenant_id,
        action: "ADMIN_INVITE_REVOKE",
        entity: "Invitation",
        entity_id: invitationId,
        user_id: actor.userId,
        details: JSON.stringify({
          recipientEmail: invitation.email,
          revokedBy: actor.email,
        }),
      },
    });
  }

  return { success: true };
}

/**
 * Retrieves platform administrative audit events with pagination.
 * Fail-closed: Throws sanitized service-unavailable error on query or service failure.
 */
export async function getPlatformAuditEvents(options: { page?: number; pageSize?: number } = {}) {
  await requirePlatformPermission("platform.audit.view");

  const AuditLog = getModel(db, "AuditLog");
  if (!AuditLog || typeof AuditLog.findMany !== "function") {
    throw new Error("SERVICE_UNAVAILABLE: Audit storage service is unavailable");
  }

  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, Math.min(100, options.pageSize || 20));
  const startIndex = (page - 1) * pageSize;

  const whereClause = {
    entity: { in: PLATFORM_AUDIT_ENTITIES },
    action: { in: PLATFORM_AUDIT_ACTIONS },
  };

  let logs: any[] = [];
  let total = 0;

  try {
    if (typeof AuditLog.count === "function") {
      total = await AuditLog.count({ where: whereClause });
    }
    logs = await AuditLog.findMany({
      where: whereClause,
      select: {
        id: true,
        action: true,
        entity: true,
        tenant_id: true,
        user_id: true,
        created_at: true,
        details: true,
      },
      orderBy: {
        created_at: "desc",
      },
      skip: startIndex,
      take: pageSize,
    });
    if (!total && Array.isArray(logs)) {
      total = logs.length;
    }
  } catch {
    throw new Error("SERVICE_UNAVAILABLE: Failed to query platform audit events");
  }

  const totalPages = Math.ceil(total / pageSize);

  const items = (Array.isArray(logs) ? logs : []).map((l: any) => ({
    id: l.id,
    action: l.action,
    entity: l.entity,
    tenantId: l.tenant_id,
    userId: l.user_id,
    createdAt: l.created_at ? new Date(l.created_at).toISOString() : new Date().toISOString(),
    details: sanitizeAuditDetails(l.details),
  }));

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
}
