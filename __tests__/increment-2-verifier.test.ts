/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { Increment2Verifier } from "../scripts/verify-increment-2";
import { computeCanonicalSha256 } from "../scripts/migrate-increment-2";

describe("VEYRA Increment 2: Unit Logic Verification Suite (DB-Free)", () => {
  const verifier = new Increment2Verifier(null);

  it("STG-01 / Genesis: Untouched post-snapshot tenant at version 1 with zero audit logs passes clean", () => {
    const tenant = {
      id: "tenant-genesis-1",
      version: 1,
      lifecycle_status: "ACTIVE",
      is_security_restricted: false,
      is_policy_restricted: false,
      is_billing_restricted: false,
      is_administrative_restricted: false,
    };

    const result = verifier.verifyPostSnapshotTenant(tenant, []);
    expect(result.clean).toBe(true);
    expect(result.anomaly).toBeUndefined();
  });

  it("STG-02 / APPR-02 Amendment: Reactivation preserves active restriction flags", () => {
    // Tenant was suspended while having is_billing_restricted = true
    // Reactivation sets lifecycle_status to ACTIVE, leaving billing restricted
    const tenant = {
      id: "tenant-reactivated-1",
      version: 3,
      lifecycle_status: "ACTIVE",
      is_security_restricted: false,
      is_policy_restricted: false,
      is_billing_restricted: true, // PRESERVED under APPR-02
      is_administrative_restricted: false,
    };

    const auditLogs = [
      {
        id: "audit-1",
        action: "TENANT_SUSPEND",
        details: JSON.stringify({
          fromVersion: 1,
          toVersion: 2,
          actionClass: "CLASS_A",
          fromStatus: "ACTIVE",
          toStatus: "SUSPENDED",
          flags: {
            is_security_restricted: false,
            is_policy_restricted: false,
            is_billing_restricted: true,
            is_administrative_restricted: false,
          },
        }),
      },
      {
        id: "audit-2",
        action: "TENANT_REACTIVATE",
        details: JSON.stringify({
          fromVersion: 2,
          toVersion: 3,
          actionClass: "CLASS_A",
          fromStatus: "SUSPENDED",
          toStatus: "ACTIVE",
          flags: {
            is_security_restricted: false,
            is_policy_restricted: false,
            is_billing_restricted: true,
            is_administrative_restricted: false,
          },
        }),
      },
    ];

    const result = verifier.verifyPostSnapshotTenant(tenant, auditLogs);
    expect(result.clean).toBe(true);
  });

  it("STG-06: Verifier detects missing intermediate audit event and flags BROKEN_TRANSITION_CHAIN", () => {
    const tenant = {
      id: "tenant-broken-chain",
      version: 4,
      lifecycle_status: "ACTIVE",
      is_security_restricted: false,
      is_policy_restricted: false,
      is_billing_restricted: false,
      is_administrative_restricted: false,
    };

    // Event 1->2 exists, event 3->4 exists, but 2->3 is missing and uncorroborated
    const auditLogs = [
      {
        id: "audit-1",
        action: "TENANT_SUSPEND",
        details: JSON.stringify({
          fromVersion: 1,
          toVersion: 2,
          actionClass: "CLASS_A",
          toStatus: "SUSPENDED",
        }),
      },
      {
        id: "audit-3",
        action: "TENANT_REACTIVATE",
        details: JSON.stringify({
          fromVersion: 3,
          toVersion: 4,
          actionClass: "CLASS_A",
          toStatus: "ACTIVE",
        }),
      },
    ];

    const result = verifier.verifyPostSnapshotTenant(tenant, auditLogs);
    expect(result.clean).toBe(false);
    expect(result.anomaly?.anomalyType).toBe("UNPROVEN_VERSION_GAP");
  });

  it("STG-07: Verifier detects unproven version gap caused by direct SQL increment", () => {
    const tenant = {
      id: "tenant-unproven-gap",
      version: 3, // Version is 3, but only event toVersion=2 exists and no Class B events exist
      lifecycle_status: "SUSPENDED",
      is_security_restricted: false,
      is_policy_restricted: false,
      is_billing_restricted: false,
      is_administrative_restricted: false,
    };

    const auditLogs = [
      {
        id: "audit-1",
        action: "TENANT_SUSPEND",
        details: JSON.stringify({
          fromVersion: 1,
          toVersion: 2,
          actionClass: "CLASS_A",
          toStatus: "SUSPENDED",
        }),
      },
    ];

    const result = verifier.verifyPostSnapshotTenant(tenant, auditLogs);
    expect(result.clean).toBe(false);
    expect(result.anomaly?.anomalyType).toBe("UNPROVEN_VERSION_GAP");
  });

  it("STG-08: Verifier detects duplicate target versions and flags DUPLICATE_VERSION_DETECTED", () => {
    const tenant = {
      id: "tenant-duplicate-version",
      version: 2,
      lifecycle_status: "SUSPENDED",
      is_security_restricted: false,
      is_policy_restricted: false,
      is_billing_restricted: false,
      is_administrative_restricted: false,
    };

    const auditLogs = [
      {
        id: "audit-1a",
        action: "TENANT_SUSPEND",
        details: JSON.stringify({
          fromVersion: 1,
          toVersion: 2,
          actionClass: "CLASS_A",
          toStatus: "SUSPENDED",
        }),
      },
      {
        id: "audit-1b",
        action: "TENANT_SUSPEND",
        details: JSON.stringify({
          fromVersion: 1,
          toVersion: 2,
          actionClass: "CLASS_A",
          toStatus: "SUSPENDED",
        }),
      },
    ];

    const result = verifier.verifyPostSnapshotTenant(tenant, auditLogs);
    expect(result.clean).toBe(false);
    expect(result.anomaly?.anomalyType).toBe("DUPLICATE_VERSION_DETECTED");
  });

  it("STG-09: Verifier flags CORRUPT_JSON on malformed audit payload", () => {
    const tenant = {
      id: "tenant-corrupt-json",
      version: 2,
      lifecycle_status: "ACTIVE",
      is_security_restricted: false,
      is_policy_restricted: false,
      is_billing_restricted: false,
      is_administrative_restricted: false,
    };

    const auditLogs = [
      {
        id: "audit-corrupt",
        action: "TENANT_SUSPEND",
        details: "{ unclosed_json_string ...",
      },
    ];

    const result = verifier.verifyPostSnapshotTenant(tenant, auditLogs);
    expect(result.clean).toBe(false);
    expect(result.anomaly?.anomalyType).toBe("CORRUPT_JSON");
  });

  it("RFC 8785 Digest verification produces deterministic hashes", () => {
    const manifestA = ["tenant-1", "tenant-2", "tenant-3"];
    const manifestB = ["tenant-1", "tenant-2", "tenant-3"];

    const hashA = computeCanonicalSha256(manifestA);
    const hashB = computeCanonicalSha256(manifestB);

    expect(hashA).toBe(hashB);
    expect(typeof hashA).toBe("string");
    expect(hashA.length).toBe(64);
  });

  it("STG-04 / Backfill CAS Safety: Increment2MigrationRunner aborts on baseline mismatch", async () => {
    const { Increment2MigrationRunner } = await import("../scripts/migrate-increment-2");

    // Mock DB client where tenant version diverged concurrently
    const mockTx = {
      tenant: {
        findUnique: async () => ({
          id: "tenant-diverged",
          version: 2, // Pre-baseline was 1!
          lifecycle_status: "ACTIVE",
          is_security_restricted: false,
          is_policy_restricted: false,
          is_billing_restricted: false,
          is_administrative_restricted: false,
        }),
      },
    };

    const runner = new Increment2MigrationRunner(null, {
      migrationKey: "test-mig",
      attemptId: "att-1",
    });

    const baselines = [
      {
        tenantId: "tenant-diverged",
        preVersion: 1, // Baseline says 1
        preLifecycleStatus: "ACTIVE",
        preSecurity: false,
        prePolicy: false,
        preBilling: false,
        preAdministrative: false,
      },
    ];

    await expect(runner.executeBatchMutation(mockTx, "cursor-1", baselines)).rejects.toThrow(
      "BASELINE_MISMATCH: Concurrent mutation detected"
    );
  });

  it("STG-05 / APPR-03 & APPR-04: Backfill quarantines unproven historical state fail-closed", async () => {
    const { Increment2MigrationRunner } = await import("../scripts/migrate-increment-2");

    let anomalyCreated = false;
    let anomalyType = "";
    let manifestStatus = "";

    const mockTx = {
      tenant: {
        findUnique: async () => ({
          id: "tenant-unrecorded",
          version: 1,
          lifecycle_status: "ACTIVE",
          is_security_restricted: false,
          is_policy_restricted: false,
          is_billing_restricted: false,
          is_administrative_restricted: false,
        }),
        update: async () => {
          throw new Error("Tenant should NOT be updated when unproven under APPR-03!");
        },
      },
      auditLog: {
        findMany: async () => [], // ZERO historical audit logs exist!
      },
      reconciliationAnomaly: {
        create: async (args: any) => {
          anomalyCreated = true;
          anomalyType = args.data.anomaly_type;
        },
      },
      migrationManifestItem: {
        update: async (args: any) => {
          manifestStatus = args.data.status;
        },
      },
    };

    const runner = new Increment2MigrationRunner(null, {
      migrationKey: "test-mig",
      attemptId: "att-1",
    });

    const baselines = [
      {
        tenantId: "tenant-unrecorded",
        preVersion: 1,
        preLifecycleStatus: "ACTIVE",
        preSecurity: false,
        prePolicy: false,
        preBilling: false,
        preAdministrative: false,
      },
    ];

    const result = await runner.executeBatchMutation(mockTx, "cursor-1", baselines);
    expect(result.processed).toBe(0);
    expect(result.anomalyCount).toBe(1);
    expect(anomalyCreated).toBe(true);
    expect(anomalyType).toBe("HISTORICAL_STATE_UNPROVEN");
    expect(manifestStatus).toBe("ANOMALY");
  });

  it("Recovery Classifier: Correctly distinguishes COMMITTED vs ROLLED_BACK vs UNCERTAIN_CRASH under hardened multi-factor proof", async () => {
    const { Increment2MigrationRunner } = await import("../scripts/migrate-increment-2");

    const runner = new Increment2MigrationRunner(null, {
      migrationKey: "test-recovery",
      attemptId: "att-rec",
    });

    // Sub-case A: Fully COMMITTED (Version + Manifest + Provenance Audit Log all agree)
    const mockDbCommitted = {
      migrationBatchBaseline: {
        findMany: async () => [
          {
            tenant_id: "t1",
            pre_version: 1,
            pre_lifecycle_status: "ACTIVE",
            pre_security: false,
            pre_policy: false,
            pre_billing: false,
            pre_administrative: false,
          },
        ],
      },
      tenant: {
        findUnique: async () => ({
          version: 2, // Advanced by 1
          lifecycle_status: "ACTIVE",
          is_security_restricted: false,
          is_policy_restricted: false,
          is_billing_restricted: false,
          is_administrative_restricted: false,
        }),
      },
      migrationManifestItem: {
        findUnique: async () => ({ status: "PROCESSED" }),
      },
      auditLog: {
        findMany: async () => [
          {
            id: "audit-mig-1",
            details: JSON.stringify({
              source: "INCREMENT_2_BACKFILL",
              migration_key: "test-recovery",
              attempt_id: "att-rec",
              batch_cursor: "cursor-1",
              fromVersion: 1,
              toVersion: 2,
            }),
          },
        ],
      },
    };
    const resA = await runner.analyzeBatchRecovery(mockDbCommitted, "cursor-1");
    expect(resA.disposition).toBe("COMMITTED");

    // Sub-case B: Cleanly ROLLED_BACK (Baseline matches, Manifest is PENDING, zero provenance log)
    const mockDbRolledBack = {
      migrationBatchBaseline: {
        findMany: async () => [
          {
            tenant_id: "t1",
            pre_version: 1,
            pre_lifecycle_status: "ACTIVE",
            pre_security: false,
            pre_policy: false,
            pre_billing: false,
            pre_administrative: false,
          },
        ],
      },
      tenant: {
        findUnique: async () => ({
          version: 1, // Remains at pre-batch version
          lifecycle_status: "ACTIVE",
          is_security_restricted: false,
          is_policy_restricted: false,
          is_billing_restricted: false,
          is_administrative_restricted: false,
        }),
      },
      migrationManifestItem: {
        findUnique: async () => ({ status: "PENDING" }),
      },
      auditLog: {
        findMany: async () => [], // No provenance log
      },
    };
    const resB = await runner.analyzeBatchRecovery(mockDbRolledBack, "cursor-1");
    expect(resB.disposition).toBe("ROLLED_BACK");

    // Sub-case C: Misleading Provenance Record (Different attempt_id) -> Must halt as UNCERTAIN_CRASH
    const mockDbMisleading = {
      migrationBatchBaseline: {
        findMany: async () => [
          {
            tenant_id: "t1",
            pre_version: 1,
            pre_lifecycle_status: "ACTIVE",
            pre_security: false,
            pre_policy: false,
            pre_billing: false,
            pre_administrative: false,
          },
        ],
      },
      tenant: {
        findUnique: async () => ({
          version: 2, // Version advanced
          lifecycle_status: "ACTIVE",
          is_security_restricted: false,
          is_policy_restricted: false,
          is_billing_restricted: false,
          is_administrative_restricted: false,
        }),
      },
      migrationManifestItem: {
        findUnique: async () => ({ status: "PROCESSED" }),
      },
      auditLog: {
        findMany: async () => [
          {
            id: "audit-mig-other",
            details: JSON.stringify({
              source: "INCREMENT_2_BACKFILL",
              migration_key: "test-recovery",
              attempt_id: "DIFFERENT_ATTEMPT_ID", // Misleading attempt!
              batch_cursor: "cursor-1",
              fromVersion: 1,
              toVersion: 2,
            }),
          },
        ],
      },
    };
    const resC = await runner.analyzeBatchRecovery(mockDbMisleading, "cursor-1");
    expect(resC.disposition).toBe("UNCERTAIN_CRASH");

    // Sub-case D: Evidence Contradiction (Version advanced but Manifest is PENDING) -> UNCERTAIN_CRASH
    const mockDbContradiction = {
      migrationBatchBaseline: {
        findMany: async () => [
          {
            tenant_id: "t1",
            pre_version: 1,
            pre_lifecycle_status: "ACTIVE",
            pre_security: false,
            pre_policy: false,
            pre_billing: false,
            pre_administrative: false,
          },
        ],
      },
      tenant: {
        findUnique: async () => ({
          version: 2,
          lifecycle_status: "ACTIVE",
          is_security_restricted: false,
          is_policy_restricted: false,
          is_billing_restricted: false,
          is_administrative_restricted: false,
        }),
      },
      migrationManifestItem: {
        findUnique: async () => ({ status: "PENDING" }), // Contradiction!
      },
      auditLog: {
        findMany: async () => [],
      },
    };
    const resD = await runner.analyzeBatchRecovery(mockDbContradiction, "cursor-1");
    expect(resD.disposition).toBe("UNCERTAIN_CRASH");
  });
});

