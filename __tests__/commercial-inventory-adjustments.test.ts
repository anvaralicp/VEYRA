import { describe, it, expect, beforeEach, vi } from "vitest";
import { Decimal } from "decimal.js";
import { createStockCount, addStockCountLine, submitStockCount } from "../src/lib/inventory/stock-count-service";
import { createManualAdjustment, postAdjustmentAtomic, createAndPostAdjustmentsForStockCount } from "../src/lib/inventory/adjustment-service";
import { runReconciliation } from "../src/lib/inventory/reconciliation-service";

const mocks = vi.hoisted(() => {
  return {
    getTenantContext: vi.fn(),
    requirePermission: vi.fn(),
    logAudit: vi.fn(),
    getTenantDb: vi.fn()
  };
});

vi.mock("../src/lib/tenant/context", () => ({ getTenantContext: mocks.getTenantContext }));
vi.mock("../src/lib/auth/boundary", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("../src/lib/audit/logger", () => ({ logAudit: mocks.logAudit }));
vi.mock("../src/lib/db/tenant-db", () => ({ getTenantDb: mocks.getTenantDb }));

type InventoryClient = typeof mockInventory;
type TransactionCallback = (tx: InventoryClient) => unknown;

const mockInventory = {
  StockLocation: { findUnique: vi.fn() },
  StockCount: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  StockCountLine: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  InventoryAdjustment: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  InventoryLedger: { create: vi.fn(), findMany: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn() }
};

const mockDb = {
  inventory: mockInventory,
  commercial: {
    ProductService: { findUnique: vi.fn() }
  },
  $transaction: vi.fn((cb: TransactionCallback) => {
    console.error("RUNNING MOCK TRANSACTION");
    return cb(mockInventory);
  })
};

describe("Inventory Stock Adjustments & Reconciliation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getTenantContext.mockResolvedValue({ tenantId: "tenant-1", userId: "user-1" });
    mocks.getTenantDb.mockResolvedValue({ ...mockDb, tdb: mockDb.inventory });
    mockDb.$transaction.mockImplementation((cb: TransactionCallback) => cb(mockDb.inventory));
    mocks.requirePermission.mockResolvedValue(true);
  });

  describe("Stock Counts", () => {
    it("1. Create a stock count", async () => {
      mockDb.inventory.StockLocation.findUnique.mockResolvedValue({ id: "loc-1", is_active: true });
      mockDb.inventory.StockCount.create.mockResolvedValue({ id: "count-1", status: "DRAFT" });

      const count = await createStockCount("loc-1", "Monthly count");
      expect(count.id).toBe("count-1");
      expect(mockDb.inventory.StockCount.create).toHaveBeenCalled();
    });

    it("3. Reject inactive stock locations", async () => {
      mockDb.inventory.StockLocation.findUnique.mockResolvedValue({ id: "loc-1", is_active: false });
      await expect(createStockCount("loc-1")).rejects.toThrow("inactive");
    });

    it("4. Reject non-stockable products", async () => {
      mockDb.inventory.StockCount.findUnique.mockResolvedValue({ id: "count-1", status: "DRAFT" });
      mockDb.commercial.ProductService.findUnique.mockResolvedValue({ id: "prod-1", is_stockable: false });

      await expect(addStockCountLine("count-1", "prod-1", 10)).rejects.toThrow("non-stockable");
    });

    it("5. Reject negative physical counts", async () => {
      mockDb.inventory.StockCount.findUnique.mockResolvedValue({ id: "count-1", status: "DRAFT" });
      mockDb.commercial.ProductService.findUnique.mockResolvedValue({ id: "prod-1", is_stockable: true });

      await expect(addStockCountLine("count-1", "prod-1", -5)).rejects.toThrow("negative");
    });

    it("6. Calculate positive variances correctly", async () => {
      mockDb.inventory.StockCount.findUnique.mockResolvedValue({ id: "count-1", status: "DRAFT", stock_location_id: "loc-1" });
      mockDb.commercial.ProductService.findUnique.mockResolvedValue({ id: "prod-1", is_stockable: true });
      mockDb.inventory.InventoryLedger.findMany.mockResolvedValue([{ quantity_delta: new Decimal(10) }]);
      mockDb.inventory.StockCountLine.findUnique.mockResolvedValue(null);
      mockDb.inventory.StockCountLine.create.mockResolvedValue({ variance: new Decimal(5) });

      await addStockCountLine("count-1", "prod-1", 15);
      expect(mockDb.inventory.StockCountLine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ expected_quantity: new Decimal(10), counted_quantity: new Decimal(15), variance: new Decimal(5) })
        })
      );
    });

    it("7. Calculate negative variances correctly", async () => {
      mockDb.inventory.StockCount.findUnique.mockResolvedValue({ id: "count-1", status: "DRAFT", stock_location_id: "loc-1" });
      mockDb.commercial.ProductService.findUnique.mockResolvedValue({ id: "prod-1", is_stockable: true });
      mockDb.inventory.InventoryLedger.findMany.mockResolvedValue([{ quantity_delta: new Decimal(20) }]);
      mockDb.inventory.StockCountLine.findUnique.mockResolvedValue(null);

      await addStockCountLine("count-1", "prod-1", 15);
      expect(mockDb.inventory.StockCountLine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ expected_quantity: new Decimal(20), counted_quantity: new Decimal(15), variance: new Decimal(-5) })
        })
      );
    });

    it("10. Reject unauthorized count submission", async () => {
      mocks.requirePermission.mockRejectedValue(new Error("Unauthorized"));
      await expect(submitStockCount("count-1")).rejects.toThrow("Unauthorized");
    });
  });

  describe("Adjustments", () => {
    it("12. Require a valid reason for posting (manual adj)", async () => {
      mockDb.commercial.ProductService.findUnique.mockResolvedValue({ is_stockable: true });
      await expect(createManualAdjustment({
        stock_location_id: "loc-1",
        product_service_id: "prod-1",
        adjustment_type: "LOSS",
        quantity_delta: -5,
        reason: ""
      })).rejects.toThrow("Reason is required");
    });

    it("13. Prevent duplicate adjustment posting", async () => {
      mockDb.inventory.InventoryAdjustment.findUnique.mockResolvedValue({ status: "POSTED" });
      await expect(postAdjustmentAtomic("adj-1")).rejects.toThrow("already posted");
    });

    it("14. Create the correct signed ledger movement", async () => {
      mockDb.inventory.InventoryAdjustment.findUnique.mockResolvedValue({
        id: "adj-1",
        status: "DRAFT",
        quantity_delta: new Decimal(-5),
        product_service_id: "prod-1",
        stock_location_id: "loc-1",
        reason: "Lost item"
      });
      mockDb.commercial.ProductService.findUnique.mockResolvedValue({ is_stockable: true });

      await postAdjustmentAtomic("adj-1");

      expect(mockDb.inventory.InventoryLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movement_type: "ADJUSTMENT",
            quantity_delta: new Decimal(-5)
          })
        })
      );
    });

    it("16. Detect stale counts when inventory changes after snapshot", async () => {
      mockDb.inventory.InventoryAdjustment.findUnique.mockResolvedValue({
        id: "adj-1", status: "DRAFT",
        stockCountLine: { snapshot_date: new Date("2020-01-01"), expected_quantity: new Decimal(10) },
        product_service_id: "prod-1",
        stock_location_id: "loc-1"
      });
      mockDb.commercial.ProductService.findUnique.mockResolvedValue({ is_stockable: true });
      mockDb.inventory.InventoryLedger.aggregate.mockResolvedValue({ _sum: { quantity_delta: new Decimal(2) } });
      mockDb.inventory.InventoryLedger.findMany.mockResolvedValue([]);

      await expect(postAdjustmentAtomic("adj-1")).rejects.toThrow("Stale count");
    });

    it("18. Reject posting for a cancelled count", async () => {
      mockDb.inventory.StockCount.findUnique.mockResolvedValue({ id: "count-1", status: "CANCELLED" });
      await expect(createAndPostAdjustmentsForStockCount("count-1")).rejects.toThrow("must be SUBMITTED");
    });
  });

  describe("Reconciliation", () => {
    it("22. Reconcile ledger balances correctly", async () => {
      mockDb.inventory.InventoryLedger.groupBy.mockResolvedValue([{ product_service_id: "prod-1" }]);
      mockDb.inventory.InventoryLedger.findMany.mockResolvedValue([{ quantity_delta: new Decimal(50) }]);

      const results = await runReconciliation("loc-1");
      expect(results[0].ledger_quantity).toBe("50");
      expect(results[0].status).toBe("RECONCILED");
    });
  });

});
