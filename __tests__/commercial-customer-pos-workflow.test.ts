import { describe, it, expect, vi, beforeEach } from "vitest";
import * as POService from "../src/lib/commercial/customer-po-service";
import * as FulfilmentService from "../src/lib/commercial/fulfilment-service";

const mocks = vi.hoisted(() => {
  return {
    getTenantContext: vi.fn().mockResolvedValue({ tenantId: "tenant-1", userId: "user-1", roleId: "role-1" }),
    requirePermission: vi.fn().mockResolvedValue(true),
    logAudit: vi.fn().mockResolvedValue(true),
    getTenantDb: vi.fn(),
  };
});

vi.mock("../src/lib/tenant/context", () => ({ getTenantContext: mocks.getTenantContext }));
vi.mock("../src/lib/auth/boundary", () => ({ requirePermission: mocks.requirePermission, checkPermissionForUI: vi.fn().mockResolvedValue(true) }));
vi.mock("../src/lib/audit/logger", () => ({ logAudit: mocks.logAudit }));

const mockCPO = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};
const mockCPOLine = {
  create: vi.fn(),
  findMany: vi.fn(),
};
const mockCPOV = {
  create: vi.fn(),
};
const mockQuotationRevision = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
};
const mockFulfilmentOrder = {
  findUnique: vi.fn(),
  create: vi.fn(),
};
const mockFulfilmentOrderLine = {
  create: vi.fn(),
};
const mockFulfilmentOrderStatusHistory = {
  create: vi.fn(),
};

mocks.getTenantDb.mockResolvedValue({
  tdb: {
    CustomerPurchaseOrder: mockCPO,
    CustomerPurchaseOrderLine: mockCPOLine,
    CustomerPurchaseOrderValidation: mockCPOV,
    QuotationRevision: mockQuotationRevision,
    FulfilmentOrder: mockFulfilmentOrder,
    FulfilmentOrderLine: mockFulfilmentOrderLine,
    FulfilmentOrderStatusHistory: mockFulfilmentOrderStatusHistory,
    $transaction: vi.fn().mockImplementation(async (cb) => {
      return cb({
        CustomerPurchaseOrder: mockCPO,
        CustomerPurchaseOrderLine: mockCPOLine,
        CustomerPurchaseOrderValidation: mockCPOV,
        FulfilmentOrder: mockFulfilmentOrder,
        FulfilmentOrderLine: mockFulfilmentOrderLine,
        FulfilmentOrderStatusHistory: mockFulfilmentOrderStatusHistory,
      });
    }),
  },
});

vi.mock("../src/lib/db/tenant-db", () => ({ getTenantDb: mocks.getTenantDb }));

