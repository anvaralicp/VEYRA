/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPlatformSalesEnquiries,
  updateSalesEnquiryStatus,
} from "../src/lib/platform/sales-service";
import { getPlatformFinancialMetrics } from "../src/lib/platform/financial-service";

const {
  mockGetSession,
  mockSalesEnquiryModel,
  mockTenantModel,
  mockAuditLogModel,
  mockLeadModel,
  mockOpportunityModel,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSalesEnquiryModel: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  mockTenantModel: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  mockAuditLogModel: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  mockLeadModel: {
    findMany: vi.fn(),
  },
  mockOpportunityModel: {
    findMany: vi.fn(),
  },
}));

vi.mock("../src/lib/auth/session", () => ({
  getSession: () => mockGetSession(),
}));

vi.mock("../src/prisma/db", () => {
  const mockDbClient = {
    SalesEnquiry: mockSalesEnquiryModel,
    salesEnquiry: mockSalesEnquiryModel,
    Tenant: mockTenantModel,
    tenant: mockTenantModel,
    AuditLog: mockAuditLogModel,
    auditLog: mockAuditLogModel,
    Lead: mockLeadModel,
    lead: mockLeadModel,
    Opportunity: mockOpportunityModel,
    opportunity: mockOpportunityModel,
  };
  return { db: mockDbClient };
});

