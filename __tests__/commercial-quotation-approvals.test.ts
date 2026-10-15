/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as TenantContext from "../src/lib/tenant/context";
import * as Boundary from "../src/lib/auth/boundary";
import * as TenantDb from "../src/lib/db/tenant-db";
import {
  evaluateQuotationPolicy,
  submitQuotationForApproval,
  decideQuotationApproval,
  getApprovalSettings,
  updateApprovalSettings
} from "../src/lib/commercial/quotation-approval-service";
import { issueQuotation, addQuotationLine } from "../src/lib/commercial/quotation-service";

const mocks = vi.hoisted(() => {
  const dbData: any = {
    settings: {
      tenant_id: "tenant-1",
      is_approval_enabled: false,
      value_threshold: null,
      currency_id: null,
      min_margin_threshold: null,
      require_separation_of_duties: true
    },
    revs: {} as any,
    reqs: [] as any[],
    recs: [] as any[],
    qs: {} as any
  };

  return {
    getAuthContext: vi.fn().mockResolvedValue({ userId: "u1", tenantId: "tenant-1", role: "Management", permissions: [] }),
    getTenantContext: vi.fn().mockResolvedValue({ tenantId: "tenant-1" }),
    getApprovalSettings: vi.fn().mockImplementation(async () => dbData.settings),
    updateApprovalSettings: vi.fn().mockImplementation(async (data: any) => {
      dbData.settings = { ...dbData.settings, ...data };
      return dbData.settings;
    }),
    dbData
  };
});

vi.mock("../src/lib/auth/boundary", () => ({
  requireTenantContext: mocks.getAuthContext,
  getAuthContext: mocks.getAuthContext,
  requirePermission: vi.fn(),
  checkPermissionForUI: vi.fn()
}));

vi.mock("../src/lib/tenant/context", () => ({
  getTenantContext: mocks.getTenantContext,
  requireTenantContext: mocks.getTenantContext
}));

vi.mock("../src/lib/audit/logger", () => ({
  logAudit: vi.fn()
}));

vi.mock("../src/lib/db/tenant-db", () => {
  const mockDb: any = {
    QuotationApprovalSettings: {
      findUnique: vi.fn(async () => mocks.dbData.settings),
      upsert: vi.fn(async ({ update }: any) => {
        mocks.dbData.settings = { ...mocks.dbData.settings, ...update };
        return mocks.dbData.settings;
      })
    },
    QuotationRevision: {
      findUnique: vi.fn(async ({ where }: any) => {
        const r = mocks.dbData.revs[where.id];
        if (r && r.tenant_id === where.tenant_id) return r;
        if (r && !where.tenant_id) return r;
        return null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        if (mocks.dbData.revs[where.id]) {
           Object.assign(mocks.dbData.revs[where.id], data);
        }
        return mocks.dbData.revs[where.id];
      })
    },
    QuotationApprovalRequest: {
      create: vi.fn(async ({ data }: any) => {
        mocks.dbData.reqs.push(data);
        return data;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        const rs = mocks.dbData.reqs.filter((r:any) => r.quotation_revision_id === where.quotation_revision_id && r.status === where.status);
        return rs[rs.length - 1];
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const req = mocks.dbData.reqs.find((r:any) => r.id === where.id);
        if (req) Object.assign(req, data);
        return req;
      })
    },
    QuotationApprovalRecord: {
      create: vi.fn(async ({ data }: any) => {
        mocks.dbData.recs.push(data);
        return data;
      })
    },
    Quotation: {
      findUnique: vi.fn(async ({ where }: any) => mocks.dbData.qs[where.id]),
      update: vi.fn(async ({ where, data }: any) => {
        if (mocks.dbData.qs[where.id]) Object.assign(mocks.dbData.qs[where.id], data);
        return mocks.dbData.qs[where.id];
      })
    },
    $transaction: vi.fn(async (cb: any) => await cb(mockDb)),
    tdb: { }
  };
  mockDb.tdb = mockDb;
  return { getTenantDb: vi.fn().mockResolvedValue(mockDb) };
});