describe("Customer Purchase Order Workflow & Service Extensions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listCustomerPOs", () => {
    it("lists customer POs with pagination and search query", async () => {
      const mockItems = [
        { id: "po-1", po_number: "PO-100", customer: { name: "Acme Corp" } },
        { id: "po-2", po_number: "PO-101", customer: { name: "Beta LLC" } },
      ];
      mockCPO.findMany.mockResolvedValue(mockItems);
      mockCPO.count.mockResolvedValue(2);

      const result = await POService.listCustomerPOs({
        search: "Acme",
        status: "VALIDATED",
        page: 1,
        limit: 10,
      });

      expect(mocks.requirePermission).toHaveBeenCalledWith("customer_po.view");
      expect(mockCPO.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: "tenant-1",
            status: "VALIDATED",
            OR: expect.any(Array),
          }),
          skip: 0,
          take: 10,
        })
      );
      expect(result.items).toEqual(mockItems);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
    });

    it("handles empty filters and default pagination gracefully", async () => {
      mockCPO.findMany.mockResolvedValue([]);
      mockCPO.count.mockResolvedValue(0);

      const result = await POService.listCustomerPOs();
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe("getCustomerPO", () => {
    it("retrieves a customer PO scoped to tenant with all relations", async () => {
      const samplePO = {
        id: "po-1",
        tenant_id: "tenant-1",
        po_number: "PO-001",
        lines: [{ id: "pol-1", line_number: 1 }],
        validations: [],
        fulfilmentOrder: null,
      };
      mockCPO.findUnique.mockResolvedValue(samplePO);

      const res = await POService.getCustomerPO("po-1");
      expect(mocks.requirePermission).toHaveBeenCalledWith("customer_po.view");
      expect(mockCPO.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "po-1", tenant_id: "tenant-1" },
          include: expect.objectContaining({
            customer: true,
            opportunity: true,
            quotation: true,
            quotationRevision: expect.any(Object),
            lines: expect.any(Object),
            validations: expect.any(Object),
            fulfilmentOrder: expect.any(Object),
          }),
        })
      );
      expect(res).toEqual(samplePO);
    });
  });

  describe("createCustomerPO with line items and quotation auto-import", () => {
    it("creates PO and auto-populates quotation and opportunity from revision", async () => {
      mockQuotationRevision.findUnique.mockResolvedValue({
        id: "rev-1",
        status: "ISSUED",
        quotation: { id: "q-1", customer_id: "cust-1", opportunity_id: "opp-1" },
        lines: [
          {
            id: "ql-1",
            item_code_snapshot: "SKU-A",
            item_description_snapshot: "Widget A",
            quantity: 5,
            unit_selling_price: 100,
            unit_of_measure: "EA",
            tax_rate: 10,
            tax_amount: 50,
            line_total: 550,
          },
        ],
      });
      mockCPO.findUnique.mockResolvedValue(null);
      mockCPO.create.mockResolvedValue({ id: "po-10", status: "DRAFT" });

      const res = await POService.createCustomerPO({
        po_number: "PO-IMPORT-1",
        customer_id: "cust-1",
        quotation_revision_id: "rev-1",
        currency_id: "usd",
        po_date: "2026-10-01",
        received_date: "2026-10-02",
        subtotal: 500,
        tax_total: 50,
        grand_total: 550,
        import_quotation_lines: true,
      });

      expect(res.id).toBe("po-10");
      expect(mockCPO.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quotation_id: "q-1",
            opportunity_id: "opp-1",
          }),
        })
      );
      // Auto-imported line item created
      expect(mockCPOLine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customer_purchase_order_id: "po-10",
            customer_item_code: "SKU-A",
            quotation_line_id: "ql-1",
            quantity: 5,
            unit_price: 100,
          }),
        })
      );
    });

    it("creates PO with explicit custom lines array", async () => {
      mockCPO.findUnique.mockResolvedValue(null);
      mockCPO.create.mockResolvedValue({ id: "po-20", status: "DRAFT" });

      await POService.createCustomerPO({
        po_number: "PO-CUSTOM-1",
        customer_id: "cust-1",
        currency_id: "usd",
        po_date: "2026-10-01",
        received_date: "2026-10-02",
        subtotal: 200,
        tax_total: 20,
        grand_total: 220,
        lines: [
          {
            customer_item_code: "CUSTOM-01",
            customer_item_description: "Custom Service",
            quantity: 2,
            unit_price: 100,
            unit_of_measure: "HR",
            line_total: 200,
          },
        ],
      });

      expect(mockCPOLine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customer_purchase_order_id: "po-20",
            customer_item_code: "CUSTOM-01",
            quantity: 2,
            unit_price: 100,
          }),
        })
      );
    });
  });

  describe("deleteCustomerPO", () => {
    it("deletes a DRAFT customer PO", async () => {
      mockCPO.findUnique.mockResolvedValue({ id: "po-draft", status: "DRAFT" });
      mockCPO.delete.mockResolvedValue({ id: "po-draft" });

      await POService.deleteCustomerPO("po-draft");
      expect(mocks.requirePermission).toHaveBeenCalledWith("customer_po.delete");
      expect(mockCPO.delete).toHaveBeenCalledWith({
        where: { id: "po-draft", tenant_id: "tenant-1" },
      });
      expect(mocks.logAudit).toHaveBeenCalledWith("CUSTOMER_PO_DELETED", "CustomerPurchaseOrder", "po-draft", null);
    });

    it("refuses to delete a non-DRAFT customer PO", async () => {
      mockCPO.findUnique.mockResolvedValue({ id: "po-active", status: "SUBMITTED" });
      await expect(POService.deleteCustomerPO("po-active")).rejects.toThrow(
        "Only DRAFT Customer POs can be deleted"
      );
      expect(mockCPO.delete).not.toHaveBeenCalled();
    });

    it("throws not found when deleting nonexistent or other tenant's PO", async () => {
      mockCPO.findUnique.mockResolvedValue(null);
      await expect(POService.deleteCustomerPO("po-missing")).rejects.toThrow("Customer PO not found");
      expect(mockCPO.delete).not.toHaveBeenCalled();
    });
  });

  describe("End-to-End Workflow with Fulfilment Order Creation", () => {
    it("completes full lifecycle: DRAFT -> SUBMITTED -> VALIDATED -> Fulfilment Order", async () => {
      // 1. Submit PO
      mockCPO.findUnique.mockResolvedValueOnce({ id: "po-wf", status: "DRAFT" });
      await POService.submitCustomerPO("po-wf");
      expect(mockCPO.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "po-wf" },
          data: expect.objectContaining({ status: "SUBMITTED" }),
        })
      );

      // 2. Validate PO (no discrepancies)
      const poForValidation = {
        id: "po-wf",
        status: "SUBMITTED",
        subtotal: 100,
        tax_total: 10,
        grand_total: 110,
        currency_id: "usd",
        lines: [],
        quotationRevision: { grand_total: 110, currency_id: "usd", lines: [] },
      };
      mockCPO.findUnique.mockResolvedValueOnce(poForValidation);
      mockCPO.findUnique.mockResolvedValueOnce(poForValidation);
      await POService.validateCustomerPO("po-wf", "VALIDATED", "All items match quotation");
      expect(mockCPOV.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customer_purchase_order_id: "po-wf",
            new_status: "VALIDATED",
            comments: "All items match quotation",
          }),
        })
      );

      // 3. Convert to Fulfilment Order
      mockCPO.findUnique.mockResolvedValueOnce({
        id: "po-wf",
        customer_id: "cust-1",
        status: "VALIDATED",
        quotation_revision_id: "rev-1",
        lines: [
          {
            id: "line-1",
            customer_item_code: "ITEM-A",
            customer_item_description: "Product A",
            quotation_line_id: "ql-1",
            quantity: 5,
            unit_of_measure: "EA",
          },
        ],
      });
      mockFulfilmentOrder.findUnique.mockResolvedValueOnce(null);
      mockFulfilmentOrder.create.mockResolvedValueOnce({ id: "fo-1", order_number: "FO-123456" });

      const fo = await FulfilmentService.createFulfilmentOrderFromCustomerPO("po-wf");
      expect(fo.id).toBe("fo-1");
      expect(mockFulfilmentOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customer_purchase_order_id: "po-wf",
            customer_id: "cust-1",
            status: "OPEN",
          }),
        })
      );
      expect(mockFulfilmentOrderLine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fulfilment_order_id: "fo-1",
            customer_purchase_order_line_id: "line-1",
            accepted_quantity: 5,
            planned_quantity: 5,
          }),
        })
      );
      expect(mockFulfilmentOrderStatusHistory.create).toHaveBeenCalled();
    });

    it("prevents creating multiple fulfilment orders for the same Customer PO", async () => {
      mockCPO.findUnique.mockResolvedValueOnce({
        id: "po-dup",
        status: "VALIDATED",
        lines: [],
      });
      mockFulfilmentOrder.findUnique.mockResolvedValueOnce({
        id: "fo-already-exists",
        customer_purchase_order_id: "po-dup",
      });

      await expect(
        FulfilmentService.createFulfilmentOrderFromCustomerPO("po-dup")
      ).rejects.toThrow("Fulfilment order already exists for this Customer PO");
      expect(mockFulfilmentOrder.create).not.toHaveBeenCalled();
    });
  });
});
