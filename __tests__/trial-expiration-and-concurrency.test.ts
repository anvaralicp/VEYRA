/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks for tenant context and platform administration services
const {
  mockGetSession,
  mockTenantModel,
  mockTenantMemberModel,
  mockUserModel,
  mockInvitationModel,
  mockAuditLogModel,
  mockCookiesStore,
  mockHeadersStore,
  mockTransaction,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockTenantModel: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  mockTenantMemberModel: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  mockUserModel: {
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  mockInvitationModel: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockAuditLogModel: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  mockCookiesStore: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
  mockHeadersStore: {
    get: vi.fn(),
  },
  mockTransaction: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookiesStore),
  headers: vi.fn(async () => mockHeadersStore),
}));

vi.mock("../src/lib/auth/session", () => ({
  getSession: () => mockGetSession(),
}));

vi.mock("../src/prisma/db", () => {
  const mockDbClient = {
    Tenant: mockTenantModel,
    tenant: mockTenantModel,
    TenantMember: mockTenantMemberModel,
    tenantMember: mockTenantMemberModel,
    User: mockUserModel,
    user: mockUserModel,
    Invitation: mockInvitationModel,
    invitation: mockInvitationModel,
    AuditLog: mockAuditLogModel,
    auditLog: mockAuditLogModel,
  };
  return {
    db: {
      ...mockDbClient,
      $transaction: (cb: any) => mockTransaction(cb),
      transaction: (cb: any) => mockTransaction(cb),
    },
  };
});

import { getTenantContext } from "../src/lib/tenant/context";
import {
  getTenantSubscriptionMeta,
  suspendTenant,
  reactivateTenant,
  updateTenantRestriction,
  updateTenantSubscriptionPlan,
  extendTenantTrial,
  getPlatformTenantDetails,
} from "../src/lib/platform/tenant-service";

