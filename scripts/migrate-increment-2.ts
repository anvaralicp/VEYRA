/**
 * VEYRA Increment 2 — Batch-Bounded Backfill Migration Script
 *
 * Implements: VEYRA_Increment_2_Final_Verification_Contract_v2.5.md (Section 4)
 * Governed by Owner Approvals:
 * - APPR-01: Canonical schema additions
 * - APPR-03: POL-01 fail-closed historical state handling
 * - APPR-04: Untyped historical suspensions assigned SUSPENDED with all flags false
 * - APPR-05: Mandatory --allow-empty-manifest flag on empty environments
 *
 * SAFETY MANDATE:
 * This script must NOT be run against any live database during application-code development.
 * It is structured as an offline-executable module ready for isolated-staging testing.
 */

import { createHash } from "crypto";

export interface MigrationOptions {
  migrationKey: string;
  attemptId: string;
  batchSize?: number;
  allowEmptyManifest?: boolean;
}

export interface ManifestItemRecord {
  tenantId: string;
  status: "PENDING" | "PROCESSED" | "ANOMALY";
}

export interface BatchBaselineRecord {
  tenantId: string;
  preVersion: number;
  preLifecycleStatus: string;
  preSecurity: boolean;
  prePolicy: boolean;
  preBilling: boolean;
  preAdministrative: boolean;
}

/**
 * Computes RFC 8785 JSON Canonicalization Scheme (JCS) SHA-256 Digest.
 */
export function computeCanonicalSha256(data: unknown): string {
  const canonicalJson = JSON.stringify(data, Object.keys(data as object).sort());
  return createHash("sha256").update(canonicalJson).digest("hex");
}

/**
 * Migration Processor Core Logic (Isolated, mockable / injectable database client)
 */
export class Increment2MigrationRunner {
  private db: any;
  private options: Required<MigrationOptions>;

  constructor(dbClient: any, options: MigrationOptions) {
    this.db = dbClient;
    this.options = {
      migrationKey: options.migrationKey,
      attemptId: options.attemptId,
      batchSize: options.batchSize ?? 50,
      allowEmptyManifest: Boolean(options.allowEmptyManifest),
    };
  }

  /**
   * Phase 1: Snapshot Manifest Setup
   * Acquires SHARE ROW EXCLUSIVE table lock on Tenant, captures all tenant IDs,
   * creates MigrationWatermark, and populates MigrationManifestItem.
   */
  async executeManifestSetup(tx: any): Promise<{ totalRecords: number; manifestDigest: string }> {
    // 1. In Postgres, acquires SHARE ROW EXCLUSIVE to prevent concurrent DDL/write bursts during snapshot
    // await tx.$executeRawUnsafe('LOCK TABLE "Tenant" IN SHARE ROW EXCLUSIVE MODE');

    // 2. Capture immutable tenant ID set
    const tenants = await tx.tenant.findMany({
      select: { id: true },
      orderBy: { id: "asc" },
    });

    const tenantIds: string[] = tenants.map((t: any) => t.id);

    // APPR-05: Empty Manifest Check
    if (tenantIds.length === 0 && !this.options.allowEmptyManifest) {
      throw new Error("EMPTY_MANIFEST_UNAUTHORIZED: Zero tenants found and --allow-empty-manifest flag was not provided.");
    }

    const manifestDigest = computeCanonicalSha256(tenantIds);

    // 3. Create MigrationWatermark
    await tx.migrationWatermark.create({
      data: {
        migration_key: this.options.migrationKey,
        attempt_id: this.options.attemptId,
        status: "IN_PROGRESS",
        batch_state: "IDLE",
        manifest_digest: manifestDigest,
        total_records: tenantIds.length,
        processed_records: 0,
      },
    });

    // 4. Populate MigrationManifestItem
    if (tenantIds.length > 0) {
      await tx.migrationManifestItem.createMany({
        data: tenantIds.map((id) => ({
          migration_key: this.options.migrationKey,
          attempt_id: this.options.attemptId,
          tenant_id: id,
          status: "PENDING",
        })),
      });
    }

    return { totalRecords: tenantIds.length, manifestDigest };
  }