describe("Platform Sales & Financial KPIs Control Plane Suite", () => {
  const adminUser = {
    userId: "admin-user-1",
    email: "platform-admin@veyra.io",
  };

  const ordinaryUser = {
    userId: "user-2",
    email: "ordinary@tenant.com",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLATFORM_ADMIN_EMAILS = "platform-admin@veyra.io";
    mockGetSession.mockResolvedValue(adminUser);
    mockAuditLogModel.findMany.mockResolvedValue([]);
    mockAuditLogModel.create.mockResolvedValue({ id: "audit-1" });
    mockTenantModel.findFirst.mockResolvedValue({ id: "system-tenant-1", name: "System" });
  });

  describe("1. Platform Admin Authorization Enforcement", () => {
    it("rejects unauthenticated access to sales enquiries with UNAUTHORIZED", async () => {
      mockGetSession.mockResolvedValue(null);
      await expect(getPlatformSalesEnquiries()).rejects.toThrow(/UNAUTHORIZED/);
    });

    it("rejects non-platform admin access to sales enquiries with FORBIDDEN", async () => {
      mockGetSession.mockResolvedValue(ordinaryUser);
      await expect(getPlatformSalesEnquiries()).rejects.toThrow(/FORBIDDEN/);
    });

    it("rejects non-platform admin access to enquiry status updates", async () => {
      mockGetSession.mockResolvedValue(ordinaryUser);
      await expect(updateSalesEnquiryStatus("enq-1", "QUALIFIED")).rejects.toThrow(/FORBIDDEN/);
    });

    it("rejects non-platform admin access to financial KPIs with FORBIDDEN", async () => {
      mockGetSession.mockResolvedValue(ordinaryUser);
      await expect(getPlatformFinancialMetrics()).rejects.toThrow(/FORBIDDEN/);
    });
  });

  describe("2. Sales Pipeline Querying, Search, and Filtering", () => {
    const mockEnquiries = [
      {
        id: "enq-1",
        reference_number: "ENQ-AAA-111",
        contact_name: "Alice Smith",
        email: "alice@acme.com",
        company: "Acme Corp",
        phone: "+1234567890",
        user_count: "10-50",
        modules: JSON.stringify(["crm", "inventory"]),
        message: "Interested in professional plan",
        status: "NEW",
        created_at: new Date("2026-10-01T10:00:00Z"),
      },
      {
        id: "enq-2",
        reference_number: "ENQ-BBB-222",
        contact_name: "Bob Jones",
        email: "bob@beta.org",
        company: "Beta Org",
        phone: null,
        user_count: "50-100",
        modules: JSON.stringify(["procurement"]),
        message: null,
        status: "QUALIFIED",
        created_at: new Date("2026-10-10T12:00:00Z"),
      },
      {
        id: "enq-3",
        reference_number: "ENQ-CCC-333",
        contact_name: "Charlie Brown",
        email: "charlie@charlie.com",
        company: "Charlie Tech",
        phone: null,
        user_count: "10-50",
        modules: "[]",
        message: null,
        status: "CLOSED",
        created_at: new Date("2026-10-15T15:00:00Z"),
      },
    ];

    it("retrieves and aggregates all enquiries accurately", async () => {
      mockSalesEnquiryModel.findMany.mockResolvedValue(mockEnquiries);
      mockTenantModel.findMany.mockResolvedValue([]);

      const result = await getPlatformSalesEnquiries();
      expect(result.metrics.total).toBe(3);
      expect(result.metrics.newCount).toBe(1);
      expect(result.metrics.qualifiedCount).toBe(1);
      expect(result.metrics.closedCount).toBe(1);
      expect(result.enquiries.length).toBe(3);
    });

    it("filters enquiries by status", async () => {
      mockSalesEnquiryModel.findMany.mockResolvedValue(mockEnquiries);
      mockTenantModel.findMany.mockResolvedValue([]);

      const result = await getPlatformSalesEnquiries({ status: "QUALIFIED" });
      expect(result.enquiries.length).toBe(1);
      expect(result.enquiries[0].referenceNumber).toBe("ENQ-BBB-222");
    });

    it("searches enquiries by contact name, company, email, or reference number", async () => {
      mockSalesEnquiryModel.findMany.mockResolvedValue(mockEnquiries);
      mockTenantModel.findMany.mockResolvedValue([]);

      const searchByCompany = await getPlatformSalesEnquiries({ search: "Acme" });
      expect(searchByCompany.enquiries.length).toBe(1);
      expect(searchByCompany.enquiries[0].contactName).toBe("Alice Smith");

      const searchByRef = await getPlatformSalesEnquiries({ search: "BBB-222" });
      expect(searchByRef.enquiries.length).toBe(1);
      expect(searchByRef.enquiries[0].company).toBe("Beta Org");
    });

    it("filters enquiries by date range", async () => {
      mockSalesEnquiryModel.findMany.mockResolvedValue(mockEnquiries);
      mockTenantModel.findMany.mockResolvedValue([]);

      const dateFiltered = await getPlatformSalesEnquiries({
        startDate: "2026-10-09",
        endDate: "2026-10-12",
      });
      expect(dateFiltered.enquiries.length).toBe(1);
      expect(dateFiltered.enquiries[0].referenceNumber).toBe("ENQ-BBB-222");
    });
  });

  describe("3. Tenant Conversion Detection without Duplication", () => {
    it("detects existing registered tenant matching enquiry company or email", async () => {
      const mockEnquiry = [
        {
          id: "enq-conv-1",
          reference_number: "ENQ-CONV-1",
          contact_name: "Founder Jane",
          email: "jane@startup.io",
          company: "Startup Co",
          user_count: "10-50",
          modules: "[]",
          status: "QUALIFIED",
          created_at: new Date(),
        },
      ];

      mockSalesEnquiryModel.findMany.mockResolvedValue(mockEnquiry);
      // Tenant already registered
      mockTenantModel.findMany.mockResolvedValue([
        { id: "tenant-registered-1", name: "Startup Co", email: "info@startup.io" },
      ]);

      const result = await getPlatformSalesEnquiries();
      expect(result.enquiries[0].matchedTenant).toEqual({
        id: "tenant-registered-1",
        name: "Startup Co",
      });
      expect(result.metrics.convertedCount).toBe(1);
      expect(result.metrics.conversionRatePct).toBe(100);
    });

    it("leaves matchedTenant null when no registered tenant exists", async () => {
      const mockEnquiry = [
        {
          id: "enq-unconv-1",
          reference_number: "ENQ-UNCONV-1",
          contact_name: "Unregistered User",
          email: "unregistered@domain.com",
          company: "Not Registered Yet",
          user_count: "10-50",
          modules: "[]",
          status: "NEW",
          created_at: new Date(),
        },
      ];

      mockSalesEnquiryModel.findMany.mockResolvedValue(mockEnquiry);
      mockTenantModel.findMany.mockResolvedValue([
        { id: "tenant-other", name: "Different Org", email: "other@other.com" },
      ]);

      const result = await getPlatformSalesEnquiries();
      expect(result.enquiries[0].matchedTenant).toBeNull();
      expect(result.metrics.convertedCount).toBe(0);
      expect(result.metrics.conversionRatePct).toBe(0);
    });

    it("matches exact normalized email with whitespace and case variations", async () => {
      const mockEnquiry = [
        {
          id: "enq-email-1",
          reference_number: "ENQ-EMAIL-1",
          contact_name: "John Doe",
          email: "  JOHNDOE@example.COM  ",
          company: "Some Random Name",
          user_count: "10-50",
          modules: "[]",
          status: "NEW",
          created_at: new Date(),
        },
      ];

      mockSalesEnquiryModel.findMany.mockResolvedValue(mockEnquiry);
      mockTenantModel.findMany.mockResolvedValue([
        { id: "tenant-exact-1", name: "Different Legal Name", email: "johndoe@example.com" },
      ]);

      const result = await getPlatformSalesEnquiries();
      expect(result.enquiries[0].matchedTenant).toEqual({
        id: "tenant-exact-1",
        name: "Different Legal Name",
      });
    });

    it("returns null for ambiguous match when multiple tenants share the same email", async () => {
      const mockEnquiry = [
        {
          id: "enq-dup-email",
          reference_number: "ENQ-DUP-EMAIL",
          contact_name: "Shared User",
          email: "shared@holding.com",
          company: "Unknown",
          user_count: "10-50",
          modules: "[]",
          status: "NEW",
          created_at: new Date(),
        },
      ];

      mockSalesEnquiryModel.findMany.mockResolvedValue(mockEnquiry);
      // Two tenants registered with the same contact email
      mockTenantModel.findMany.mockResolvedValue([
        { id: "tenant-dup-1", name: "Holding Division A", email: "shared@holding.com" },
        { id: "tenant-dup-2", name: "Holding Division B", email: "shared@holding.com" },
      ]);

      const result = await getPlatformSalesEnquiries();
      expect(result.enquiries[0].matchedTenant).toBeNull();
    });

    it("returns null when matching solely on short or generic/ambiguous company names", async () => {
      const mockEnquiry = [
        {
          id: "enq-short-co",
          reference_number: "ENQ-SHORT",
          contact_name: "Short Co",
          email: "user@short.org",
          company: "AI", // <= 3 chars
          user_count: "10-50",
          modules: "[]",
          status: "NEW",
          created_at: new Date(),
        },
        {
          id: "enq-generic-co",
          reference_number: "ENQ-GENERIC",
          contact_name: "Generic Co",
          email: "user@generic.org",
          company: "Global", // generic
          user_count: "10-50",
          modules: "[]",
          status: "NEW",
          created_at: new Date(),
        },
      ];

      mockSalesEnquiryModel.findMany.mockResolvedValue(mockEnquiry);
      mockTenantModel.findMany.mockResolvedValue([
        { id: "t-short", name: "AI", email: "admin@ai.com" },
        { id: "t-generic", name: "Global", email: "admin@global.com" },
      ]);

      const result = await getPlatformSalesEnquiries();
      expect(result.enquiries[0].matchedTenant).toBeNull();
      expect(result.enquiries[1].matchedTenant).toBeNull();
    });

    it("returns null when multiple tenants share the same company name (duplicate name ambiguity)", async () => {
      const mockEnquiry = [
        {
          id: "enq-dup-co",
          reference_number: "ENQ-DUP-CO",
          contact_name: "Alice",
          email: "alice@external.com",
          company: "Pinnacle Technologies",
          user_count: "10-50",
          modules: "[]",
          status: "NEW",
          created_at: new Date(),
        },
      ];

      mockSalesEnquiryModel.findMany.mockResolvedValue(mockEnquiry);
      mockTenantModel.findMany.mockResolvedValue([
        { id: "t-pin-1", name: "Pinnacle Technologies", email: "admin1@pin.com" },
        { id: "t-pin-2", name: "Pinnacle Technologies", email: "admin2@pin.com" },
      ]);

      const result = await getPlatformSalesEnquiries();
      expect(result.enquiries[0].matchedTenant).toBeNull();
    });

    it("returns null when candidate company matches but email domains conflict", async () => {
      const mockEnquiry = [
        {
          id: "enq-conflict",
          reference_number: "ENQ-CONFLICT",
          contact_name: "Bob",
          email: "bob@othercorp.com",
          company: "Alpha Delta Logistics",
          user_count: "10-50",
          modules: "[]",
          status: "NEW",
          created_at: new Date(),
        },
      ];

      mockSalesEnquiryModel.findMany.mockResolvedValue(mockEnquiry);
      mockTenantModel.findMany.mockResolvedValue([
        { id: "t-alpha", name: "Alpha Delta Logistics", email: "admin@alphadelta.com" },
      ]);

      const result = await getPlatformSalesEnquiries();
      expect(result.enquiries[0].matchedTenant).toBeNull();
    });
  });

  describe("4. Status Management and Audit Trail", () => {
    it("updates status and records audit log entry", async () => {
      mockSalesEnquiryModel.findUnique.mockResolvedValue({
        id: "enq-100",
        reference_number: "ENQ-100",
        company: "Target Corp",
        status: "NEW",
      });
      mockSalesEnquiryModel.update.mockResolvedValue({
        id: "enq-100",
        status: "QUALIFIED",
      });
      mockTenantModel.findFirst.mockResolvedValue({ id: "tenant-target-1", name: "Target Corp" });

      const res = await updateSalesEnquiryStatus("enq-100", "QUALIFIED", "Demo scheduled with VP");
      expect(res.success).toBe(true);
      expect(res.previousStatus).toBe("NEW");
      expect(res.newStatus).toBe("QUALIFIED");

      expect(mockSalesEnquiryModel.update).toHaveBeenCalledWith({
        where: { id: "enq-100" },
        data: { status: "QUALIFIED" },
      });

      expect(mockAuditLogModel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "SALES_ENQUIRY_STATUS_UPDATE",
          entity: "SalesEnquiry",
          entity_id: "enq-100",
          user_id: "admin-user-1",
        }),
      });
    });

    it("rejects invalid status transitions with clear error", async () => {
      await expect(
        updateSalesEnquiryStatus("enq-100", "INVALID_STATUS" as any)
      ).rejects.toThrow(/Invalid sales enquiry status/);
    });
  });

  describe("5. Financial Dashboard & Revenue Calculations", () => {
    it("computes actual tenant distribution and projected MRR/ARR correctly", async () => {
      mockTenantModel.findMany.mockResolvedValue([
        { id: "t-1", name: "Tenant 1", created_at: new Date() },
        { id: "t-2", name: "Tenant 2", created_at: new Date() },
        { id: "t-3", name: "Tenant 3", created_at: new Date() },
      ]);

      // t-1 on Basic (999), t-2 on Professional (2999), t-3 on Trial (0)
      mockAuditLogModel.findMany.mockImplementation(async ({ where }: any) => {
        if (where?.entity === "TenantSubscription" && where?.tenant_id === "t-1") {
          return [{ details: JSON.stringify({ selectedPlanId: "basic" }), created_at: new Date() }];
        }
        if (where?.entity === "TenantSubscription" && where?.tenant_id === "t-2") {
          return [{ details: JSON.stringify({ selectedPlanId: "professional" }), created_at: new Date() }];
        }
        return []; // default 7-day trial for t-3 or lifecycle status
      });

      const financials = await getPlatformFinancialMetrics();

      expect(financials.actual.totalTenants).toBe(3);
      expect(financials.actual.paidTenants).toBe(2);
      expect(financials.actual.trialTenants).toBe(1);

      // Expected MRR = 999 (basic) + 2999 (professional) = 3998
      expect(financials.projected.mrr).toBe(3998);
      // Expected ARR = 3998 * 12 = 47976
      expect(financials.projected.arr).toBe(47976);
      expect(financials.projected.displayMrr).toBe("₹3,998");
      expect(financials.projected.displayArr).toBe("₹47,976");
    });

    it("accurately handles pending integrations without fabricating revenue", async () => {
      mockTenantModel.findMany.mockResolvedValue([]);

      const financials = await getPlatformFinancialMetrics();

      const collectionsMetric = financials.pendingMetrics.find((m) => m.key === "collections");
      expect(collectionsMetric?.status).toBe("PENDING_INTEGRATION");
      expect(collectionsMetric?.reason).toContain("Live payment gateway");

      const receivablesMetric = financials.pendingMetrics.find((m) => m.key === "outstandingReceivables");
      expect(receivablesMetric?.status).toBe("PENDING_INTEGRATION");

      const recognizedRevenue = financials.pendingMetrics.find((m) => m.key === "recognizedRevenue");
      expect(recognizedRevenue?.status).toBe("PENDING_INTEGRATION");
    });

    it("computes trial aging breakdown correctly", async () => {
      const now = new Date();
      // Fresh trial (6 days remaining -> created 1 day ago)
      const freshDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      // Expired trial (created 10 days ago)
      const expiredDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      mockTenantModel.findMany.mockResolvedValue([
        { id: "t-fresh", name: "Fresh Org", created_at: freshDate },
        { id: "t-exp", name: "Expired Org", created_at: expiredDate },
      ]);

      mockAuditLogModel.findMany.mockResolvedValue([]); // all default trial

      const financials = await getPlatformFinancialMetrics();
      expect(financials.trialAging.freshTrials).toBe(1);
      expect(financials.trialAging.expired).toBe(1);
    });

    it("strictly excludes suspended tenants from projected MRR and ARR", async () => {
      mockTenantModel.findMany.mockResolvedValue([
        { id: "t-active-paid", name: "Active Paid Tenant", created_at: new Date() },
        { id: "t-suspended-paid", name: "Suspended Paid Tenant", created_at: new Date() },
        { id: "t-active-trial", name: "Active Trial Tenant", created_at: new Date() },
      ]);

      mockAuditLogModel.findMany.mockImplementation(async ({ where }: any) => {
        // Lifecycle status check
        if (where?.entity === "Tenant" && where?.action?.in?.includes("TENANT_SUSPEND")) {
          if (where?.tenant_id === "t-suspended-paid") {
            return [{ action: "TENANT_SUSPEND", details: JSON.stringify({ reason: "Non-payment" }), created_at: new Date() }];
          }
          return []; // other tenants are ACTIVE
        }

        // Subscription metadata
        if (where?.entity === "TenantSubscription") {
          if (where?.tenant_id === "t-active-paid") {
            return [{ details: JSON.stringify({ selectedPlanId: "basic" }), created_at: new Date() }];
          }
          if (where?.tenant_id === "t-suspended-paid") {
            // Suspended tenant was on Professional (₹2,999/mo)
            return [{ details: JSON.stringify({ selectedPlanId: "professional" }), created_at: new Date() }];
          }
        }
        return []; // trial for t-active-trial
      });

      const financials = await getPlatformFinancialMetrics();

      expect(financials.actual.totalTenants).toBe(3);
      expect(financials.actual.activeTenants).toBe(2);
      expect(financials.actual.suspendedTenants).toBe(1);
      expect(financials.actual.paidTenants).toBe(2); // total inventory paid
      expect(financials.actual.activePaidTenants).toBe(1); // active revenue-generating paid
      expect(financials.actual.trialTenants).toBe(1);

      // Only t-active-paid (basic = ₹999) contributes to MRR!
      // Suspended t-suspended-paid (professional = ₹2,999) MUST NOT contribute
      expect(financials.projected.mrr).toBe(999);
      expect(financials.projected.arr).toBe(999 * 12);
      expect(financials.projected.displayMrr).toBe("₹999");
      expect(financials.projected.displayArr).toBe("₹11,988");

      // Verify plan breakdown shows active vs total count
      const profPlan = financials.planBreakdown.find((p) => p.planId === "professional");
      expect(profPlan?.count).toBe(1);
      expect(profPlan?.activeCount).toBe(0);
      expect(profPlan?.projectedMonthlyRevenue).toBe(0);

      const basicPlan = financials.planBreakdown.find((p) => p.planId === "basic");
      expect(basicPlan?.count).toBe(1);
      expect(basicPlan?.activeCount).toBe(1);
      expect(basicPlan?.projectedMonthlyRevenue).toBe(999);
    });

    it("handles missing or malformed subscription metadata safely without inflating revenue", async () => {
      mockTenantModel.findMany.mockResolvedValue([
        { id: "t-corrupt-meta", name: "Corrupt Org", created_at: new Date() },
      ]);

      mockAuditLogModel.findMany.mockImplementation(async ({ where }: any) => {
        if (where?.entity === "TenantSubscription") {
          // Corrupt non-JSON or invalid payload
          return [{ details: "NOT_VALID_JSON{", created_at: new Date() }];
        }
        return [];
      });

      const financials = await getPlatformFinancialMetrics();

      expect(financials.actual.totalTenants).toBe(1);
      expect(financials.actual.paidTenants).toBe(0);
      expect(financials.actual.activePaidTenants).toBe(0);
      expect(financials.projected.mrr).toBe(0);
      expect(financials.projected.arr).toBe(0);
    });
  });

  describe("6. Strict Tenant Isolation Verification", () => {
    it("never queries tenant-owned CRM Leads or Opportunities during platform sales or financial operations", async () => {
      mockSalesEnquiryModel.findMany.mockResolvedValue([]);
      mockTenantModel.findMany.mockResolvedValue([]);

      await getPlatformSalesEnquiries();
      await getPlatformFinancialMetrics();

      expect(mockLeadModel.findMany).not.toHaveBeenCalled();
      expect(mockOpportunityModel.findMany).not.toHaveBeenCalled();
    });
  });
});
