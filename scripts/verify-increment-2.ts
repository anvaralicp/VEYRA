/**
 * VEYRA Increment 2 — Offline Post-Snapshot Transition-Chain Verifier
 *
 * Implements: VEYRA_Increment_2_Final_Verification_Contract_v2.5.md (Section 5)
 * Governed by Owner Approvals:
 * - APPR-01: Canonical schema verification
 * - APPR-02 (Amendment): Reactivation preserves restrictions
 * - APPR-03: Quarantine unproven historical records
 *
 * SAFETY MANDATE:
 * This script is strictly read-only and designed for execution during staging or
 * post-migration verification. It modifies zero tenant data.
 */

export interface VerificationAnomaly {
  tenantId: string;
  anomalyType:
    | "CORRUPT_JSON"
    | "BROKEN_TRANSITION_CHAIN"
    | "UNPROVEN_VERSION_GAP"
    | "DUPLICATE_VERSION_DETECTED"
    | "POST_SNAPSHOT_STATE_DIVERGENCE"
    | "HISTORICAL_STATE_UNPROVEN";
  rawPayload?: string;
  details: string;
}

export interface TransitionChainEvent {
  id: string;
  action: string;
  fromVersion: number;
  toVersion: number;
  actionClass: string;
  toStatus?: string;
  flags?: {
    is_security_restricted: boolean;
    is_policy_restricted: boolean;
    is_billing_restricted: boolean;
    is_administrative_restricted: boolean;
  };
}

export class Increment2Verifier {
  private db: any;

  constructor(dbClient: any) {
    this.db = dbClient;
  }

