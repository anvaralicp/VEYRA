/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import LeadsListPage from "../src/app/(authenticated)/crm/leads/page";
import LeadDetailPage from "../src/app/(authenticated)/crm/leads/[id]/page";

const {
  mockGetLeads,
  mockGetLeadById,
  mockCheckPermissionForUI,
} = vi.hoisted(() => ({
  mockGetLeads: vi.fn(),
  mockGetLeadById: vi.fn(),
  mockCheckPermissionForUI: vi.fn(),
}));

vi.mock("../src/lib/crm/lead-service", () => ({
  getLeads: (q?: string) => mockGetLeads(q),
  getLeadById: (id: string) => mockGetLeadById(id),
}));

vi.mock("../src/lib/auth/boundary", () => ({
  checkPermissionForUI: (perm: string) => mockCheckPermissionForUI(perm),
  requirePermission: vi.fn(),
}));

vi.mock("../src/lib/tenant/context", () => ({
  getTenantContext: vi.fn().mockResolvedValue({ tenantId: "tenant-1", userId: "user-1", role: "ADMIN" }),
}));

vi.mock("../src/lib/db/tenant-db", () => ({
  getTenantDb: vi.fn().mockResolvedValue({}),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

describe("Next.js 15+ Asynchronous searchParams & params", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPermissionForUI.mockResolvedValue(true);
  });

  it("unwraps searchParams Promise in LeadsListPage", async () => {
    mockGetLeads.mockResolvedValue([]);

    // Next.js 15 passes searchParams as a Promise
    const searchParamsPromise = Promise.resolve({ q: "acme enterprise" });
    const jsx: any = await LeadsListPage({ searchParams: searchParamsPromise });

    expect(jsx).toBeDefined();
    expect(mockGetLeads).toHaveBeenCalledWith("acme enterprise");
  });

  it("handles synchronous searchParams in LeadsListPage for backwards compatibility", async () => {
    mockGetLeads.mockResolvedValue([]);

    // Backwards compatibility / synchronous test call
    const jsx: any = await LeadsListPage({ searchParams: { q: "sync query" } });

    expect(jsx).toBeDefined();
    expect(mockGetLeads).toHaveBeenCalledWith("sync query");
  });

  it("unwraps both params Promise and searchParams Promise in LeadDetailPage", async () => {
    mockGetLeadById.mockResolvedValue({
      id: "lead-42",
      lead_number: "LD-00042",
      title: "Enterprise Deal",
      status: "NEW",
    });

    const paramsPromise = Promise.resolve({ id: "lead-42" });
    const searchParamsPromise = Promise.resolve({ tab: "conversion" });

    const jsx: any = await LeadDetailPage({
      params: paramsPromise,
      searchParams: searchParamsPromise,
    });

    expect(jsx).toBeDefined();
    expect(mockGetLeadById).toHaveBeenCalledWith("lead-42");
    expect(jsx.props.activeTab).toBe("conversion");
  });
});