describe("Quotation Approvals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dbData.settings = {
      tenant_id: "tenant-1",
      is_approval_enabled: false,
      value_threshold: null,
      currency_id: null,
      min_margin_threshold: null,
      require_separation_of_duties: true
    };
    mocks.dbData.revs = {};
    mocks.dbData.reqs = [];
    mocks.dbData.recs = [];
    mocks.dbData.qs = {};
  });

  const setupRevision = (id: string, opts: any = {}) => {
    mocks.dbData.revs[id] = {
      id,
      tenant_id: "tenant-1",
      status: "DRAFT",
      approval_status: "NOT_SUBMITTED",
      total_selling_price: opts.rev || 0,
      total_cost: opts.cost || 0,
      grand_total: opts.grand || 0,
      currency_id: opts.cur || "USD",
      lines: []
    };
    return mocks.dbData.revs[id];
  };

  it("Test 1: Approval disabled allows immediate issue", async () => {
    setupRevision("r1");
    // status is NOT_SUBMITTED, policy requires no approval.
    const res = await submitQuotationForApproval("r1");
    expect(res.message).toBe("Approval not required.");
    expect(mocks.dbData.revs["r1"].approval_status).toBe("NOT_REQUIRED");
  });

  it("Test 2: Approval required because of total threshold", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.value_threshold = 1000;
    mocks.dbData.settings.currency_id = "USD";
    setupRevision("r2", { grand: 1500, cur: "USD" });
    const pol = await evaluateQuotationPolicy(mocks.dbData.revs["r2"]);
    expect(pol.requiresApproval).toBe(true);
    expect(pol.reason).toContain("meets or exceeds the threshold");
  });

  it("Test 3: Approval required because actual margin is below threshold", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.min_margin_threshold = 20; // 20%
    setupRevision("r3", { rev: 100, cost: 90 }); // 10% margin
    const pol = await evaluateQuotationPolicy(mocks.dbData.revs["r3"]);
    expect(pol.requiresApproval).toBe(true);
    expect(pol.reason).toContain("Actual margin");
    expect(pol.reason).toContain("is below the required threshold");
  });

  it("Test 4: Margin above threshold does not require approval", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.min_margin_threshold = 20;
    setupRevision("r4", { rev: 100, cost: 70 }); // 30% margin
    const pol = await evaluateQuotationPolicy(mocks.dbData.revs["r4"]);
    expect(pol.requiresApproval).toBe(false);
  });

  it("Test 5: Value threshold and margin rules combine with OR semantics", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.value_threshold = 1000;
    mocks.dbData.settings.currency_id = "USD";
    mocks.dbData.settings.min_margin_threshold = 20;

    // High margin, but high value -> requires approval
    setupRevision("r5", { rev: 2000, cost: 1000, grand: 2000, cur: "USD" });
    const pol1 = await evaluateQuotationPolicy(mocks.dbData.revs["r5"]);
    expect(pol1.requiresApproval).toBe(true);

    // Low margin, low value -> requires approval
    setupRevision("r5b", { rev: 100, cost: 95, grand: 100, cur: "USD" });
    const pol2 = await evaluateQuotationPolicy(mocks.dbData.revs["r5b"]);
    expect(pol2.requiresApproval).toBe(true);
  });

  it("Test 6: Threshold boundary behavior at exactly the configured value", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.value_threshold = 1000;
    mocks.dbData.settings.currency_id = "USD";
    setupRevision("r6", { grand: 1000, cur: "USD" });
    const pol = await evaluateQuotationPolicy(mocks.dbData.revs["r6"]);
    expect(pol.requiresApproval).toBe(true);
  });

  it("Test 7: Currency mismatch forces explicit review", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.value_threshold = 1000;
    mocks.dbData.settings.currency_id = "USD";
    setupRevision("r7", { grand: 500, cur: "EUR" }); // Value is small, but wrong currency
    const pol = await evaluateQuotationPolicy(mocks.dbData.revs["r7"]);
    expect(pol.requiresApproval).toBe(true);
    expect(pol.reason).toContain("does not match the approval value threshold currency");
  });

  it("Test 8: Submission creates a revision-specific approval record", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.value_threshold = 1000;
    mocks.dbData.settings.currency_id = "USD";
    setupRevision("r8", { grand: 5000, cur: "USD" });

    await submitQuotationForApproval("r8");
    expect(mocks.dbData.revs["r8"].approval_status).toBe("PENDING");
    expect(mocks.dbData.reqs.length).toBe(1);
    expect(mocks.dbData.recs.length).toBe(1);
    expect(mocks.dbData.recs[0].decision).toBe("SUBMITTED");
  });

  it("Test 9: Invalid margin threshold configuration throws error", async () => {
    await expect(updateApprovalSettings({
      is_approval_enabled: true,
      min_margin_threshold: 120,
      require_separation_of_duties: true
    })).rejects.toThrow("Margin threshold must be between 0 and 99.99%.");
  });

  it("Test 10: Missing currency when value threshold is provided throws error", async () => {
    await expect(updateApprovalSettings({
      is_approval_enabled: true,
      value_threshold: 1000,
      require_separation_of_duties: true
    })).rejects.toThrow("Currency must be specified when value threshold is set.");
  });

  it("Test 11: Requester cannot approve their own submission when separation of duties is enabled", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.value_threshold = 1000;
    mocks.dbData.settings.currency_id = "USD";
    setupRevision("r11", { grand: 5000, cur: "USD" });

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-A", tenantId: "tenant-1" });
    await submitQuotationForApproval("r11");

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-A", tenantId: "tenant-1" });
    await expect(decideQuotationApproval("r11", "APPROVED", "LGTM"))
      .rejects.toThrow("Separation of duties is enabled.");
  });

  it("Test 12: Requester can approve their own submission if separation is disabled", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.value_threshold = 1000;
    mocks.dbData.settings.currency_id = "USD";
    mocks.dbData.settings.require_separation_of_duties = false;
    setupRevision("r12", { grand: 5000, cur: "USD" });

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-A", tenantId: "tenant-1" });
    await submitQuotationForApproval("r12");

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-A", tenantId: "tenant-1" });
    await decideQuotationApproval("r12", "APPROVED", "LGTM");

    expect(mocks.dbData.revs["r12"].approval_status).toBe("APPROVED");
  });

  it("Test 13: Valid approval updates authoritative approval state", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.value_threshold = 1000;
    mocks.dbData.settings.currency_id = "USD";
    setupRevision("r13", { grand: 5000, cur: "USD" });

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-A", tenantId: "tenant-1" });
    await submitQuotationForApproval("r13");

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-B", tenantId: "tenant-1" });
    await decideQuotationApproval("r13", "APPROVED", "Looks good");

    expect(mocks.dbData.revs["r13"].approval_status).toBe("APPROVED");
    expect(mocks.dbData.reqs[0].status).toBe("APPROVED");
    expect(mocks.dbData.recs[1].decision).toBe("APPROVED");
  });

  it("Test 14: Return requires comments", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.value_threshold = 1000;
    mocks.dbData.settings.currency_id = "USD";
    setupRevision("r14", { grand: 5000, cur: "USD" });

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-A", tenantId: "tenant-1" });
    await submitQuotationForApproval("r14");

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-B", tenantId: "tenant-1" });
    await expect(decideQuotationApproval("r14", "RETURNED", ""))
      .rejects.toThrow("Comments are required");
  });

  it("Test 15: Return updates state to RETURNED", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.value_threshold = 1000;
    mocks.dbData.settings.currency_id = "USD";
    setupRevision("r15", { grand: 5000, cur: "USD" });

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-A", tenantId: "tenant-1" });
    await submitQuotationForApproval("r15");

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-B", tenantId: "tenant-1" });
    await decideQuotationApproval("r15", "RETURNED", "Fix the discount");

    expect(mocks.dbData.revs["r15"].approval_status).toBe("RETURNED");
  });

  it("Test 16: Resubmission creates new request and preserves history", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.value_threshold = 1000;
    mocks.dbData.settings.currency_id = "USD";
    setupRevision("r16", { grand: 5000, cur: "USD" });

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-A", tenantId: "tenant-1" });
    await submitQuotationForApproval("r16");

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-B", tenantId: "tenant-1" });
    await decideQuotationApproval("r16", "RETURNED", "Fix the discount");

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-A", tenantId: "tenant-1" });
    await submitQuotationForApproval("r16");

    expect(mocks.dbData.revs["r16"].approval_status).toBe("PENDING");
    expect(mocks.dbData.reqs.length).toBe(2);
    expect(mocks.dbData.recs.length).toBe(3); // SUBMITTED -> RETURNED -> SUBMITTED
  });

  it("Test 17: Issue is blocked while approval is pending", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.value_threshold = 1000;
    mocks.dbData.settings.currency_id = "USD";
    setupRevision("r17", { grand: 5000, cur: "USD" });

    await submitQuotationForApproval("r17");

    await expect(issueQuotation("r17")).rejects.toThrow("Cannot issue quotation. Approval status is PENDING");
  });

  it("Test 18: Issue is blocked after return", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.value_threshold = 1000;
    mocks.dbData.settings.currency_id = "USD";
    setupRevision("r18", { grand: 5000, cur: "USD" });

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-A", tenantId: "tenant-1" });
    await submitQuotationForApproval("r18");

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-B", tenantId: "tenant-1" });
    await decideQuotationApproval("r18", "RETURNED", "No");

    await expect(issueQuotation("r18")).rejects.toThrow("Cannot issue quotation. Approval status is RETURNED");
  });

  it("Test 19: Missing or zero cost handled explicitly", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.min_margin_threshold = 20;
    setupRevision("r19", { rev: 100, cost: 0 }); // infinite margin technically, should be 100%
    const pol = await evaluateQuotationPolicy(mocks.dbData.revs["r19"]);
    expect(pol.requiresApproval).toBe(false);
  });

  it("Test 20: Rejected revision cannot be issued or resubmitted", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.value_threshold = 1000;
    mocks.dbData.settings.currency_id = "USD";
    setupRevision("r20", { grand: 5000, cur: "USD" });

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-A", tenantId: "tenant-1" });
    await submitQuotationForApproval("r20");

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-B", tenantId: "tenant-1" });
    await decideQuotationApproval("r20", "REJECTED", "Absolutely not");

    await expect(issueQuotation("r20")).rejects.toThrow("Cannot issue quotation");
    await expect(submitQuotationForApproval("r20")).rejects.toThrow("Rejected revisions cannot be resubmitted.");
  });

  it("Test 21: Pending revision content cannot be edited", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.value_threshold = 1000;
    mocks.dbData.settings.currency_id = "USD";
    setupRevision("r21", { grand: 5000, cur: "USD" });

    await submitQuotationForApproval("r21");

    await expect(addQuotationLine("r21", { product_vendor_id: "pv1", quantity: 1 }))
      .rejects.toThrow("Cannot modify a revision pending approval.");
  });

  it("Test 22: Issue succeeds after approval", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.value_threshold = 1000;
    mocks.dbData.settings.currency_id = "USD";
    setupRevision("r22", { grand: 5000, cur: "USD" });

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-A", tenantId: "tenant-1" });
    await submitQuotationForApproval("r22");

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-B", tenantId: "tenant-1" });
    await decideQuotationApproval("r22", "APPROVED", "OK");

    mocks.dbData.qs["q22"] = { id: "q22" };
    mocks.dbData.revs["r22"].quotation = mocks.dbData.qs["q22"];

    await issueQuotation("r22");
    expect(mocks.dbData.revs["r22"].status).toBe("ISSUED");
  });

  it("Test 23: Duplicate or stale approval decisions are rejected", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.value_threshold = 1000;
    mocks.dbData.settings.currency_id = "USD";
    setupRevision("r23", { grand: 5000, cur: "USD" });

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-A", tenantId: "tenant-1" });
    await submitQuotationForApproval("r23");

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-B", tenantId: "tenant-1" });
    await decideQuotationApproval("r23", "APPROVED", "OK");

    mocks.getAuthContext.mockResolvedValueOnce({ userId: "user-B", tenantId: "tenant-1" });
    await expect(decideQuotationApproval("r23", "APPROVED", "OK AGAIN"))
       .rejects.toThrow("Revision is not pending approval.");
  });

  it("Test 24: Cross-tenant approval decision is denied", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.value_threshold = 1000;
    mocks.dbData.settings.currency_id = "USD";

    // Rev belongs to tenant-2
    mocks.dbData.revs["r24"] = {
      id: "r24", tenant_id: "tenant-2", status: "DRAFT", approval_status: "PENDING", grand_total: 5000
    };

    // User is in tenant-1
    await expect(decideQuotationApproval("r24", "APPROVED", "OK"))
       .rejects.toThrow("Revision not found.");
  });

  it("Test 25: Negative actual margin behaves correctly with thresholds", async () => {
    mocks.dbData.settings.is_approval_enabled = true;
    mocks.dbData.settings.min_margin_threshold = 5; // 5%
    setupRevision("r25", { rev: 100, cost: 150 }); // -50% margin
    const pol = await evaluateQuotationPolicy(mocks.dbData.revs["r25"]);
    expect(pol.requiresApproval).toBe(true);
    expect(pol.reason).toContain("Actual margin (-50%) is below the required threshold (5%)");
  });
});