  /**
   * Verifies a post-snapshot tenant against the 5 transition-chain invariants (v2.5 Section 4.2).
   */
  verifyPostSnapshotTenant(
    tenant: {
      id: string;
      version: number;
      lifecycle_status: string;
      is_security_restricted: boolean;
      is_policy_restricted: boolean;
      is_billing_restricted: boolean;
      is_administrative_restricted: boolean;
    },
    rawAuditLogs: Array<{ id: string; action: string; details: any }>
  ): { clean: boolean; anomaly?: VerificationAnomaly } {
    // Step 1: Null integrity assertion
    if (
      !tenant.lifecycle_status ||
      tenant.is_security_restricted === null ||
      tenant.is_policy_restricted === null ||
      tenant.is_billing_restricted === null ||
      tenant.is_administrative_restricted === null
    ) {
      return {
        clean: false,
        anomaly: {
          tenantId: tenant.id,
          anomalyType: "POST_SNAPSHOT_STATE_DIVERGENCE",
          details: "Null values found in canonical lifecycle/restriction columns",
        },
      };
    }

    // Filter Class A events
    const classAEvents: TransitionChainEvent[] = [];
    const classBEvents: TransitionChainEvent[] = [];

    for (const log of rawAuditLogs) {
      let parsed: any;
      try {
        parsed = typeof log.details === "string" ? JSON.parse(log.details) : log.details;
      } catch (err) {
        return {
          clean: false,
          anomaly: {
            tenantId: tenant.id,
            anomalyType: "CORRUPT_JSON",
            rawPayload: String(log.details),
            details: "Malformed or non-parseable JSON in audit details",
          },
        };
      }

      if (!parsed || typeof parsed !== "object") {
        return {
          clean: false,
          anomaly: {
            tenantId: tenant.id,
            anomalyType: "CORRUPT_JSON",
            details: "Audit details is not a structured JSON object",
          },
        };
      }

      // Check positive integers for fromVersion and toVersion
      const fromV = parsed.fromVersion;
      const toV = parsed.toVersion;

      if (typeof fromV !== "number" || typeof toV !== "number" || fromV < 1 || toV <= fromV) {
        return {
          clean: false,
          anomaly: {
            tenantId: tenant.id,
            anomalyType: "BROKEN_TRANSITION_CHAIN",
            details: `Invalid version numbers: fromVersion=${fromV}, toVersion=${toV}`,
          },
        };
      }

      const event: TransitionChainEvent = {
        id: log.id,
        action: log.action,
        fromVersion: fromV,
        toVersion: toV,
        actionClass: parsed.actionClass || "CLASS_A",
        toStatus: parsed.toStatus,
        flags: parsed.flags,
      };

      if (event.actionClass === "CLASS_A") {
        classAEvents.push(event);
      } else {
        classBEvents.push(event);
      }
    }

    // Case 1: Zero Class A Events (Untouched or purely Class B)
    if (classAEvents.length === 0) {
      if (tenant.lifecycle_status !== "ACTIVE") {
        return {
          clean: false,
          anomaly: {
            tenantId: tenant.id,
            anomalyType: "POST_SNAPSHOT_STATE_DIVERGENCE",
            details: `Tenant lifecycle_status is '${tenant.lifecycle_status}', but zero Class A events exist`,
          },
        };
      }

      // All restriction flags must be false
      if (
        tenant.is_security_restricted ||
        tenant.is_policy_restricted ||
        tenant.is_billing_restricted ||
        tenant.is_administrative_restricted
      ) {
        return {
          clean: false,
          anomaly: {
            tenantId: tenant.id,
            anomalyType: "POST_SNAPSHOT_STATE_DIVERGENCE",
            details: "Restriction flags are true, but zero Class A events exist",
          },
        };
      }

      if (tenant.version === 1) {
        return { clean: true }; // Untouched tenant
      }

      // Version > 1: Corroborate Class B updates
      const accountedVersions = new Set(classBEvents.map((e) => e.toVersion));
      for (let v = 2; v <= tenant.version; v++) {
        if (!accountedVersions.has(v)) {
          return {
            clean: false,
            anomaly: {
              tenantId: tenant.id,
              anomalyType: "UNPROVEN_VERSION_GAP",
              details: `Version increment to ${v} is not corroborated by a Class B audit record`,
            },
          };
        }
      }

      return { clean: true };
    }

    // Case 2: One or More Class A Events
    // Sort sequence strictly by toVersion ASC
    classAEvents.sort((a, b) => a.toVersion - b.toVersion);

    // Validate Invariant 2: Strict Monotonicity & Uniqueness
    for (let i = 0; i < classAEvents.length - 1; i++) {
      if (classAEvents[i].toVersion >= classAEvents[i + 1].toVersion) {
        return {
          clean: false,
          anomaly: {
            tenantId: tenant.id,
            anomalyType: "DUPLICATE_VERSION_DETECTED",
            details: `Duplicate or non-monotonic toVersion detected: ${classAEvents[i].toVersion}`,
          },
        };
      }
    }

    // Validate Invariant 5: Initial Version Invariant
    if (classAEvents[0].fromVersion > 1) {
      // Gap between 1 and first Class A event must be corroborated by Class B events
      const accounted = new Set(classBEvents.map((e) => e.toVersion));
      for (let v = 2; v <= classAEvents[0].fromVersion; v++) {
        if (!accounted.has(v)) {
          return {
            clean: false,
            anomaly: {
              tenantId: tenant.id,
              anomalyType: "UNPROVEN_VERSION_GAP",
              details: `Uncorroborated gap before initial Class A transition: version ${v} unproven`,
            },
          };
        }
      }
    }

    // Validate Invariant 3: Contiguous Chaining or Corroborated Version Gaps
    for (let i = 0; i < classAEvents.length - 1; i++) {
      const cur = classAEvents[i];
      const next = classAEvents[i + 1];

      if (next.fromVersion === cur.toVersion) {
        continue; // Contiguous
      }

      if (next.fromVersion > cur.toVersion) {
        // Intervening gap must be corroborated by Class B events
        const accounted = new Set(classBEvents.map((e) => e.toVersion));
        for (let v = cur.toVersion + 1; v <= next.fromVersion; v++) {
          if (!accounted.has(v)) {
            return {
              clean: false,
              anomaly: {
                tenantId: tenant.id,
                anomalyType: "UNPROVEN_VERSION_GAP",
                details: `Unproven version gap between Class A transitions: version ${v} not found`,
              },
            };
          }
        }
      } else {
        return {
          clean: false,
          anomaly: {
            tenantId: tenant.id,
            anomalyType: "BROKEN_TRANSITION_CHAIN",
            details: `Invalid transition sequence: next fromVersion ${next.fromVersion} < cur toVersion ${cur.toVersion}`,
          },
        };
      }
    }

    // Validate Invariant 4: Current Version Ceiling
    const latestEvent = classAEvents[classAEvents.length - 1];
    if (latestEvent.toVersion > tenant.version) {
      return {
        clean: false,
        anomaly: {
          tenantId: tenant.id,
          anomalyType: "BROKEN_TRANSITION_CHAIN",
          details: `Latest transition toVersion (${latestEvent.toVersion}) exceeds live tenant version (${tenant.version})`,
        },
      };
    }

    // If tenant.version > latestEvent.toVersion, remaining delta must be corroborated by Class B
    if (tenant.version > latestEvent.toVersion) {
      const accounted = new Set(classBEvents.map((e) => e.toVersion));
      for (let v = latestEvent.toVersion + 1; v <= tenant.version; v++) {
        if (!accounted.has(v)) {
          return {
            clean: false,
            anomaly: {
              tenantId: tenant.id,
              anomalyType: "UNPROVEN_VERSION_GAP",
              details: `Uncorroborated gap after latest Class A transition: version ${v} not found`,
            },
          };
        }
      }
    }

    // Step 4: 5-Column Current State Proof
    if (latestEvent.action === "TENANT_REACTIVATE") {
      if (tenant.lifecycle_status !== "ACTIVE") {
        return {
          clean: false,
          anomaly: {
            tenantId: tenant.id,
            anomalyType: "POST_SNAPSHOT_STATE_DIVERGENCE",
            details: `Latest action was TENANT_REACTIVATE, but lifecycle_status is '${tenant.lifecycle_status}'`,
          },
        };
      }
      // Note: Under APPR-02 (Option A), restriction flags are PRESERVED and not required to be false
    } else if (latestEvent.action === "TENANT_SUSPEND" || latestEvent.action === "TENANT_RESTRICT") {
      const expectedStatus = latestEvent.toStatus || "SUSPENDED";
      if (tenant.lifecycle_status !== expectedStatus) {
        return {
          clean: false,
          anomaly: {
            tenantId: tenant.id,
            anomalyType: "POST_SNAPSHOT_STATE_DIVERGENCE",
            details: `Expected lifecycle_status '${expectedStatus}', got '${tenant.lifecycle_status}'`,
          },
        };
      }

      if (latestEvent.flags) {
        if (
          tenant.is_security_restricted !== latestEvent.flags.is_security_restricted ||
          tenant.is_policy_restricted !== latestEvent.flags.is_policy_restricted ||
          tenant.is_billing_restricted !== latestEvent.flags.is_billing_restricted ||
          tenant.is_administrative_restricted !== latestEvent.flags.is_administrative_restricted
        ) {
          return {
            clean: false,
            anomaly: {
              tenantId: tenant.id,
              anomalyType: "POST_SNAPSHOT_STATE_DIVERGENCE",
              details: "Concrete restriction flags do not match authoritative latest event snapshot",
            },
          };
        }
      }
    }

    return { clean: true };
  }
}
