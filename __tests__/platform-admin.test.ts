/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// Hoisted mocks
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

import {
  requirePlatformAdmin,
  requirePlatformPermission,
  isPlatformAdmin,
} from "../src/lib/auth/platform";
import {
  getPlatformOverviewMetrics,
  getPlatformTenants,
  getPlatformTenantDetails,
  getPlatformAuditEvents,
  getTenantLifecycleStatus,
  getTenantSubscriptionMeta,
  suspendTenant,
  reactivateTenant,
  inviteTenantAdmin,
  revokeTenantAdminInvitation,
  isTenantSuspended,
  sanitizeAuditDetails,
  PLATFORM_AUDIT_ENTITIES,
  PLATFORM_AUDIT_ACTIONS,
  ALLOWED_PLAN_IDS,
} from "../src/lib/platform/tenant-service";
import { requirePermission } from "../src/lib/auth/boundary";
import { getTenantContext } from "../src/lib/tenant/context";
import { runTransaction } from "../src/lib/db/legacy-adapter";
import { db } from "../src/prisma/db";

describe("VEYRA Phase 1 — Platform Administration & Privacy Architecture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLATFORM_ADMIN_EMAILS = "platform-admin@veyra.io,ops@veyra.io";
    mockHeadersStore.get.mockReturnValue(undefined);
    mockCookiesStore.get.mockReturnValue(undefined);
    mockAuditLogModel.findMany.mockReset();
    mockAuditLogModel.findMany.mockResolvedValue([]);
    mockAuditLogModel.create.mockReset();
    mockAuditLogModel.create.mockResolvedValue({});
    mockAuditLogModel.count.mockReset();
    mockAuditLogModel.count.mockResolvedValue(0);
    mockTenantModel.findUnique.mockReset();
    mockTenantModel.findUnique.mockResolvedValue({ id: "t-1", name: "Acme Corp" });
    mockTenantModel.findMany.mockReset();
    mockTenantModel.findMany.mockResolvedValue([]);
    mockTenantMemberModel.findMany.mockReset();
    mockTenantMemberModel.findMany.mockResolvedValue([]);
    mockTenantMemberModel.findUnique.mockReset();
    mockInvitationModel.findUnique.mockReset();
    mockInvitationModel.findMany.mockReset();
    mockInvitationModel.findMany.mockResolvedValue([]);
    mockUserModel.findUnique.mockReset();
    mockTransaction.mockReset();
    mockTransaction.mockImplementation((cb: any) => cb({
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
    }));
  });

  describe("1. Authentication & Platform Boundary Enforcement", () => {
    it("UNAUTHENTICATED: Rejects access when session is missing", async () => {
      mockGetSession.mockResolvedValue(null);

      expect(await isPlatformAdmin()).toBe(false);
      await expect(requirePlatformAdmin()).rejects.toThrow(/UNAUTHORIZED/);
    });

    it("ORDINARY TENANT USER: Rejects access for ordinary tenant members", async () => {
      mockGetSession.mockResolvedValue({
        userId: "user-tenant-1",
        email: "alice@acme-corp.com",
      });

      expect(await isPlatformAdmin()).toBe(false);
      await expect(requirePlatformAdmin()).rejects.toThrow(/FORBIDDEN/);
      await expect(requirePlatformPermission("platform.tenant.view")).rejects.toThrow(/FORBIDDEN/);
    });

    it("TENANT OWNER: Rejects platform admin access even for tenant OWNER", async () => {
      mockGetSession.mockResolvedValue({
        userId: "user-owner-1",
        email: "bob-owner@acme-corp.com",
      });

      // bob is a tenant owner, but NOT a platform administrator
      expect(await isPlatformAdmin()).toBe(false);
      await expect(requirePlatformAdmin()).rejects.toThrow(/FORBIDDEN/);
    });

    it("TENANT CONTEXT: Tenant requirePermission strictly rejects platform.* permissions", async () => {
      // Even inside a tenant context, platform permissions can never be evaluated
      await expect(requirePermission("platform.tenant.view")).rejects.toThrow(/FORBIDDEN.*Platform permissions/);
      await expect(requirePermission("platform.tenant.suspend")).rejects.toThrow(/FORBIDDEN.*Platform permissions/);
    });

    it("AUTHORIZED PLATFORM ADMIN: Grants access when user is a verified platform administrator", async () => {
      mockGetSession.mockResolvedValue({
        userId: "admin-super",
        email: "platform-admin@veyra.io",
      });

      expect(await isPlatformAdmin()).toBe(true);
      const user = await requirePlatformAdmin();
      expect(user).toBeDefined();
      expect(user.email).toBe("platform-admin@veyra.io");
      expect(user.isPlatformAdmin).toBe(true);
    });

    it("UNKNOWN PLATFORM PERMISSIONS: Rejects unknown platform.* permission keys", async () => {
      mockGetSession.mockResolvedValue({
        userId: "admin-super",
        email: "platform-admin@veyra.io",
      });

      await expect(requirePlatformPermission("platform.secret_backdoor")).rejects.toThrow(/FORBIDDEN.*Invalid or unassigned platform permission/);
      await expect(requirePlatformPermission("platform.unregistered")).rejects.toThrow(/FORBIDDEN.*Invalid or unassigned platform permission/);
    });

    it("NON-PLATFORM PERMISSIONS: Rejects tenant business permissions even for platform admins", async () => {
      mockGetSession.mockResolvedValue({
        userId: "admin-super",
        email: "platform-admin@veyra.io",
      });

      await expect(requirePlatformPermission("customer.read")).rejects.toThrow(/FORBIDDEN.*Invalid or unassigned platform permission/);
      await expect(requirePlatformPermission("quotation.create")).rejects.toThrow(/FORBIDDEN.*Invalid or unassigned platform permission/);
    });
  });

  describe("2. Privacy-First Platform Metadata Access", () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        userId: "admin-super",
        email: "platform-admin@veyra.io",
      });
    });

    it("PLATFORM OVERVIEW: Retrieves persisted platform metadata without querying business records", async () => {
      const now = new Date();
      mockTenantModel.findMany.mockResolvedValue([
        {
          id: "tenant-1",
          name: "Acme Logistics",
          created_at: now,
          updated_at: now,
        },
        {
          id: "tenant-2",
          name: "Beta Healthcare",
          created_at: now,
          updated_at: now,
        },
      ]);
      mockUserModel.count.mockResolvedValue(42);
      mockAuditLogModel.findMany.mockResolvedValue([
        {
          id: "log-1",
          tenant_id: "tenant-1",
          entity: "TenantSubscription",
          action: "TRIAL_ACTIVATE",
          user_id: "user-1",
          created_at: now,
          details: JSON.stringify({ selectedPlanId: "trial", selectedPlanName: "7 Day Trial" }),
        },
      ]);

      const metrics = await getPlatformOverviewMetrics();

      expect(metrics.totalTenants).toBe(2);
      expect(metrics.activeTenants).toBe(2);
      expect(metrics.suspendedTenants).toBe(0);
      expect(metrics.totalRegisteredUsers).toBe(42);
      expect(metrics.planDistribution.trial).toBeGreaterThan(0);
      expect(metrics.recentEvents).toHaveLength(1);
    });

    it("TENANT DIRECTORY: Searches, filters, and paginates permitted tenant account metadata", async () => {
      const now = new Date();
      mockTenantModel.findMany.mockResolvedValue([
        {
          id: "t-1",
          name: "Acme Tech",
          domain: "acme.com",
          email: "info@acme.com",
          created_at: now,
          updated_at: now,
        },
        {
          id: "t-2",
          name: "Zenith Retail",
          domain: "zenith.com",
          email: "contact@zenith.com",
          created_at: now,
          updated_at: now,
        },
      ]);
      mockTenantMemberModel.count.mockResolvedValue(5);
      mockAuditLogModel.findMany.mockResolvedValue([]);

      const result = await getPlatformTenants({ search: "Acme" });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("Acme Tech");
      expect(result.items[0]).toHaveProperty("planId");
      expect(result.items[0]).toHaveProperty("status", "ACTIVE");
      expect(result.items[0]).toHaveProperty("memberCount", 5);

      // Verify no business record fields are present
      expect(result.items[0]).not.toHaveProperty("customers");
      expect(result.items[0]).not.toHaveProperty("leads");
      expect(result.items[0]).not.toHaveProperty("quotations");
    });

    it("TENANT DETAIL: Returns permitted administrative metadata and administrator identity only", async () => {
      const now = new Date();
      mockTenantModel.findUnique.mockResolvedValue({
        id: "t-1",
        name: "Acme Tech",
        legal_name: "Acme Technologies Pvt Ltd",
        domain: "acme.com",
        timezone: "Asia/Kolkata",
        currency: "INR",
        created_at: now,
        updated_at: now,
      });
      mockTenantMemberModel.findMany.mockResolvedValue([
        { user_id: "u-1", role: "OWNER", status: "ACTIVE", created_at: now },
      ]);
      mockUserModel.findUnique.mockResolvedValue({
        id: "u-1",
        name: "John Doe",
        email: "john@acme.com",
      });
      mockInvitationModel.findMany.mockResolvedValue([
        {
          id: "inv-1",
          email: "admin2@acme.com",
          role: "ADMIN",
          status: "PENDING",
          expires_at: new Date(Date.now() + 7 * 86400000),
          created_at: now,
        },
      ]);
      mockAuditLogModel.findMany.mockResolvedValue([]);

      const details = await getPlatformTenantDetails("t-1");

      expect(details).not.toBeNull();
      expect(details?.name).toBe("Acme Tech");
      expect(details?.legalName).toBe("Acme Technologies Pvt Ltd");
      expect(details?.administrators).toHaveLength(1);
      expect(details?.administrators[0].email).toBe("john@acme.com");
      expect(details?.invitations).toHaveLength(1);

      // Ensure zero tenant business data
      expect(details).not.toHaveProperty("customers");
      expect(details).not.toHaveProperty("projects");
      expect(details).not.toHaveProperty("serviceTickets");
      expect(details).not.toHaveProperty("invoices");
    });

    it("AUDIT RESTRICTION AT SOURCE: Overview audit query filters by permitted entities and actions at the database level", async () => {
      mockTenantModel.findMany.mockResolvedValue([]);
      mockUserModel.count.mockResolvedValue(0);
      mockAuditLogModel.findMany.mockResolvedValue([]);

      await getPlatformOverviewMetrics();

      expect(mockAuditLogModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            entity: { in: PLATFORM_AUDIT_ENTITIES },
            action: { in: PLATFORM_AUDIT_ACTIONS },
          },
          select: expect.objectContaining({
            id: true,
            action: true,
            entity: true,
          }),
          orderBy: { created_at: "desc" },
          take: 10,
        })
      );
    });

    it("PLATFORM AUDIT LOGS RESTRICTION: Audit log query strictly filters at source and applies projection", async () => {
      mockAuditLogModel.count.mockResolvedValue(1);
      mockAuditLogModel.findMany.mockResolvedValue([
        {
          id: "log-1",
          action: "TENANT_SUSPEND",
          entity: "Tenant",
          tenant_id: "t-1",
          user_id: "u-1",
          created_at: new Date(),
          details: JSON.stringify({ reason: "Delinquent", unapproved_field: "secret" }),
        },
      ]);

      const res = await getPlatformAuditEvents({ page: 1, pageSize: 10 });

      expect(mockAuditLogModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            entity: { in: PLATFORM_AUDIT_ENTITIES },
            action: { in: PLATFORM_AUDIT_ACTIONS },
          },
          select: expect.objectContaining({
            id: true,
            action: true,
            details: true,
          }),
        })
      );

      // Verify unapproved details are stripped
      expect(res.items[0].details).toEqual({ reason: "Delinquent" });
      expect(res.items[0].details).not.toHaveProperty("unapproved_field");
    });

    it("AUDIT DETAILS SANITIZATION: Strips unapproved keys and retains only permitted platform metadata", () => {
      const raw = {
        reason: "Compliance review",
        actorEmail: "ops@veyra.io",
        role: "ADMIN",
        customer_crm_id: "cust-999",
        opportunity_amount: 500000,
        password_hash: "$2a$12$secret",
        token: "cleartext_secret",
      };

      const sanitized = sanitizeAuditDetails(raw);
      expect(sanitized).toEqual({
        reason: "Compliance review",
        actorEmail: "ops@veyra.io",
        role: "ADMIN",
      });
      expect(sanitized).not.toHaveProperty("customer_crm_id");
      expect(sanitized).not.toHaveProperty("opportunity_amount");
      expect(sanitized).not.toHaveProperty("password_hash");
      expect(sanitized).not.toHaveProperty("token");
    });

    it("LEAST DATA ACCESS PROJECTIONS: Queries select only permitted fields and never fetch password or token hashes", async () => {
      const now = new Date();
      mockTenantModel.findUnique.mockResolvedValue({
        id: "t-1",
        name: "Acme Corp",
        legal_name: "Acme Corp Ltd",
        registration_number: "REG-123",
        domain: "acme.com",
        email: "admin@acme.com",
        phone: "+1234567890",
        timezone: "UTC",
        currency: "USD",
        created_at: now,
        updated_at: now,
      });
      mockTenantMemberModel.findMany.mockResolvedValue([
        { user_id: "u-1", role: "ADMIN", status: "ACTIVE", created_at: now },
      ]);
      mockUserModel.findUnique.mockResolvedValue({
        id: "u-1",
        name: "Alice",
        email: "alice@acme.com",
      });
      mockInvitationModel.findMany.mockResolvedValue([]);
      mockAuditLogModel.findMany.mockResolvedValue([]);

      await getPlatformTenantDetails("t-1");

      // Verify Tenant projection excludes GSTIN, PAN, and address
      const tenantSelect = mockTenantModel.findUnique.mock.calls[0][0].select;
      expect(tenantSelect).toBeDefined();
      expect(tenantSelect).not.toHaveProperty("gstin");
      expect(tenantSelect).not.toHaveProperty("pan");
      expect(tenantSelect).not.toHaveProperty("address");

      // Verify User projection NEVER selects password_hash
      const userSelect = mockUserModel.findUnique.mock.calls[0][0].select;
      expect(userSelect).toEqual({
        id: true,
        name: true,
        email: true,
      });
      expect(userSelect).not.toHaveProperty("password_hash");

      // Verify Invitation projection NEVER selects token_hash
      const invSelect = mockInvitationModel.findMany.mock.calls[0][0].select;
      expect(invSelect).toBeDefined();
      expect(invSelect).not.toHaveProperty("token_hash");
      expect(invSelect).not.toHaveProperty("token");
    });

    it("FAIL-CLOSED METRICS ON LIFECYCLE ERROR: Overview metrics rejects when lifecycle status cannot be verified", async () => {
      mockTenantModel.findMany.mockResolvedValue([{ id: "t-1", created_at: new Date() }]);
      mockAuditLogModel.findMany.mockRejectedValue(new Error("Database connection dropped"));

      await expect(getPlatformOverviewMetrics()).rejects.toThrow(/SERVICE_UNAVAILABLE/);
    });

    it("FAIL-CLOSED METRICS ON AUDIT QUERY ERROR: Overview metrics rejects when audit query fails", async () => {
      mockTenantModel.findMany.mockResolvedValue([]);
      mockAuditLogModel.findMany.mockRejectedValue(new Error("Database connection dropped"));

      await expect(getPlatformOverviewMetrics()).rejects.toThrow(/SERVICE_UNAVAILABLE.*Failed to retrieve platform audit events/);
    });

    it("FAIL-CLOSED AUDIT EVENTS: getPlatformAuditEvents rejects with SERVICE_UNAVAILABLE on database failure", async () => {
      mockAuditLogModel.findMany.mockRejectedValue(new Error("Query failure"));

      await expect(getPlatformAuditEvents()).rejects.toThrow(/SERVICE_UNAVAILABLE.*Failed to query platform audit events/);
    });

    it("FAIL-CLOSED TENANT DETAILS AUDIT: getPlatformTenantDetails rejects with SERVICE_UNAVAILABLE on audit failure", async () => {
      mockTenantModel.findUnique.mockResolvedValue({
        id: "t-1",
        name: "Acme",
        created_at: new Date(),
        updated_at: new Date(),
      });
      mockAuditLogModel.findMany
        .mockResolvedValueOnce([]) // for getTenantLifecycleStatus
        .mockResolvedValueOnce([]) // for getTenantSubscriptionMeta
        .mockRejectedValueOnce(new Error("Audit log disk failure")); // for tenant audit history query

      mockTenantMemberModel.findMany.mockResolvedValue([]);
      mockInvitationModel.findMany.mockResolvedValue([]);

      await expect(getPlatformTenantDetails("t-1")).rejects.toThrow(/SERVICE_UNAVAILABLE.*Failed to retrieve tenant audit trail/);
    });

    it("SUBSCRIPTION METADATA PROJECTION: Queries select only required fields and validate plan IDs", async () => {
      const now = new Date();
      mockTenantModel.findUnique.mockResolvedValue({
        id: "t-1",
        name: "Acme",
        created_at: now,
        updated_at: now,
      });
      mockAuditLogModel.findMany
        .mockResolvedValueOnce([]) // for getTenantLifecycleStatus
        .mockResolvedValueOnce([
          {
            created_at: now,
            details: JSON.stringify({
              selectedPlanId: "enterprise",
              selectedPlanName: "Enterprise Tier",
              trialStartUtc: now.toISOString(),
              trialEndUtc: new Date(now.getTime() + 14 * 86400000).toISOString(),
            }),
          },
        ]) // for getTenantSubscriptionMeta
        .mockResolvedValueOnce([]); // for tenant audit history query

      mockTenantMemberModel.findMany.mockResolvedValue([]);
      mockInvitationModel.findMany.mockResolvedValue([]);

      const details = await getPlatformTenantDetails("t-1");
      expect(details?.planId).toBe("enterprise");
      expect(details?.planName).toBe("Enterprise");

      const subAuditCall = mockAuditLogModel.findMany.mock.calls[1][0];
      expect(subAuditCall.select).toEqual({
        created_at: true,
        details: true,
      });
    });
  });

  describe("3. Tenant Lifecycle Actions & Server-Side Suspension", () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        userId: "admin-super",
        email: "platform-admin@veyra.io",
      });
    });

    it("SUSPENSION: Platform admin can suspend a tenant account with audit logging", async () => {
      mockAuditLogModel.create.mockResolvedValue({ id: "log-suspend-1" });

      const res = await suspendTenant("t-1", "Billing delinquency");

      expect(res.success).toBe(true);
      expect(mockAuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: "t-1",
            action: "TENANT_SUSPEND",
            entity: "Tenant",
            user_id: "admin-super",
          }),
        })
      );
    });

    it("REACTIVATION: Platform admin can reactivate a suspended tenant account", async () => {
      mockTenantModel.findUnique.mockResolvedValue({ id: "t-1" });
      mockAuditLogModel.findMany.mockResolvedValue([
        {
          id: "log-suspend-1",
          tenant_id: "t-1",
          entity: "Tenant",
          action: "TENANT_SUSPEND",
          details: JSON.stringify({ reason: "Terms violation" }),
          created_at: new Date(),
        },
      ]);
      mockAuditLogModel.create.mockResolvedValue({ id: "log-reactivate-1" });

      const res = await reactivateTenant("t-1");

      expect(res.success).toBe(true);
      expect(mockAuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: "t-1",
            action: "TENANT_REACTIVATE",
            entity: "Tenant",
            user_id: "admin-super",
          }),
        })
      );
    });

    it("SUSPENSION VALIDATION: Nonexistent tenant is rejected", async () => {
      mockTenantModel.findUnique.mockResolvedValue(null);
      await expect(suspendTenant("t-nonexistent", "Valid reason")).rejects.toThrow(/Tenant not found/);
    });

    it("SUSPENSION VALIDATION: Rejects invalid reason lengths", async () => {
      mockTenantModel.findUnique.mockResolvedValue({ id: "t-1" });
      await expect(suspendTenant("t-1", "no")).rejects.toThrow(/Suspension reason must be between 3 and 500 characters/);
      await expect(suspendTenant("t-1", "a".repeat(501))).rejects.toThrow(/Suspension reason must be between 3 and 500 characters/);
    });

    it("SUSPENSION VALIDATION: Rejects duplicate suspension of already suspended tenant", async () => {
      mockTenantModel.findUnique.mockResolvedValue({ id: "t-1" });
      mockAuditLogModel.findMany.mockResolvedValue([
        {
          id: "log-1",
          tenant_id: "t-1",
          entity: "Tenant",
          action: "TENANT_SUSPEND",
          created_at: new Date(),
        },
      ]);

      await expect(suspendTenant("t-1", "Already suspended")).rejects.toThrow(/Tenant is already suspended/);
    });

    it("REACTIVATION VALIDATION: Nonexistent tenant or active tenant is rejected", async () => {
      mockTenantModel.findUnique.mockResolvedValue(null);
      await expect(reactivateTenant("t-nonexistent")).rejects.toThrow(/Tenant not found/);

      mockTenantModel.findUnique.mockResolvedValue({ id: "t-1" });
      mockAuditLogModel.findMany.mockResolvedValue([]); // Active
      await expect(reactivateTenant("t-1")).rejects.toThrow(/Tenant is not currently suspended/);
    });

    it("SUSPENSION DETECTION: Detects suspended status from audit lifecycle history", async () => {
      const now = new Date();
      mockAuditLogModel.findMany.mockResolvedValue([
        {
          id: "log-1",
          tenant_id: "t-1",
          entity: "Tenant",
          action: "TENANT_SUSPEND",
          details: JSON.stringify({ reason: "Policy violation" }),
          created_at: now,
        },
      ]);

      const suspended = await isTenantSuspended("t-1");
      expect(suspended).toBe(true);
    });

    it("REACTIVATION DETECTION: Recognizes lifted suspension after reactivation audit event", async () => {
      const earlier = new Date(Date.now() - 3600000);
      const later = new Date();

      mockAuditLogModel.findMany.mockResolvedValue([
        {
          id: "log-1",
          tenant_id: "t-1",
          entity: "Tenant",
          action: "TENANT_SUSPEND",
          created_at: earlier,
        },
        {
          id: "log-2",
          tenant_id: "t-1",
          entity: "Tenant",
          action: "TENANT_REACTIVATE",
          created_at: later,
        },
      ]);

      const suspended = await isTenantSuspended("t-1");
      expect(suspended).toBe(false);
    });

    it("UNAUTHORIZED SUSPENSION: Ordinary tenant user cannot suspend or reactivate accounts", async () => {
      mockGetSession.mockResolvedValue({
        userId: "tenant-user",
        email: "user@tenant.com",
      });

      await expect(suspendTenant("t-1", "hacked")).rejects.toThrow(/FORBIDDEN/);
      await expect(reactivateTenant("t-1")).rejects.toThrow(/FORBIDDEN/);
    });

    it("FAIL-CLOSED ON DB ERROR: Database error in lifecycle lookup throws SERVICE_UNAVAILABLE and never grants ACTIVE status", async () => {
      mockAuditLogModel.findMany.mockRejectedValue(new Error("Neon connection pool timeout"));

      await expect(getTenantLifecycleStatus("t-1")).rejects.toThrow(/SERVICE_UNAVAILABLE/);
      await expect(isTenantSuspended("t-1")).rejects.toThrow(/SERVICE_UNAVAILABLE/);
    });

    it("FAIL-CLOSED ON MISSING STORAGE: Missing lifecycle storage rejects with SERVICE_UNAVAILABLE and never silently activates a tenant", async () => {
      const originalFindMany = mockAuditLogModel.findMany;
      (mockAuditLogModel as any).findMany = undefined;

      try {
        await expect(getTenantLifecycleStatus("t-1")).rejects.toThrow(/SERVICE_UNAVAILABLE.*Audit storage service is unavailable/);
        await expect(isTenantSuspended("t-1")).rejects.toThrow(/SERVICE_UNAVAILABLE.*Audit storage service is unavailable/);
      } finally {
        mockAuditLogModel.findMany = originalFindMany;
      }
    });

    it("FAIL-CLOSED TENANT CONTEXT: Suspension lookup failure aborts getTenantContext and denies tenant access", async () => {
      mockGetSession.mockResolvedValue({ userId: "user-1", email: "user@acme.com" });
      mockHeadersStore.get.mockReturnValue("t-1");
      mockTenantMemberModel.findUnique.mockResolvedValue({
        user_id: "user-1",
        tenant_id: "t-1",
        role: "MEMBER",
        status: "ACTIVE",
      });
      mockAuditLogModel.findMany.mockRejectedValue(new Error("Database offline"));

      await expect(getTenantContext()).rejects.toThrow(/SERVICE_UNAVAILABLE/);
    });
  });

  describe("4. Tenant Administrator Invitation & Security Lifecycle", () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        userId: "admin-super",
        email: "platform-admin@veyra.io",
      });
    });

    it("SECURE INVITATION: Generates 32-byte cryptographically secure single-use token and stores SHA-256 hash", async () => {
      mockInvitationModel.create.mockImplementation((args: any) => ({
        id: "inv-created-1",
        ...args.data,
      }));
      mockAuditLogModel.create.mockResolvedValue({});

      const result = await inviteTenantAdmin("tenant-100", {
        email: "new-admin@acme.com",
        role: "ADMIN",
      });

      expect(result.success).toBe(true);
      expect(result.invitationId).toBe("inv-created-1");
      expect(result.token).toBeDefined();
      expect(result.token.length).toBe(64); // 32 bytes hex = 64 characters
      expect(result.deliveryStatus).toBe("not_configured");
      expect(result.deliveryMessage).toContain("Email delivery integration is not configured");

      // Verify the stored hash matches SHA-256 of the token
      const expectedHash = crypto.createHash("sha256").update(result.token).digest("hex");

      expect(mockInvitationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: "tenant-100",
            email: "new-admin@acme.com",
            token_hash: expectedHash,
            role: "ADMIN",
            status: "PENDING",
          }),
        })
      );

      // Verify audit logging without exposing token
      expect(mockAuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "ADMIN_INVITE_CREATE",
            entity: "Invitation",
          }),
        })
      );

      const auditData = mockAuditLogModel.create.mock.calls[0][0].data;
      expect(auditData.details).not.toContain(result.token);
    });

    it("REVOCATION: Platform admin can revoke a pending administrator invitation", async () => {
      mockInvitationModel.findUnique.mockResolvedValue({
        id: "inv-pending-1",
        tenant_id: "tenant-100",
        email: "old-admin@acme.com",
        status: "PENDING",
      });
      mockInvitationModel.update.mockResolvedValue({});
      mockAuditLogModel.create.mockResolvedValue({});

      const res = await revokeTenantAdminInvitation("inv-pending-1");

      expect(res.success).toBe(true);
      expect(mockInvitationModel.update).toHaveBeenCalledWith({
        where: { id: "inv-pending-1" },
        data: { status: "REVOKED" },
      });
      expect(mockAuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "ADMIN_INVITE_REVOKE",
            entity: "Invitation",
          }),
        })
      );
    });

    it("REVOCATION PROJECTION: Revoking invitation uses explicit select and never selects token_hash", async () => {
      mockInvitationModel.findUnique.mockResolvedValue({
        id: "inv-pending-1",
        tenant_id: "tenant-100",
        email: "old-admin@acme.com",
        status: "PENDING",
      });
      mockInvitationModel.update.mockResolvedValue({});
      mockAuditLogModel.create.mockResolvedValue({});

      await revokeTenantAdminInvitation("inv-pending-1");

      const select = mockInvitationModel.findUnique.mock.calls[0][0].select;
      expect(select).toBeDefined();
      expect(select).not.toHaveProperty("token_hash");
      expect(select).not.toHaveProperty("token");
    });

    it("LEAST PRIVILEGE: Default administrator role is ADMIN unless explicitly specified", async () => {
      mockInvitationModel.create.mockImplementation((args: any) => ({
        id: "inv-lp",
        ...args.data,
      }));
      mockAuditLogModel.create.mockResolvedValue({});

      await inviteTenantAdmin("tenant-100", { email: "manager@acme.com" });

      expect(mockInvitationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: "ADMIN",
          }),
        })
      );
    });
  });

  describe("5. Confidentiality & Zero Tenant Business Data Exposure", () => {
    it("DIRECT BUSINESS ACCESS BLOCKED: Platform admin cannot use getTenantContext without membership", async () => {
      // Platform admin session with no tenant membership
      mockGetSession.mockResolvedValue({
        userId: "admin-super",
        email: "platform-admin@veyra.io",
      });
      mockTenantMemberModel.findUnique.mockResolvedValue(null);
      mockTenantMemberModel.findMany.mockResolvedValue([]);

      // Attempting to resolve tenant context throws FORBIDDEN
      await expect(getTenantContext()).rejects.toThrow(/FORBIDDEN.*(membership|member)/);
    });

    it("AUDIT PAYLOAD PRIVACY: Administrative events do not store passwords, tokens or CRM payloads", async () => {
      mockGetSession.mockResolvedValue({
        userId: "admin-super",
        email: "platform-admin@veyra.io",
      });
      mockTenantModel.findUnique.mockResolvedValue({ id: "t-1" });
      mockAuditLogModel.findMany.mockResolvedValue([]);
      mockAuditLogModel.create.mockResolvedValue({});

      await suspendTenant("t-1", "Routine maintenance check");

      const callData = mockAuditLogModel.create.mock.calls[0][0].data;
      expect(callData.details).not.toContain("password");
      expect(callData.details).not.toContain("secret");
      expect(callData.details).not.toContain("customer");
    });
  });

  describe("6. Strict Permission Isolation in Tenant Role Management", () => {
    it("TENANT ROLE PERMISSION ISOLATION: assignPermissionsToRole rejects platform.* permissions", async () => {
      const { assignPermissionsToRole } = await import(
        "../src/app/(authenticated)/admin/roles/actions"
      );

      mockTenantMemberModel.findUnique.mockResolvedValue({
        tenant_id: "tenant-1",
        user_id: "tenant-owner-1",
        role: "OWNER",
        status: "ACTIVE",
        roles: [
          {
            role: {
              code: "OWNER",
              status: "ACTIVE",
              permissions: [{ permission: { key: "role.assign_permission" } }],
            },
          },
        ],
      });
      mockHeadersStore.get.mockReturnValue("tenant-1");
      mockGetSession.mockResolvedValue({
        userId: "tenant-owner-1",
        email: "owner@tenant.com",
      });

      await expect(
        assignPermissionsToRole("role-1", ["platform.tenant.view", "customer.read"])
      ).rejects.toThrow(/FORBIDDEN: Platform permissions cannot be assigned to tenant roles/);

      await expect(
        assignPermissionsToRole("role-1", ["platform.tenant.suspend"])
      ).rejects.toThrow(/FORBIDDEN: Platform permissions cannot be assigned to tenant roles/);
    });
  });

  describe("7. Safe Authentication Error Handling and Session Cookie Cleanup", () => {
    it("LOGIN SUSPENSION ERROR: Cleans up cookies and returns safe suspension message", async () => {
      const { loginAction } = await import("../src/app/login/actions");
      const { hashPassword } = await import("../src/lib/auth/password");

      const pwdHash = await hashPassword("validPassword123!");
      mockUserModel.findUnique.mockResolvedValue({
        id: "u-suspended-1",
        email: "user@suspended-co.com",
        password_hash: pwdHash,
        status: "ACTIVE",
      });
      mockTenantMemberModel.findMany.mockResolvedValue([
        { tenant_id: "t-suspended", role: "ADMIN" },
      ]);
      // Mock suspension audit log
      mockAuditLogModel.findMany.mockResolvedValue([
        {
          id: "log-susp",
          tenant_id: "t-suspended",
          entity: "Tenant",
          action: "TENANT_SUSPEND",
          created_at: new Date(),
        },
      ]);

      const formData = new FormData();
      formData.append("email", "user@suspended-co.com");
      formData.append("password", "validPassword123!");

      const result = await loginAction(null, formData);

      expect(result).toHaveProperty("error");
      expect(result?.error).toMatch(/Your organization account is suspended/);
      expect(mockCookiesStore.delete).toHaveBeenCalledWith("session");
      expect(mockCookiesStore.delete).toHaveBeenCalledWith("active_tenant_id");
    });

    it("LOGIN UNEXPECTED ERROR: Cleans up cookies and returns generic error without leaking DB errors", async () => {
      const { loginAction } = await import("../src/app/login/actions");
      const { hashPassword } = await import("../src/lib/auth/password");

      const pwdHash = await hashPassword("validPassword123!");
      mockUserModel.findUnique.mockResolvedValue({
        id: "u-err-1",
        email: "user@err-co.com",
        password_hash: pwdHash,
        status: "ACTIVE",
      });
      // Membership lookup fails with database exception
      mockTenantMemberModel.findMany.mockRejectedValue(new Error("FATAL: relation \"TenantMember\" does not exist (SQL: SELECT * FROM ...)"));

      const formData = new FormData();
      formData.append("email", "user@err-co.com");
      formData.append("password", "validPassword123!");

      const result = await loginAction(null, formData);

      expect(result).toHaveProperty("error");
      expect(result?.error).toBe("Account verification failed. Please try again or contact support.");
      expect(result?.error).not.toContain("FATAL");
      expect(result?.error).not.toContain("TenantMember");
      expect(result?.error).not.toContain("SQL");
      expect(mockCookiesStore.delete).toHaveBeenCalledWith("session");
      expect(mockCookiesStore.delete).toHaveBeenCalledWith("active_tenant_id");
    });
  });

  describe("8. Subscription Metadata & Failure Handling", () => {
    const tenantCreatedAt = new Date("2026-01-01T00:00:00.000Z");

    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        userId: "admin-1",
        email: "platform-admin@veyra.io",
      });
    });

    it("DEFAULT TRIAL: Query succeeds with no subscription records, legitimately returns 7-day default trial", async () => {
      mockAuditLogModel.findMany.mockResolvedValue([]);

      const meta = await getTenantSubscriptionMeta("tenant-new", tenantCreatedAt);

      expect(meta.status).toBe("AVAILABLE");
      expect(meta.planId).toBe("trial");
      expect(meta.planName).toBe("7 Day Trial");
      expect(meta.trialStartDate).toBe(tenantCreatedAt.toISOString());
      expect(meta.trialEndDate).toBe(new Date(tenantCreatedAt.getTime() + 7 * 86400000).toISOString());
    });

    it("QUERY EXCEPTION: Storage/query failure rejects with sanitized SERVICE_UNAVAILABLE and does NOT produce a trial", async () => {
      mockAuditLogModel.findMany.mockRejectedValue(new Error("FATAL: connection timeout on replica pool"));

      await expect(
        getTenantSubscriptionMeta("tenant-err", tenantCreatedAt)
      ).rejects.toThrow(/SERVICE_UNAVAILABLE.*Failed to query subscription metadata/);
    });

    it("MISSING MODEL: Missing audit model rejects with sanitized SERVICE_UNAVAILABLE and does NOT produce trial metadata", async () => {
      const mockEmptyClient = {};

      await expect(
        getTenantSubscriptionMeta("tenant-err", tenantCreatedAt, mockEmptyClient)
      ).rejects.toThrow(/SERVICE_UNAVAILABLE.*Subscription metadata storage is unavailable/);
    });

    it("VALID METADATA: Query succeeds with valid metadata, derives trusted plan name and ignores untrusted names in audit payload", async () => {
      mockAuditLogModel.findMany.mockResolvedValue([
        {
          created_at: new Date(),
          details: JSON.stringify({
            selectedPlanId: "professional",
            selectedPlanName: "Untrusted Spoofed Name From Audit JSON",
          }),
        },
      ]);

      const meta = await getTenantSubscriptionMeta("tenant-pro", tenantCreatedAt);

      expect(meta.status).toBe("AVAILABLE");
      expect(meta.planId).toBe("professional");
      expect(meta.planName).toBe("Professional"); // Derived strictly from trusted configuration
      expect(meta.planName).not.toContain("Spoofed");
    });

    it("MALFORMED JSON: Corrupted details JSON string returns explicit unavailable status without granting a trial", async () => {
      mockAuditLogModel.findMany.mockResolvedValue([
        {
          created_at: new Date(),
          details: "{bad-json-payload-not-parseable",
        },
      ]);

      const meta = await getTenantSubscriptionMeta("tenant-bad-json", tenantCreatedAt);

      expect(meta.status).toBe("UNAVAILABLE");
      expect(meta.planId).toBe("unavailable");
      expect(meta.planName).toBe("Subscription Unavailable");
      expect(meta.trialStartDate).toBeUndefined();
      expect(meta.trialEndDate).toBeUndefined();
    });

    it("INVALID PLAN ID: Unauthorized plan identifiers are rejected with explicit unavailable status and do not grant trial", async () => {
      mockAuditLogModel.findMany.mockResolvedValue([
        {
          created_at: new Date(),
          details: JSON.stringify({
            selectedPlanId: "super_admin_unlimited_unauthorized",
            selectedPlanName: "Fabricated Unlimited Tier",
          }),
        },
      ]);

      expect(ALLOWED_PLAN_IDS.has("super_admin_unlimited_unauthorized")).toBe(false);
      const meta = await getTenantSubscriptionMeta("tenant-hack", tenantCreatedAt);

      expect(meta.status).toBe("UNAVAILABLE");
      expect(meta.planId).toBe("unavailable");
      expect(meta.planName).toBe("Subscription Unavailable");
      expect(meta.planName).not.toContain("Fabricated");
    });

    it("MALFORMED DATES: Invalid date strings return explicit unavailable status without granting trial", async () => {
      mockAuditLogModel.findMany.mockResolvedValue([
        {
          created_at: new Date(),
          details: JSON.stringify({
            selectedPlanId: "enterprise",
            trialStartUtc: "not-a-valid-date-string",
            trialEndUtc: "definitely-not-a-date",
          }),
        },
      ]);

      const meta = await getTenantSubscriptionMeta("tenant-malformed", tenantCreatedAt);

      expect(meta.status).toBe("UNAVAILABLE");
      expect(meta.planId).toBe("unavailable");
      expect(meta.planName).toBe("Subscription Unavailable");
      expect(meta.trialStartDate).toBeUndefined();
      expect(meta.trialEndDate).toBeUndefined();
    });

    it("DATE RANGE INVERSION: Trial end date before start date returns explicit unavailable status", async () => {
      mockAuditLogModel.findMany.mockResolvedValue([
        {
          created_at: new Date(),
          details: JSON.stringify({
            selectedPlanId: "trial",
            trialStartUtc: "2026-03-10T00:00:00.000Z",
            trialEndUtc: "2026-03-01T00:00:00.000Z",
          }),
        },
      ]);

      const meta = await getTenantSubscriptionMeta("tenant-inverted", tenantCreatedAt);

      expect(meta.status).toBe("UNAVAILABLE");
      expect(meta.planId).toBe("unavailable");
      expect(meta.planName).toBe("Subscription Unavailable");
    });

    it("OVERVIEW METRICS: Handles subscription storage failure without counting tenants as confirmed trials", async () => {
      mockTenantModel.findMany.mockResolvedValue([
        { id: "tenant-sub-err", created_at: tenantCreatedAt },
      ]);
      mockAuditLogModel.findMany
        .mockResolvedValueOnce([]) // for getTenantLifecycleStatus
        .mockRejectedValueOnce(new Error("Database connection dropped")); // for getTenantSubscriptionMeta

      const metrics = await getPlatformOverviewMetrics();

      expect(metrics.totalTenants).toBe(1);
      expect(metrics.activeTenants).toBe(1);
      expect(metrics.trialAccounts).toBe(0);
      expect(metrics.trialsExpired).toBe(0);
      expect(metrics.trialsNearingExpiry).toBe(0);
      expect(metrics.planDistribution.unavailable).toBe(1);
    });

    it("TENANT DIRECTORY: Handles subscription storage failure by marking plan as unavailable and excluding from trial filters", async () => {
      mockTenantModel.findMany.mockResolvedValue([
        {
          id: "tenant-sub-err",
          name: "Sub Err Corp",
          created_at: tenantCreatedAt,
        },
      ]);
      mockAuditLogModel.findMany
        .mockResolvedValueOnce([]) // for getTenantLifecycleStatus
        .mockRejectedValueOnce(new Error("Database connection dropped")); // for getTenantSubscriptionMeta

      const dir = await getPlatformTenants({ plan: "trial" });
      expect(dir.items).toHaveLength(0);

      mockTenantModel.findMany.mockResolvedValue([
        {
          id: "tenant-sub-err",
          name: "Sub Err Corp",
          created_at: tenantCreatedAt,
        },
      ]);
      mockAuditLogModel.findMany
        .mockResolvedValueOnce([]) // for getTenantLifecycleStatus
        .mockRejectedValueOnce(new Error("Database connection dropped")); // for getTenantSubscriptionMeta

      const allDir = await getPlatformTenants();
      expect(allDir.items[0].planId).toBe("unavailable");
      expect(allDir.items[0].planName).toBe("Subscription Unavailable");
    });

    it("TENANT DETAILS: Handles subscription storage failure with explicit unavailable state without crashing", async () => {
      mockTenantModel.findUnique.mockResolvedValue({
        id: "tenant-sub-err",
        name: "Sub Err Corp",
        created_at: tenantCreatedAt,
        updated_at: tenantCreatedAt,
      });
      mockAuditLogModel.findMany
        .mockResolvedValueOnce([]) // for getTenantLifecycleStatus
        .mockRejectedValueOnce(new Error("Database connection dropped")) // for getTenantSubscriptionMeta
        .mockResolvedValueOnce([]); // for audit trail query

      const details = await getPlatformTenantDetails("tenant-sub-err");
      expect(details).toBeDefined();
      expect(details?.planId).toBe("unavailable");
      expect(details?.planName).toBe("Subscription Unavailable");
      expect(details?.trialStartDate).toBeNull();
      expect(details?.trialEndDate).toBeNull();
    });
  });

  describe("9. Concurrency Safety in Tenant Lifecycle", () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        userId: "admin-1",
        email: "platform-admin@veyra.io",
      });
    });

    it("CONCURRENT SUSPENSION: Serializes concurrent suspend requests; exactly one succeeds and second is rejected", async () => {
      mockTenantModel.findUnique.mockResolvedValue({ id: "t-concurrent" });
      mockTenantModel.update.mockResolvedValue({});

      const simulatedAuditLogs: any[] = [];
      mockAuditLogModel.findMany.mockImplementation(async () => simulatedAuditLogs.slice());
      mockAuditLogModel.create.mockImplementation(async (args: any) => {
        simulatedAuditLogs.unshift({
          id: `log-${Date.now()}-${Math.random()}`,
          action: args.data.action,
          entity: args.data.entity,
          created_at: new Date(),
          details: args.data.details,
        });
        return {};
      });

      let activeTx = Promise.resolve();
      mockTransaction.mockImplementation((cb: any) => {
        const txPromise = activeTx.then(() =>
          cb({
            Tenant: mockTenantModel,
            tenant: mockTenantModel,
            AuditLog: mockAuditLogModel,
            auditLog: mockAuditLogModel,
          })
        );
        activeTx = txPromise.catch(() => {});
        return txPromise;
      });

      const results = await Promise.allSettled([
        suspendTenant("t-concurrent", "First concurrent suspension reason"),
        suspendTenant("t-concurrent", "Second concurrent suspension reason"),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect((fulfilled[0] as PromiseFulfilledResult<any>).value).toEqual({ success: true });
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason.message).toBe("Tenant is already suspended");

      // Verify exact audit log count: exactly 1 suspend event written, no duplicate
      expect(simulatedAuditLogs).toHaveLength(1);
      expect(simulatedAuditLogs[0].action).toBe("TENANT_SUSPEND");

      // Verify final lifecycle state is SUSPENDED
      const finalStatus = await getTenantLifecycleStatus("t-concurrent");
      expect(finalStatus.status).toBe("SUSPENDED");
    });

    it("CONCURRENT REACTIVATION: Serializes concurrent reactivate requests; exactly one succeeds and second is rejected", async () => {
      mockTenantModel.findUnique.mockResolvedValue({ id: "t-reactivate" });
      mockTenantModel.update.mockResolvedValue({});

      const simulatedAuditLogs: any[] = [
        {
          id: "log-initial-suspend",
          action: "TENANT_SUSPEND",
          entity: "Tenant",
          created_at: new Date(Date.now() - 10000),
          details: JSON.stringify({ reason: "Delinquent payment" }),
        },
      ];
      mockAuditLogModel.findMany.mockImplementation(async () => simulatedAuditLogs.slice());
      mockAuditLogModel.create.mockImplementation(async (args: any) => {
        simulatedAuditLogs.unshift({
          id: `log-${Date.now()}-${Math.random()}`,
          action: args.data.action,
          entity: args.data.entity,
          created_at: new Date(),
          details: args.data.details,
        });
        return {};
      });

      let activeTx = Promise.resolve();
      mockTransaction.mockImplementation((cb: any) => {
        const txPromise = activeTx.then(() =>
          cb({
            Tenant: mockTenantModel,
            tenant: mockTenantModel,
            AuditLog: mockAuditLogModel,
            auditLog: mockAuditLogModel,
          })
        );
        activeTx = txPromise.catch(() => {});
        return txPromise;
      });

      const results = await Promise.allSettled([
        reactivateTenant("t-reactivate"),
        reactivateTenant("t-reactivate"),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect((fulfilled[0] as PromiseFulfilledResult<any>).value).toEqual({ success: true });
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason.message).toBe("Tenant is not currently suspended");

      // Verify exact audit log count: 1 initial suspend + exactly 1 reactivate event
      expect(simulatedAuditLogs).toHaveLength(2);
      expect(simulatedAuditLogs[0].action).toBe("TENANT_REACTIVATE");

      // Verify final lifecycle state is ACTIVE
      const finalStatus = await getTenantLifecycleStatus("t-reactivate");
      expect(finalStatus.status).toBe("ACTIVE");
    });

    it("AUDIT PERSISTENCE FAILURE IN TRANSACTION: Throws error and aborts transaction", async () => {
      mockTenantModel.findUnique.mockResolvedValue({ id: "t-audit-fail" });
      mockTenantModel.update.mockResolvedValue({});
      mockAuditLogModel.findMany.mockResolvedValue([]);
      mockAuditLogModel.create.mockRejectedValue(new Error("Audit log insert failed"));

      await expect(
        suspendTenant("t-audit-fail", "Reason for suspension")
      ).rejects.toThrow("Audit log insert failed");
    });

    it("VALIDATION & SAFETY BOUNDARIES: Missing tenants, invalid IDs, and invalid reasons are rejected safely", async () => {
      // Invalid IDs
      await expect(suspendTenant("", "Valid reason")).rejects.toThrow("Invalid tenant identifier");
      await expect(reactivateTenant("   ")).rejects.toThrow("Invalid tenant identifier");

      // Invalid reason length
      await expect(suspendTenant("t-valid", "ab")).rejects.toThrow("Suspension reason must be between 3 and 500 characters");
      await expect(suspendTenant("t-valid", "a".repeat(501))).rejects.toThrow("Suspension reason must be between 3 and 500 characters");

      // Missing tenant in database
      mockTenantModel.findUnique.mockResolvedValue(null);
      await expect(suspendTenant("t-nonexistent", "Legitimate reason")).rejects.toThrow("Tenant not found");
      await expect(reactivateTenant("t-nonexistent")).rejects.toThrow("Tenant not found");
    });
  });

  describe("10. Transaction Safety, Adapter Behavior & Fail-Closed Boundaries", () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        userId: "admin-1",
        email: "platform-admin@veyra.io",
      });
    });

    it("EXECUTES VIA TRANSACTION: Client with supported transaction method executes callback through transaction client", async () => {
      const mockTxClient = { id: "tx-postgres-8-client" };
      const client = {
        transaction: vi.fn(async (cb: any) => cb(mockTxClient)),
      };

      const result = await runTransaction(client, async (tx: any) => {
        return tx.id;
      });

      expect(client.transaction).toHaveBeenCalledTimes(1);
      expect(result).toBe("tx-postgres-8-client");
    });

    it("EXECUTES VIA $TRANSACTION: Client with supported $transaction method executes callback through transaction client", async () => {
      const mockTxClient = { id: "tx-prisma-client" };
      const client = {
        $transaction: vi.fn(async (cb: any) => cb(mockTxClient)),
      };

      const result = await runTransaction(client, async (tx: any) => {
        return tx.id;
      });

      expect(client.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toBe("tx-prisma-client");
    });

    it("FAILS CLOSED ON UNSUPPORTED CLIENT: Client without transaction method rejects with SERVICE_UNAVAILABLE and does NOT invoke callback", async () => {
      const actionSpy = vi.fn();
      const emptyClient = {};

      await expect(runTransaction(emptyClient, actionSpy)).rejects.toThrow(
        "SERVICE_UNAVAILABLE: Database transaction support is unavailable"
      );
      expect(actionSpy).not.toHaveBeenCalled();

      // Null client check
      await expect(runTransaction(null, actionSpy)).rejects.toThrow(
        "SERVICE_UNAVAILABLE: Database client is unavailable"
      );
      expect(actionSpy).not.toHaveBeenCalled();
    });

    it("PROPAGATES TRANSACTION ROLLBACK: Transaction callback errors propagate to abort transaction", async () => {
      const client = {
        transaction: vi.fn(async (cb: any) => cb({ id: "tx" })),
      };

      await expect(
        runTransaction(client, async () => {
          throw new Error("Conflict error in transaction branch");
        })
      ).rejects.toThrow("Conflict error in transaction branch");
    });

    it("FAIL-CLOSED LIFECYCLE ON SUSPEND: suspendTenant fails closed when transaction support is unavailable", async () => {
      const origTransaction = (db as any).transaction;
      const orig$Transaction = (db as any).$transaction;
      delete (db as any).transaction;
      delete (db as any).$transaction;

      try {
        await expect(
          suspendTenant("t-tx-fail", "Reason for suspension")
        ).rejects.toThrow("SERVICE_UNAVAILABLE: Database transaction support is unavailable");

        expect(mockAuditLogModel.create).not.toHaveBeenCalled();
      } finally {
        (db as any).transaction = origTransaction;
        (db as any).$transaction = orig$Transaction;
      }
    });

    it("FAIL-CLOSED LIFECYCLE ON REACTIVATE: reactivateTenant fails closed when transaction support is unavailable", async () => {
      const origTransaction = (db as any).transaction;
      const orig$Transaction = (db as any).$transaction;
      delete (db as any).transaction;
      delete (db as any).$transaction;

      try {
        await expect(
          reactivateTenant("t-tx-fail")
        ).rejects.toThrow("SERVICE_UNAVAILABLE: Database transaction support is unavailable");

        expect(mockAuditLogModel.create).not.toHaveBeenCalled();
      } finally {
        (db as any).transaction = origTransaction;
        (db as any).$transaction = orig$Transaction;
      }
    });
  });
});
