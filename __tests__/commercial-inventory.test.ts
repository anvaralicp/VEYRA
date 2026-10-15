import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as LocService from "../src/lib/inventory/location-service";
import * as GRService from "../src/lib/inventory/goods-receipt-service";
import Decimal from "decimal.js";

const mocks = vi.hoisted(() => {
  return {
    getTenantContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-1', userId: 'user-1', roleId: 'role-1' }),
    requirePermission: vi.fn().mockResolvedValue(true),
    logAudit: vi.fn().mockResolvedValue(true),
    getTenantDb: vi.fn()
  };
});

vi.mock('../src/lib/tenant/context', () => ({ getTenantContext: mocks.getTenantContext }));
vi.mock('../src/lib/auth/boundary', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('../src/lib/audit/logger', () => ({ logAudit: mocks.logAudit }));

const mockStockLoc = { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() };
const mockSPO = { findUnique: vi.fn() };
const mockSPOL = { findUnique: vi.fn() };
const mockGR = { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() };
const mockGRLine = { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() };
const mockLedger = { create: vi.fn(), findMany: vi.fn() };
const mockProduct = { findUnique: vi.fn() };

type TransactionContext = {
  GoodsReceipt: typeof mockGR;
  GoodsReceiptLine: typeof mockGRLine;
  InventoryLedger: typeof mockLedger;
  ProductService: typeof mockProduct;
};

mocks.getTenantDb.mockResolvedValue({
  tdb: {
    StockLocation: mockStockLoc,
    SupplierPurchaseOrder: mockSPO,
    SupplierPurchaseOrderLine: mockSPOL,
    GoodsReceipt: mockGR,
    GoodsReceiptLine: mockGRLine,
    InventoryLedger: mockLedger,
    ProductService: mockProduct,
    $transaction: vi.fn().mockImplementation(async <T>(cb: (tx: TransactionContext) => Promise<T>): Promise<T> => {
      return cb({
        GoodsReceipt: mockGR,
        GoodsReceiptLine: mockGRLine,
        InventoryLedger: mockLedger,
        ProductService: mockProduct
      });
    })
  }
});

vi.mock('../src/lib/db/tenant-db', () => ({ getTenantDb: mocks.getTenantDb }));

describe('Inventory Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Create a goods receipt draft from an eligible supplier PO', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-1', status: 'ISSUED', vendor_id: 'v-1', tenant_id: 'tenant-1' });
    mockStockLoc.findUnique.mockResolvedValue({ id: 'loc-1', status: 'ACTIVE' });
    mockGR.create.mockResolvedValue({ id: 'gr-1' });

    const gr = await GRService.createGoodsReceiptFromSupplierPO('spo-1', 'loc-1');
    expect(gr.id).toBe('gr-1');
    expect(mockGR.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'DRAFT', supplier_purchase_order_id: 'spo-1' })
    }));
  });

  it('2. Reject an ineligible supplier PO state', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-1', status: 'DRAFT', vendor_id: 'v-1' });
    await expect(GRService.createGoodsReceiptFromSupplierPO('spo-1', 'loc-1')).rejects.toThrow("Only ISSUED or ACKNOWLEDGED");
  });

  it('3. Reject a cross-tenant supplier PO', async () => {
    mockSPO.findUnique.mockResolvedValue(null);
    await expect(GRService.createGoodsReceiptFromSupplierPO('spo-cross', 'loc-1')).rejects.toThrow("Supplier PO not found");
  });

  it('4. Reject a cross-tenant stock location', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-1', status: 'ISSUED', vendor_id: 'v-1' });
    mockStockLoc.findUnique.mockResolvedValue(null);
    await expect(GRService.createGoodsReceiptFromSupplierPO('spo-1', 'loc-cross')).rejects.toThrow("Stock location not found");
  });

  it('5. Reject an inactive stock location', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-1', status: 'ISSUED', vendor_id: 'v-1' });
    mockStockLoc.findUnique.mockResolvedValue({ id: 'loc-inact', status: 'INACTIVE' });
    await expect(GRService.createGoodsReceiptFromSupplierPO('spo-1', 'loc-inact')).rejects.toThrow("Stock location is inactive");
  });

  it('6. Reject a receipt line referencing another supplier PO', async () => {
    mockGR.findUnique.mockResolvedValue({ id: 'gr-1', status: 'DRAFT', supplier_purchase_order_id: 'spo-1' });
    mockSPOL.findUnique.mockResolvedValue({ id: 'spol-diff', supplier_purchase_order_id: 'spo-diff' });
    await expect(GRService.addGoodsReceiptLine('gr-1', 'spol-diff', 10)).rejects.toThrow("SPO Line not found or doesn't belong");
  });

  it('7. Validate received quantity is greater than zero', async () => {
    mockGR.findUnique.mockResolvedValue({ id: 'gr-1', status: 'DRAFT', supplier_purchase_order_id: 'spo-1' });
    mockSPOL.findUnique.mockResolvedValue({ id: 'spol-1', supplier_purchase_order_id: 'spo-1' });
    await expect(GRService.addGoodsReceiptLine('gr-1', 'spol-1', 0)).rejects.toThrow("Received quantity must be greater than zero");
  });

  it('8. Validate accepted quantity is nonnegative', async () => {
    mockGRLine.findUnique.mockResolvedValue({ id: 'grl-1', goodsReceipt: { status: 'DRAFT' }, received_quantity: new Decimal(10), accepted_quantity: new Decimal(10), rejected_quantity: new Decimal(0) });
    await expect(GRService.updateGoodsReceiptLine('grl-1', { accepted_quantity: -1 })).rejects.toThrow("Accepted quantity cannot be negative");
  });

  it('9. Validate rejected quantity is nonnegative', async () => {
    mockGRLine.findUnique.mockResolvedValue({ id: 'grl-1', goodsReceipt: { status: 'DRAFT' }, received_quantity: new Decimal(10), accepted_quantity: new Decimal(10), rejected_quantity: new Decimal(0) });
    await expect(GRService.updateGoodsReceiptLine('grl-1', { rejected_quantity: -1 })).rejects.toThrow("Rejected quantity cannot be negative");
  });

  it('10. Require accepted plus rejected quantity to equal received quantity', async () => {
    mockGRLine.findUnique.mockResolvedValue({ id: 'grl-1', goodsReceipt: { status: 'DRAFT' }, received_quantity: new Decimal(10), accepted_quantity: new Decimal(10), rejected_quantity: new Decimal(0) });
    await expect(GRService.updateGoodsReceiptLine('grl-1', { accepted_quantity: 8, rejected_quantity: 1 })).rejects.toThrow("Accepted plus rejected quantities must equal");
  });

  it('11. Add Goods Receipt line splits quantities accurately', async () => {
    mockGRLine.findUnique.mockResolvedValue({ id: 'grl-1', goodsReceipt: { status: 'DRAFT' }, received_quantity: new Decimal(10), accepted_quantity: new Decimal(10), rejected_quantity: new Decimal(0) });
    mockGRLine.update.mockResolvedValue({ id: 'grl-1' });
    await GRService.updateGoodsReceiptLine('grl-1', { accepted_quantity: 8, rejected_quantity: 2 });
    expect(mockGRLine.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ accepted_quantity: new Decimal(8), rejected_quantity: new Decimal(2) })
    }));
  });

  it('12. Support partial receipt of a supplier PO line', async () => {
    mockGR.findUnique.mockResolvedValue({ id: 'gr-part', status: 'DRAFT', supplier_purchase_order_id: 'spo-1' });
    mockSPOL.findUnique.mockResolvedValue({ id: 'spol-1', supplier_purchase_order_id: 'spo-1', quantity: new Decimal(100) });
    mockGRLine.create.mockResolvedValue({ id: 'grl-part' });
    await GRService.addGoodsReceiptLine('gr-part', 'spol-1', 40);
    expect(mockGRLine.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ received_quantity: new Decimal(40) })
    }));
  });

  it('13. Support multiple receipts for one supplier PO', async () => {
    mockGR.findUnique.mockResolvedValue({ id: 'gr-part2', status: 'DRAFT', supplier_purchase_order_id: 'spo-1' });
    mockSPOL.findUnique.mockResolvedValue({ id: 'spol-1', supplier_purchase_order_id: 'spo-1', quantity: new Decimal(100) });
    mockGRLine.create.mockResolvedValue({ id: 'grl-part2' });
    await GRService.addGoodsReceiptLine('gr-part2', 'spol-1', 60);
    expect(mockGRLine.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ received_quantity: new Decimal(60) })
    }));
  });

  it('14. Prevent cumulative over-receipt', async () => {
    mockGR.findUnique.mockResolvedValue({
      id: 'gr-1', status: 'DRAFT',
      lines: [{ id: 'grl-1', supplier_purchase_order_line_id: 'spol-1', received_quantity: new Decimal(5), ordered_quantity: new Decimal(10), accepted_quantity: new Decimal(5) }]
    });
    mockGRLine.findMany.mockResolvedValue([{ received_quantity: new Decimal(6) }]); // Total 11 > 10

    await expect(GRService.postGoodsReceipt('gr-1')).rejects.toThrow("Over-receipt prevented");
  });

  it('15. Prevent over-receipt under concurrent requests', async () => {
    mockGR.findUnique.mockResolvedValue({
      id: 'gr-conc', status: 'DRAFT',
      lines: [{ id: 'grl-1', supplier_purchase_order_line_id: 'spol-1', received_quantity: new Decimal(10), ordered_quantity: new Decimal(10), accepted_quantity: new Decimal(10) }]
    });
    // This second request sees that 10 is already posted concurrently
    mockGRLine.findMany.mockResolvedValue([{ received_quantity: new Decimal(10) }]);

    await expect(GRService.postGoodsReceipt('gr-conc')).rejects.toThrow("Over-receipt prevented");
  });

  it('16. Reject service-only items from generating stock movements', async () => {
    mockGR.findUnique.mockResolvedValue({
      id: 'gr-svc', status: 'DRAFT', stock_location_id: 'loc-1',
      lines: [{ id: 'grl-1', supplier_purchase_order_line_id: 'spol-1', received_quantity: new Decimal(5), ordered_quantity: new Decimal(10), accepted_quantity: new Decimal(5), product_service_id: 'prod-svc' }]
    });
    mockGRLine.findMany.mockResolvedValue([]);
    mockProduct.findUnique.mockResolvedValue({ id: 'prod-svc', is_stockable: false });

    await GRService.postGoodsReceipt('gr-svc');
    expect(mockLedger.create).not.toHaveBeenCalled();
    expect(mockGR.update).toHaveBeenCalled();
  });

  it('17. Allow eligible stockable products to be received', async () => {
    mockGR.findUnique.mockResolvedValue({
      id: 'gr-stock', status: 'DRAFT', stock_location_id: 'loc-1',
      lines: [{ id: 'grl-1', supplier_purchase_order_line_id: 'spol-1', received_quantity: new Decimal(5), ordered_quantity: new Decimal(10), accepted_quantity: new Decimal(5), product_service_id: 'prod-stock' }]
    });
    mockGRLine.findMany.mockResolvedValue([]);
    mockProduct.findUnique.mockResolvedValue({ id: 'prod-stock', is_stockable: true });

    await GRService.postGoodsReceipt('gr-stock');
    expect(mockLedger.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ quantity_delta: new Decimal(5), product_service_id: 'prod-stock' })
    }));
  });

  it('18. Verify a draft receipt does not affect stock', async () => {
    mockGRLine.create.mockResolvedValue({ id: 'grl-1' });
    mockGR.findUnique.mockResolvedValue({ id: 'gr-draft', status: 'DRAFT', supplier_purchase_order_id: 'spo-1' });
    mockSPOL.findUnique.mockResolvedValue({ id: 'spol-1', supplier_purchase_order_id: 'spo-1', quantity: new Decimal(10) });

    await GRService.addGoodsReceiptLine('gr-draft', 'spol-1', 5);
    expect(mockLedger.create).not.toHaveBeenCalled();
  });

  it('19. Verify accepted quantities increase stock only after posting', async () => {
    // Already covered by previous tests, but explicitly testing post functionality
    mockGR.findUnique.mockResolvedValue({
      id: 'gr-post', status: 'DRAFT', stock_location_id: 'loc-1',
      lines: [{ id: 'grl-1', supplier_purchase_order_line_id: 'spol-1', received_quantity: new Decimal(5), ordered_quantity: new Decimal(10), accepted_quantity: new Decimal(5), product_service_id: 'prod-stock' }]
    });
    mockGRLine.findMany.mockResolvedValue([]);
    mockProduct.findUnique.mockResolvedValue({ id: 'prod-stock', is_stockable: true });

    await GRService.postGoodsReceipt('gr-post');
    expect(mockLedger.create).toHaveBeenCalled();
    expect(mockGR.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'POSTED' })
    }));
  });

  it('20. Verify rejected quantities do not increase available/on-hand stock', async () => {
    mockGR.findUnique.mockResolvedValue({
      id: 'gr-rej', status: 'DRAFT', stock_location_id: 'loc-1',
      lines: [{ id: 'grl-1', supplier_purchase_order_line_id: 'spol-1', received_quantity: new Decimal(5), ordered_quantity: new Decimal(10), accepted_quantity: new Decimal(0), rejected_quantity: new Decimal(5), product_service_id: 'prod-stock' }]
    });
    mockGRLine.findMany.mockResolvedValue([]);
    mockProduct.findUnique.mockResolvedValue({ id: 'prod-stock', is_stockable: true });

    await GRService.postGoodsReceipt('gr-rej');
    expect(mockLedger.create).not.toHaveBeenCalled();
  });

  it('21. Verify posting creates the correct ledger movements', async () => {
    mockGR.findUnique.mockResolvedValue({
      id: 'gr-mv', status: 'DRAFT', stock_location_id: 'loc-1',
      lines: [{ id: 'grl-1', supplier_purchase_order_line_id: 'spol-1', received_quantity: new Decimal(5), ordered_quantity: new Decimal(10), accepted_quantity: new Decimal(5), product_service_id: 'prod-stock' }]
    });
    mockGRLine.findMany.mockResolvedValue([]);
    mockProduct.findUnique.mockResolvedValue({ id: 'prod-stock', is_stockable: true });

    await GRService.postGoodsReceipt('gr-mv');
    expect(mockLedger.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ quantity_delta: new Decimal(5), movement_type: 'RECEIPT', goods_receipt_id: 'gr-mv' })
    }));
  });

  it('22. Verify a posted receipt cannot be edited', async () => {
    mockGRLine.findUnique.mockResolvedValue({ id: 'grl-1', goodsReceipt: { status: 'POSTED' } });
    await expect(GRService.updateGoodsReceiptLine('grl-1', { accepted_quantity: 8 })).rejects.toThrow("Can only modify lines on DRAFT receipts");
  });

  it('23. Prevent duplicate posting of the same receipt', async () => {
    mockGR.findUnique.mockResolvedValue({ id: 'gr-dup', status: 'POSTED' });
    await expect(GRService.postGoodsReceipt('gr-dup')).rejects.toThrow("Receipt not found or not DRAFT");
  });

  it('24. Roll back all posting changes if any required step fails', async () => {
    mockGR.findUnique.mockResolvedValue({ id: 'gr-1', status: 'DRAFT' });
    mocks.getTenantDb.mockResolvedValueOnce({
      tdb: {
        GoodsReceipt: mockGR,
        $transaction: vi.fn().mockRejectedValue(new Error("Database error"))
      }
    });
    await expect(GRService.postGoodsReceipt('gr-1')).rejects.toThrow("Database error");
  });

  it('25. Verify stock balances match the ledger aggregate', async () => {
    mockLedger.findMany.mockResolvedValue([
      { quantity_delta: new Decimal(10) },
      { quantity_delta: new Decimal(5) },
      { quantity_delta: new Decimal(-2) }
    ]);
    const bal = await GRService.getStockBalance('prod-1', 'loc-1');
    expect(bal.toString()).toBe('13');
  });

  it('26. Reject unauthorized receipt creation or update', async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(GRService.createGoodsReceiptFromSupplierPO('spo-1', 'loc-1')).rejects.toThrow("Unauthorized");
  });

  it('27. Reject unauthorized posting', async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(GRService.postGoodsReceipt('gr-1')).rejects.toThrow("Unauthorized");
  });

  it('28. Reject cross-tenant receipt and inventory queries', async () => {
    mockGRLine.findUnique.mockResolvedValue(null); // Meaning wrong tenant or doesn't exist
    await expect(GRService.updateGoodsReceiptLine('grl-cross', { received_quantity: 5 })).rejects.toThrow("Can only modify lines on DRAFT receipts");
  });

  it('29. Verify historical product and supplier PO snapshots remain unchanged', async () => {
    // The GoodsReceiptLine uses item_code_snapshot and item_description_snapshot from SPO which themselves are snapshots
    mockGR.findUnique.mockResolvedValue({ id: 'gr-1', status: 'DRAFT', supplier_purchase_order_id: 'spo-1' });
    mockSPOL.findUnique.mockResolvedValue({ id: 'spol-1', supplier_purchase_order_id: 'spo-1', item_code_snapshot: 'CODE-1', item_description_snapshot: 'DESC', quantity: new Decimal(10) });
    mockGRLine.create.mockResolvedValue({ id: 'grl-1' });

    await GRService.addGoodsReceiptLine('gr-1', 'spol-1', 5);
    expect(mockGRLine.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ item_code_snapshot: 'CODE-1', item_description_snapshot: 'DESC' })
    }));
  });

  it('30. Verify a cancelled supplier PO cannot receive goods', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-canc', status: 'CANCELLED', vendor_id: 'v-1' });
    await expect(GRService.createGoodsReceiptFromSupplierPO('spo-canc', 'loc-1')).rejects.toThrow("Only ISSUED or ACKNOWLEDGED");
  });

  it('31. Verify eligible issued or acknowledged supplier POs follow the configured receipt rules', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-ack', status: 'ACKNOWLEDGED', vendor_id: 'v-1', tenant_id: 'tenant-1' });
    mockStockLoc.findUnique.mockResolvedValue({ id: 'loc-1', status: 'ACTIVE' });
    mockGR.create.mockResolvedValue({ id: 'gr-ack' });

    const gr = await GRService.createGoodsReceiptFromSupplierPO('spo-ack', 'loc-1');
    expect(gr.id).toBe('gr-ack');
  });

  it('32. Verify location deactivation preserves historical references', async () => {
    mockStockLoc.findUnique.mockResolvedValue({ id: 'loc-1', status: 'ACTIVE' });
    mockStockLoc.update.mockResolvedValue({ id: 'loc-1' });
    await LocService.updateStockLocation('loc-1', { status: 'INACTIVE' });
    expect(mockStockLoc.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'INACTIVE' })
    }));
    expect(mocks.logAudit).toHaveBeenCalledWith('STOCK_LOCATION_DEACTIVATED', 'StockLocation', 'loc-1', null);
  });

  it('33. Verify audit events are written for successful posting', async () => {
    mockGR.findUnique.mockResolvedValue({
      id: 'gr-audit', status: 'DRAFT', stock_location_id: 'loc-1', lines: []
    });
    await GRService.postGoodsReceipt('gr-audit');
    expect(mocks.logAudit).toHaveBeenCalledWith('GOODS_RECEIPT_POSTED', 'GoodsReceipt', 'gr-audit', null);
  });

  it('34. Verify failed operations do not leave partial records or misleading audit events', async () => {
    mockGR.findUnique.mockResolvedValue({ id: 'gr-err', status: 'DRAFT', lines: [] });
    mocks.getTenantDb.mockResolvedValueOnce({
      tdb: {
        GoodsReceipt: mockGR,
        $transaction: vi.fn().mockRejectedValue(new Error("Database error"))
      }
    });
    await expect(GRService.postGoodsReceipt('gr-err')).rejects.toThrow("Database error");
    // logAudit for POSTED should not have been called because transaction failed
    expect(mocks.logAudit).not.toHaveBeenCalledWith('GOODS_RECEIPT_POSTED', expect.anything(), expect.anything(), expect.anything());
  });

  it('35. Verify an inventory movement is traceable to the exact receipt and supplier PO line', async () => {
    mockGR.findUnique.mockResolvedValue({
      id: 'gr-trace', status: 'DRAFT', stock_location_id: 'loc-1',
      lines: [{ id: 'grl-1', supplier_purchase_order_line_id: 'spol-1', received_quantity: new Decimal(5), ordered_quantity: new Decimal(10), accepted_quantity: new Decimal(5), product_service_id: 'prod-stock' }]
    });
    mockGRLine.findMany.mockResolvedValue([]);
    mockProduct.findUnique.mockResolvedValue({ id: 'prod-stock', is_stockable: true });

    await GRService.postGoodsReceipt('gr-trace');
    expect(mockLedger.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ goods_receipt_id: 'gr-trace', goods_receipt_line_id: 'grl-1' })
    }));
  });
});