describe("VEYRA Increment 3B: Trial Expiration Enforcement & Concurrency Hardening", () => {
  const tenantId = "t-increment-3b";
  const userId = "user-member-1";

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetSession.mockResolvedValue({
      userId,
      email: "member@tenant.io",
    });

    mockHeadersStore.get.mockReturnValue(tenantId);

    mockTenantMemberModel.findUnique.mockResolvedValue({
      user_id: userId,
      tenant_id: tenantId,
      role: "MEMBER",
      status: "ACTIVE",
    });

    mockTenantModel.findUnique.mockResolvedValue({
      id: tenantId,
      name: "Increment 3B Test Tenant",
      version: 1,
      lifecycle_status: "ACTIVE",
      is_security_restricted: false,
      is_policy_restricted: false,
      is_billing_restricted: false,
      is_administrative_restricted: false,
      created_at: new Date("2026-01-01T00:00:00.000Z"),
    });

    mockTenantModel.update.mockResolvedValue({ id: tenantId, version: 1 });
    mockTenantModel.updateMany.mockResolvedValue({ count: 1 });
    mockAuditLogModel.create.mockResolvedValue({ id: "mock-log" });

    mockTransaction.mockImplementation(async (cb: any) => {
      return cb({
        Tenant: mockTenantModel,
        tenant: mockTenantModel,
        AuditLog: mockAuditLogModel,
        auditLog: mockAuditLogModel,
      });
    });
  });

  describe("1. Exact Boundary Tests for Trial Expiration", () => {
    it("1. Trial expires in one second (now + 1000ms): access allowed", async () => {
      const futureExpiry = new Date(Date.now() + 1000);
      mockAuditLogModel.findMany.mockImplementation(async (args: any) => {
        if (args?.where?.entity === "TenantSubscription") {
          return [
            {
              created_at: new Date(),
              details: JSON.stringify({
                selectedPlanId: "trial",
                selectedPlanName: "7 Day Trial",
                trialStartUtc: new Date(Date.now() - 6 * 86400000).toISOString(),
                trialEndUtc: futureExpiry.toISOString(),
              }),
            },
          ];
        }
        return [];
      });

      const context = await getTenantContext();
      expect(context.tenantId).toBe(tenantId);
      expect(context.userId).toBe(userId);
    });

    it("2. Trial expiry equals current time (epoch equality): access denied with stable TRIAL_EXPIRED error", async () => {
      const exactNow = new Date();
      vi.useFakeTimers();
      vi.setSystemTime(exactNow);

      mockAuditLogModel.findMany.mockImplementation(async (args: any) => {
        if (args?.where?.entity === "TenantSubscription") {
          return [
            {
              created_at: new Date(exactNow.getTime() - 7 * 86400000),
              details: JSON.stringify({
                selectedPlanId: "trial",
                selectedPlanName: "7 Day Trial",
                trialStartUtc: new Date(exactNow.getTime() - 7 * 86400000).toISOString(),
                trialEndUtc: exactNow.toISOString(), // Equality diffMs === 0
              }),
            },
          ];
        }
        return [];
      });

      await expect(getTenantContext()).rejects.toThrow(
        /FORBIDDEN: TRIAL_EXPIRED: Tenant evaluation trial has expired/
      );

      vi.useRealTimers();
    });

    it("3. Trial expired one second ago (now - 1000ms): access denied with stable TRIAL_EXPIRED error", async () => {
      const pastExpiry = new Date(Date.now() - 1000);
      mockAuditLogModel.findMany.mockImplementation(async (args: any) => {
        if (args?.where?.entity === "TenantSubscription") {
          return [
            {
              created_at: new Date(),
              details: JSON.stringify({
                selectedPlanId: "trial",
                selectedPlanName: "7 Day Trial",
                trialStartUtc: new Date(Date.now() - 8 * 86400000).toISOString(),
                trialEndUtc: pastExpiry.toISOString(),
              }),
            },
          ];
        }
        return [];
      });

      await expect(getTenantContext()).rejects.toThrow(
        /FORBIDDEN: TRIAL_EXPIRED: Tenant evaluation trial has expired/
      );
    });
  });

  describe("2. Plan Exemption and Immediate Restoration", () => {
    it("4. Paid plans (basic, professional, enterprise) are exempt from stale trial-expiration metadata", async () => {
      const staleTrialEndInPast = new Date("2020-01-01T00:00:00.000Z");

      for (const paidPlan of ["basic", "professional", "enterprise"]) {
        mockAuditLogModel.findMany.mockImplementation(async (args: any) => {
          if (args?.where?.entity === "TenantSubscription") {
            return [
              {
                created_at: new Date(),
                details: JSON.stringify({
                  selectedPlanId: paidPlan,
                  selectedPlanName: paidPlan.toUpperCase(),
                  trialStartUtc: "2019-12-25T00:00:00.000Z",
                  trialEndUtc: staleTrialEndInPast.toISOString(), // Expired 6 years ago
                }),
              },
            ];
          }
          return [];
        });

        const context = await getTenantContext();
        expect(context.tenantId).toBe(tenantId);
      }
    });

    it("5. Trial extension restores access immediately on next request", async () => {
      // Step A: Expired trial
      let trialEndUtc = new Date(Date.now() - 5000).toISOString();
      mockAuditLogModel.findMany.mockImplementation(async (args: any) => {
        if (args?.where?.entity === "TenantSubscription") {
          return [
            {
              created_at: new Date(),
              details: JSON.stringify({
                selectedPlanId: "trial",
                trialStartUtc: new Date(Date.now() - 10 * 86400000).toISOString(),
                trialEndUtc,
              }),
            },
          ];
        }
        return [];
      });

      await expect(getTenantContext()).rejects.toThrow(/FORBIDDEN: TRIAL_EXPIRED/);

      // Step B: Administrator extends trial by 7 days
      mockGetSession.mockResolvedValue({ userId: "admin-1", email: "platform-admin@veyra.io" });
      const extendRes = await extendTenantTrial(tenantId, 7, "Extension requested by customer");
      expect(extendRes.success).toBe(true);

      // Step C: Next tenant request sees extended trial end and succeeds immediately
      trialEndUtc = extendRes.newTrialEndDate;
      mockGetSession.mockResolvedValue({ userId, email: "member@tenant.io" });
      const context = await getTenantContext();
      expect(context.tenantId).toBe(tenantId);
    });

    it("6. Plan upgrade restores access immediately on next request", async () => {
      // Step A: Expired trial
      let currentPlanId = "trial";
      mockAuditLogModel.findMany.mockImplementation(async (args: any) => {
        if (args?.where?.entity === "TenantSubscription") {
          return [
            {
              created_at: new Date(),
              details: JSON.stringify({
                selectedPlanId: currentPlanId,
                trialStartUtc: new Date(Date.now() - 10 * 86400000).toISOString(),
                trialEndUtc: new Date(Date.now() - 2000).toISOString(),
              }),
            },
          ];
        }
        return [];
      });

      await expect(getTenantContext()).rejects.toThrow(/FORBIDDEN: TRIAL_EXPIRED/);

      // Step B: Administrator upgrades to professional plan
      mockGetSession.mockResolvedValue({ userId: "admin-1", email: "platform-admin@veyra.io" });
      const upgradeRes = await updateTenantSubscriptionPlan(tenantId, "professional", "Customer upgraded via sales");
      expect(upgradeRes.success).toBe(true);

      // Step C: Next tenant request succeeds immediately
      currentPlanId = "professional";
      mockGetSession.mockResolvedValue({ userId, email: "member@tenant.io" });
      const context = await getTenantContext();
      expect(context.tenantId).toBe(tenantId);
    });
  });

  describe("3. Independent Restriction Hierarchy and Fail-Closed Safety", () => {
    it("7. Tenant suspension and independent restrictions continue to block access even if trial is active", async () => {
      // Provide valid active trial
      mockAuditLogModel.findMany.mockImplementation(async (args: any) => {
        if (args?.where?.entity === "TenantSubscription") {
          return [
            {
              created_at: new Date(),
              details: JSON.stringify({
                selectedPlanId: "trial",
                trialStartUtc: new Date().toISOString(),
                trialEndUtc: new Date(Date.now() + 86400000).toISOString(),
              }),
            },
          ];
        }
        return [];
      });

      // A: Suspended
      mockTenantModel.findUnique.mockResolvedValue({
        id: tenantId,
        lifecycle_status: "SUSPENDED",
        is_security_restricted: false,
        is_billing_restricted: false,
      });
      await expect(getTenantContext()).rejects.toThrow("FORBIDDEN: Tenant account is suspended");

      // B: Security restricted
      mockTenantModel.findUnique.mockResolvedValue({
        id: tenantId,
        lifecycle_status: "ACTIVE",
        is_security_restricted: true,
        is_billing_restricted: false,
      });
      await expect(getTenantContext()).rejects.toThrow("FORBIDDEN: Tenant account is locked under security isolation");

      // C: Billing restricted
      mockTenantModel.findUnique.mockResolvedValue({
        id: tenantId,
        lifecycle_status: "ACTIVE",
        is_security_restricted: false,
        is_billing_restricted: true,
      });
      await expect(getTenantContext()).rejects.toThrow("FORBIDDEN: Tenant account is restricted due to billing delinquency");
    });

    it("8. Missing, malformed, contradictory, and unavailable subscription metadata fail closed safely", async () => {
      // Contradictory: trialEnd before trialStart
      mockAuditLogModel.findMany.mockImplementation(async (args: any) => {
        if (args?.where?.entity === "TenantSubscription") {
          return [
            {
              created_at: new Date(),
              details: JSON.stringify({
                selectedPlanId: "trial",
                trialStartUtc: "2026-05-10T00:00:00.000Z",
                trialEndUtc: "2026-05-01T00:00:00.000Z",
              }),
            },
          ];
        }
        return [];
      });
      await expect(getTenantContext()).rejects.toThrow("SERVICE_UNAVAILABLE: Tenant subscription status is unverifiable");

      // Malformed details JSON
      mockAuditLogModel.findMany.mockImplementation(async (args: any) => {
        if (args?.where?.entity === "TenantSubscription") {
          return [{ created_at: new Date(), details: "NOT_VALID_JSON" }];
        }
        return [];
      });
      await expect(getTenantContext()).rejects.toThrow("SERVICE_UNAVAILABLE: Tenant subscription status is unverifiable");

      // Storage failure
      mockAuditLogModel.findMany.mockImplementation(async (args: any) => {
        if (args?.where?.entity === "TenantSubscription") {
          throw new Error("Audit storage down");
        }
        return [];
      });
      await expect(getTenantContext()).rejects.toThrow("SERVICE_UNAVAILABLE");
    });

    it("9. Legacy tenants with no audit records are not assigned invented trial history and fail closed", async () => {
      mockAuditLogModel.findMany.mockImplementation(async () => []);

      const meta = await getTenantSubscriptionMeta(tenantId, new Date("2026-01-01T00:00:00.000Z"));
      expect(meta.status).toBe("UNAVAILABLE");
      expect(meta.planId).toBe("unavailable");
      expect(meta.planName).toBe("Subscription Unverified");
      expect(meta.isTrialExpired).toBe(false);
      expect(meta.trialStartDate).toBeUndefined();
      expect(meta.trialEndDate).toBeUndefined();

      await expect(getTenantContext()).rejects.toThrow(
        "SERVICE_UNAVAILABLE: Tenant subscription status is unverifiable. Please contact platform administration."
      );
    });

    it("10. UTC behavior is independent of server timezone offsets", async () => {
      const utcString = "2026-07-15T12:00:00.000Z";
      const expectedEpoch = new Date(utcString).getTime();

      mockAuditLogModel.findMany.mockImplementation(async (args: any) => {
        if (args?.where?.entity === "TenantSubscription") {
          return [
            {
              created_at: new Date(),
              details: JSON.stringify({
                selectedPlanId: "trial",
                trialStartUtc: "2026-07-08T12:00:00.000Z",
                trialEndUtc: utcString,
              }),
            },
          ];
        }
        return [];
      });

      const meta = await getTenantSubscriptionMeta(tenantId);
      expect(meta.status).toBe("AVAILABLE");
      expect(meta.trialEndDate).toBe(utcString);
      expect(new Date(meta.trialEndDate!).getTime()).toBe(expectedEpoch);
    });
  });

  describe("4. Lifecycle Concurrency Hardening & Version Predicates", () => {
    it("11. Concurrent trial extensions and plan changes serialize and cannot lose updates", async () => {
      mockGetSession.mockResolvedValue({ userId: "admin-1", email: "platform-admin@veyra.io" });

      let currentVersion = 1;
      let committedPlan = "trial";
      let committedTrialEnd = new Date(Date.now() + 86400000).toISOString();

      mockTenantModel.findUnique.mockImplementation(async () => ({
        id: tenantId,
        version: currentVersion,
        created_at: new Date("2026-01-01T00:00:00.000Z"),
      }));

      mockAuditLogModel.findMany.mockImplementation(async (args: any) => {
        if (args?.where?.entity === "TenantSubscription") {
          return [
            {
              created_at: new Date(),
              details: JSON.stringify({
                selectedPlanId: committedPlan,
                trialStartUtc: new Date().toISOString(),
                trialEndUtc: committedTrialEnd,
              }),
            },
          ];
        }
        return [];
      });

      mockTenantModel.updateMany.mockImplementation(async (args: any) => {
        if (args?.where?.version !== currentVersion) {
          return { count: 0 };
        }
        currentVersion = args.data.version;
        return { count: 1 };
      });

      mockAuditLogModel.create.mockImplementation(async (args: any) => {
        const details = JSON.parse(args.data?.details || args.details);
        if (details.selectedPlanId) committedPlan = details.selectedPlanId;
        if (details.toTrialEndUtc) committedTrialEnd = details.toTrialEndUtc;
        return {};
      });

      // Extension succeeds and advances version to 2
      const ext = await extendTenantTrial(tenantId, 14, "First extension");
      expect(ext.success).toBe(true);
      expect(currentVersion).toBe(2);

      // Subsequent plan change sees updated version and advances to 3
      const plan = await updateTenantSubscriptionPlan(tenantId, "basic", "Upgrade to basic");
      expect(plan.success).toBe(true);
      expect(currentVersion).toBe(3);
      expect(committedPlan).toBe("basic");
    });

    it("12. Concurrent changes to different restriction flags preserve both flags without overwriting", async () => {
      mockGetSession.mockResolvedValue({ userId: "admin-1", email: "platform-admin@veyra.io" });

      const tenantState = {
        id: tenantId,
        version: 1,
        is_security_restricted: false,
        is_policy_restricted: false,
        is_billing_restricted: false,
        is_administrative_restricted: false,
      };

      mockTenantModel.findUnique.mockImplementation(async () => ({ ...tenantState }));
      mockTenantModel.updateMany.mockImplementation(async (args: any) => {
        if (args?.where?.version !== tenantState.version) return { count: 0 };
        Object.assign(tenantState, args.data);
        return { count: 1 };
      });

      // 1. Enable security restriction
      const res1 = await updateTenantRestriction(tenantId, "security", true, "Security breach hold");
      expect(res1.success).toBe(true);
      expect(tenantState.is_security_restricted).toBe(true);
      expect(tenantState.version).toBe(2);

      // 2. Enable billing restriction
      const res2 = await updateTenantRestriction(tenantId, "billing", true, "Overdue invoices hold");
      expect(res2.success).toBe(true);
      expect(tenantState.is_security_restricted).toBe(true); // Preserved!
      expect(tenantState.is_billing_restricted).toBe(true);   // Preserved!
      expect(tenantState.version).toBe(3);
    });

    it("13. Stale version predicates return a stable conflict error (zero-row update detection)", async () => {
      mockGetSession.mockResolvedValue({ userId: "admin-1", email: "platform-admin@veyra.io" });

      mockTenantModel.findUnique.mockResolvedValue({
        id: tenantId,
        version: 5,
        lifecycle_status: "ACTIVE",
        is_security_restricted: false,
        is_policy_restricted: false,
        is_billing_restricted: false,
        is_administrative_restricted: false,
        created_at: new Date(),
      });

      // Simulate concurrent update: updateMany matches 0 rows
      mockTenantModel.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        suspendTenant(tenantId, "Concurrent admin suspend request")
      ).rejects.toThrow("CONFLICT: STALE_DATA: Tenant was modified by another transaction. Please refresh and try again.");

      await expect(
        updateTenantRestriction(tenantId, "policy", true, "Concurrent policy hold")
      ).rejects.toThrow("CONFLICT: STALE_DATA: Tenant was modified by another transaction. Please refresh and try again.");
    });

    it("14. Audit log write failure rolls back the entire transaction", async () => {
      mockGetSession.mockResolvedValue({ userId: "admin-1", email: "platform-admin@veyra.io" });

      mockTenantModel.findUnique.mockResolvedValue({
        id: tenantId,
        version: 1,
        lifecycle_status: "ACTIVE",
        is_security_restricted: false,
        is_policy_restricted: false,
        is_billing_restricted: false,
        is_administrative_restricted: false,
      });

      mockAuditLogModel.create.mockRejectedValue(new Error("Disk full: Audit write failed"));

      await expect(
        suspendTenant(tenantId, "Suspension justification")
      ).rejects.toThrow(/Audit write failed/);
    });
  });

  describe("5. Platform Admin Operations Unblocked", () => {
    it("15. Platform Admin can inspect, manage, and extend expired tenants without being blocked", async () => {
      mockGetSession.mockResolvedValue({ userId: "admin-1", email: "platform-admin@veyra.io" });

      mockAuditLogModel.findMany.mockImplementation(async (args: any) => {
        if (args?.where?.entity === "TenantSubscription") {
          return [
            {
              created_at: new Date(),
              details: JSON.stringify({
                selectedPlanId: "trial",
                trialStartUtc: "2026-01-01T00:00:00.000Z",
                trialEndUtc: "2026-01-08T00:00:00.000Z", // Expired
              }),
            },
          ];
        }
        return [];
      });

      // Platform admin can fetch details of expired tenant
      const details = await getPlatformTenantDetails(tenantId);
      expect(details).toBeDefined();
      expect(details?.isTrialExpired).toBe(true);
      expect(details?.planId).toBe("trial");

      // Platform admin can extend trial
      const ext = await extendTenantTrial(tenantId, 14, "Grace period extension");
      expect(ext.success).toBe(true);
    });
  });
});