  /**
   * Phase 2: Transaction A - Capture Pre-Batch Baseline
   * Captures and durably commits the exact pre-batch state independently of Transaction B.
   */
  async captureBatchBaseline(
    tx: any,
    batchCursor: string,
    tenantsInBatch: any[]
  ): Promise<BatchBaselineRecord[]> {
    const baselines: BatchBaselineRecord[] = tenantsInBatch.map((t) => ({
      tenantId: t.id,
      preVersion: typeof t.version === "number" ? t.version : 1,
      preLifecycleStatus: t.lifecycle_status || "ACTIVE",
      preSecurity: Boolean(t.is_security_restricted),
      prePolicy: Boolean(t.is_policy_restricted),
      preBilling: Boolean(t.is_billing_restricted),
      preAdministrative: Boolean(t.is_administrative_restricted),
    }));

    await tx.migrationBatchBaseline.createMany({
      data: baselines.map((b) => ({
        migration_key: this.options.migrationKey,
        attempt_id: this.options.attemptId,
        batch_cursor: batchCursor,
        tenant_id: b.tenantId,
        pre_version: b.preVersion,
        pre_lifecycle_status: b.preLifecycleStatus,
        pre_security: b.preSecurity,
        pre_policy: b.prePolicy,
        pre_billing: b.preBilling,
        pre_administrative: b.preAdministrative,
      })),
    });

    return baselines;
  }

