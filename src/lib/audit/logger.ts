import { getTenantContext } from "../tenant/context";
import { getTenantDb } from "../db/tenant-db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function logAudit(action: string, entity: string, entityId?: string, details?: any) {
  try {
    const context = await getTenantContext();
    const db = await getTenantDb();

    await db.AuditLog.create({
      data: {
        action,
        entity,
        entity_id: entityId,
        user_id: context.userId,
        details: details ? JSON.stringify(details) : null
      }
    });
  } catch (error) {
    console.error("Audit log failed:", error);
    // Do not throw; audit logging shouldn't crash operations, but in strict environments it might.
  }
}

/**
 * Increment 2 Canonical Tenant Audit Payload Interface (Frozen v2.5 / APPR-01)
 */
export interface CanonicalTenantAuditFlags {
  is_security_restricted: boolean;
  is_policy_restricted: boolean;
  is_billing_restricted: boolean;
  is_administrative_restricted: boolean;
}

export interface CanonicalTenantAuditDetails {
  actorEmail?: string;
  reason?: string;
  fromVersion: number;
  toVersion: number; // Must equal fromVersion + 1
  actionClass: "CLASS_A" | "CLASS_B";
  fromStatus?: string;
  toStatus?: string;
  flags?: CanonicalTenantAuditFlags;
  updatedFields?: string[];
  source?: "RUNTIME" | "INCREMENT_2_BACKFILL" | "INCREMENT_2_RECONCILIATION";
  migration_key?: string;
  attempt_id?: string;
}

export interface LogAuditTxParams {
  tenantId: string;
  userId?: string | null;
  action: "TENANT_CREATE" | "TENANT_SUSPEND" | "TENANT_REACTIVATE" | "TENANT_RESTRICT" | "TENANT_UPDATE";
  entity: "Tenant";
  entityId: string;
  details: CanonicalTenantAuditDetails;
}

/**
 * Transactional, strictly non-swallowing audit logging for Tenant mutations.
 * Enforces atomic commit with Tenant column updates and version increments.
 * If writing to AuditLog fails, the exception propagates and aborts the parent transaction.
 */
export async function logAuditTx(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  params: LogAuditTxParams
): Promise<void> {
  const { getModel } = await import("../db/legacy-adapter");
  const AuditLog = getModel(tx, "AuditLog");
  if (!AuditLog || typeof AuditLog.create !== "function") {
    throw new Error("SERVICE_UNAVAILABLE: Audit storage service is unavailable for transactional audit logging");
  }

  // Strictly no try/catch: Any DB error or serialization failure MUST abort tx!
  await AuditLog.create({
    data: {
      tenant_id: params.tenantId,
      user_id: params.userId ?? null,
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId,
      details: JSON.stringify(params.details),
    },
  });
}