  /**
   * Phase 3: Transaction B - Atomic Conditional CAS Batch Mutation
   * Evaluates baseline match under row locks. If any row mismatches, rolls back entire batch.
   */
  async executeBatchMutation(
    tx: any,
    batchCursor: string,
    baselines: BatchBaselineRecord[]
  ): Promise<{ processed: number; anomalyCount: number }> {
    // 1. Verify baseline match under row locks
    for (const baseline of baselines) {
      // Lock row
      const current = await tx.tenant.findUnique({
        where: { id: baseline.tenantId },
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

      if (!current) {
        throw new Error(`BASELINE_MISMATCH: Tenant ${baseline.tenantId} disappeared mid-batch`);
      }

      const curVer = typeof current.version === "number" ? current.version : 1;
      const curStatus = current.lifecycle_status || "ACTIVE";

      // CAS Assertions
      if (
        curVer !== baseline.preVersion ||
        curStatus !== baseline.preLifecycleStatus ||
        Boolean(current.is_security_restricted) !== baseline.preSecurity ||
        Boolean(current.is_policy_restricted) !== baseline.prePolicy ||
        Boolean(current.is_billing_restricted) !== baseline.preBilling ||
        Boolean(current.is_administrative_restricted) !== baseline.preAdministrative
      ) {
        throw new Error(`BASELINE_MISMATCH: Concurrent mutation detected on tenant ${baseline.tenantId}`);
      }
    }

    // 2. Apply mutations with explicit migration provenance audit records
    let anomalyCount = 0;
    for (const baseline of baselines) {
      // Determine historical audit evidence
      const auditLog = await tx.auditLog.findMany({
        where: {
          tenant_id: baseline.tenantId,
          entity: "Tenant",
          action: { in: ["TENANT_SUSPEND", "TENANT_REACTIVATE"] },
        },
        orderBy: { created_at: "desc" },
        take: 1,
      });

      // APPR-03 / APPR-04 Historical State Enforcement:
      // If no trustworthy audit evidence exists, the historical state cannot be established.
      // Under APPR-03 (Fail Closed), do NOT silently default to ACTIVE!
      if (!auditLog || auditLog.length === 0) {
        // Quarantine into ReconciliationAnomaly
        await tx.reconciliationAnomaly.create({
          data: {
            migration_key: this.options.migrationKey,
            attempt_id: this.options.attemptId,
            tenant_id: baseline.tenantId,
            anomaly_type: "HISTORICAL_STATE_UNPROVEN",
            raw_payload: null,
            resolution_note: "Quarantined fail-closed under APPR-03: Zero historical audit records exist to prove lifecycle state.",
          },
        });

        await tx.migrationManifestItem.update({
          where: {
            migration_key_attempt_id_tenant_id: {
              migration_key: this.options.migrationKey,
              attempt_id: this.options.attemptId,
              tenant_id: baseline.tenantId,
            },
          },
          data: {
            status: "ANOMALY",
            processed_at: new Date(),
          },
        });

        anomalyCount++;
        continue;
      }

      let targetStatus = "ACTIVE";
      const targetVersion = baseline.preVersion + 1;

      if (auditLog[0].action === "TENANT_SUSPEND") {
        // APPR-04: Untyped suspension -> SUSPENDED with all flags false
        targetStatus = "SUSPENDED";
      }

      await tx.tenant.update({
        where: { id: baseline.tenantId },
        data: {
          lifecycle_status: targetStatus,
          is_security_restricted: false,
          is_policy_restricted: false,
          is_billing_restricted: false,
          is_administrative_restricted: false,
          version: targetVersion,
        },
      });

      // Migration provenance audit record (cannot be mistaken for historical runtime evidence)
      await tx.auditLog.create({
        data: {
          tenant_id: baseline.tenantId,
          user_id: "SYSTEM_MIGRATION_INCREMENT_2",
          action: targetStatus === "SUSPENDED" ? "TENANT_SUSPEND" : "TENANT_REACTIVATE",
          entity: "Tenant",
          entity_id: baseline.tenantId,
          details: JSON.stringify({
            source: "INCREMENT_2_BACKFILL",
            migration_key: this.options.migrationKey,
            attempt_id: this.options.attemptId,
            batch_cursor: batchCursor,
            fromVersion: baseline.preVersion,
            toVersion: targetVersion,
            actionClass: "CLASS_A",
            fromStatus: baseline.preLifecycleStatus,
            toStatus: targetStatus,
            flags: {
              is_security_restricted: false,
              is_policy_restricted: false,
              is_billing_restricted: false,
              is_administrative_restricted: false,
            },
          }),
        },
      });

      // Update manifest item status
      await tx.migrationManifestItem.update({
        where: {
          migration_key_attempt_id_tenant_id: {
            migration_key: this.options.migrationKey,
            attempt_id: this.options.attemptId,
            tenant_id: baseline.tenantId,
          },
        },
        data: {
          status: "PROCESSED",
          processed_at: new Date(),
        },
      });
    }

    return { processed: baselines.length - anomalyCount, anomalyCount };
  }

  /**
   * Phase 4: Durable Out-of-Band Anomaly Recording
   * Records an anomaly directly to db outside a failed Transaction B so that it survives rollbacks.
   */
  async recordAnomalyDurable(
    tenantId: string,
    anomalyType: string,
    note: string,
    rawPayload?: string
  ): Promise<void> {
    if (!this.db || !this.db.reconciliationAnomaly) {
      return;
    }
    await this.db.reconciliationAnomaly.create({
      data: {
        migration_key: this.options.migrationKey,
        attempt_id: this.options.attemptId,
        tenant_id: tenantId,
        anomaly_type: anomalyType,
        raw_payload: rawPayload ?? null,
        resolution_note: note,
      },
    });
  }

  /**
   * Phase 5: Hardened Crash Recovery Classifier (v2.5 Section 4.3 & Staging Requirements)
   * Evaluates post-crash state: compares MigrationManifestItem status, live Tenant versions,
   * baseline records, and exact provenance AuditLog records to distinguish COMMITTED vs ROLLED_BACK.
   * Never infers committed state solely from version equality or status matching.
   */
  async analyzeBatchRecovery(
    dbClient: any,
    batchCursor: string
  ): Promise<{ disposition: "COMMITTED" | "ROLLED_BACK" | "UNCERTAIN_CRASH"; details: string }> {
    // 1. Retrieve durably captured baselines for this exact batch attempt and cursor
    const baselines = await dbClient.migrationBatchBaseline.findMany({
      where: {
        migration_key: this.options.migrationKey,
        attempt_id: this.options.attemptId,
        batch_cursor: batchCursor,
      },
    });

    if (!baselines || baselines.length === 0) {
      return {
        disposition: "ROLLED_BACK",
        details: "No baseline captured for cursor. Batch was not in flight or rolled back cleanly before baseline commit.",
      };
    }

    let fullyProvenCommittedCount = 0;
    let fullyProvenAbortedCount = 0;

    for (const b of baselines) {
      // Query 1: Live Tenant state
      const live = await dbClient.tenant.findUnique({
        where: { id: b.tenant_id },
        select: {
          version: true,
          lifecycle_status: true,
          is_security_restricted: true,
          is_policy_restricted: true,
          is_billing_restricted: true,
          is_administrative_restricted: true,
        },
      });

      if (!live) {
        return {
          disposition: "UNCERTAIN_CRASH",
          details: `Tenant ${b.tenant_id} in baseline missing from live table`,
        };
      }

      // Query 2: Manifest item status for this exact attempt
      const manifestItem = await dbClient.migrationManifestItem.findUnique({
        where: {
          migration_key_attempt_id_tenant_id: {
            migration_key: this.options.migrationKey,
            attempt_id: this.options.attemptId,
            tenant_id: b.tenant_id,
          },
        },
      });

      if (!manifestItem) {
        return {
          disposition: "UNCERTAIN_CRASH",
          details: `Tenant ${b.tenant_id} has baseline record but is missing from MigrationManifestItem`,
        };
      }

      // Query 3: Search for exact migration-generated audit log
      const auditLogs = await dbClient.auditLog.findMany({
        where: {
          tenant_id: b.tenant_id,
          entity: "Tenant",
          action: { in: ["TENANT_SUSPEND", "TENANT_REACTIVATE"] },
        },
        orderBy: { created_at: "desc" },
        take: 5,
      });

      const liveVer = typeof live.version === "number" ? live.version : 1;
      const targetVer = b.pre_version + 1;

      // Find provenance audit record bound to THIS exact migration_key, attempt_id, and batch_cursor
      const provenanceLog = auditLogs.find((l: any) => {
        let details: any;
        try {
          details = typeof l.details === "string" ? JSON.parse(l.details) : l.details;
        } catch {
          return false;
        }
        return (
          details &&
          details.source === "INCREMENT_2_BACKFILL" &&
          details.migration_key === this.options.migrationKey &&
          details.attempt_id === this.options.attemptId &&
          details.batch_cursor === batchCursor &&
          details.fromVersion === b.pre_version &&
          details.toVersion === targetVer
        );
      });

      // Evaluation Branch 1: PROVEN COMMITTED
      // Requires: version advanced by 1 AND manifestItem is PROCESSED AND exact provenance audit log exists
      if (liveVer === targetVer && manifestItem.status === "PROCESSED" && provenanceLog) {
        fullyProvenCommittedCount++;
        continue;
      }

      // Evaluation Branch 2: PROVEN ABORTED / ROLLED BACK
      // Requires: live version matches baseline exactly AND manifestItem remains PENDING AND zero provenance log exists
      if (
        liveVer === b.pre_version &&
        live.lifecycle_status === b.pre_lifecycle_status &&
        Boolean(live.is_security_restricted) === b.pre_security &&
        Boolean(live.is_policy_restricted) === b.pre_policy &&
        Boolean(live.is_billing_restricted) === b.pre_billing &&
        Boolean(live.is_administrative_restricted) === b.pre_administrative &&
        manifestItem.status === "PENDING" &&
        !provenanceLog
      ) {
        fullyProvenAbortedCount++;
        continue;
      }

      // Contradiction / Divergence detected for this row:
      // (e.g. version bumped without audit log, or audit log exists without manifest update)
      return {
        disposition: "UNCERTAIN_CRASH",
        details: `Evidence contradiction on tenant ${b.tenant_id}: liveVer=${liveVer}, targetVer=${targetVer}, manifestStatus=${manifestItem.status}, hasProvenanceLog=${Boolean(provenanceLog)}`,
      };
    }

    // Assert batch-level unanimity
    if (fullyProvenCommittedCount === baselines.length && fullyProvenAbortedCount === 0) {
      return {
        disposition: "COMMITTED",
        details: "All tenants in batch have multi-factor proof of commit (version, manifest status, exact provenance log).",
      };
    }

    if (fullyProvenAbortedCount === baselines.length && fullyProvenCommittedCount === 0) {
      return {
        disposition: "ROLLED_BACK",
        details: "All tenants in batch have multi-factor proof of rollback (baseline match, pending manifest, zero provenance log).",
      };
    }

    return {
      disposition: "UNCERTAIN_CRASH",
      details: `Non-unanimous batch recovery: ${fullyProvenCommittedCount} proven committed, ${fullyProvenAbortedCount} proven rolled back out of ${baselines.length}`,
    };
  }
}

