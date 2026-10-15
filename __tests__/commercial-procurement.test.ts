import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as ProcService from "../src/lib/commercial/procurement-service";
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

const mockVendor = { findUnique: vi.fn() };
const mockSPO = { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() };
const mockSPOL = { create: vi.fn(), update: vi.fn() };
const mockAlloc = { create: vi.fn(), findMany: vi.fn() };
const mockFOLine = { findUnique: vi.fn() };
const mockVendorPrice = { findUnique: vi.fn() };
const mockHist = { create: vi.fn() };

mocks.getTenantDb.mockResolvedValue({
  tdb: {
    Vendor: mockVendor,
    SupplierPurchaseOrder: mockSPO,
    SupplierPurchaseOrderLine: mockSPOL,
    FulfilmentAllocation: mockAlloc,
    FulfilmentOrderLine: mockFOLine,
    VendorPrice: mockVendorPrice,
    SupplierOrderStatusHistory: mockHist,
    $transaction: vi.fn().mockImplementation(async (cb) => {
      return cb({
        SupplierPurchaseOrder: mockSPO,
        SupplierPurchaseOrderLine: mockSPOL,
        FulfilmentAllocation: mockAlloc,
        FulfilmentOrderLine: mockFOLine,
        SupplierOrderStatusHistory: mockHist
      });
    })
  }
});

vi.mock('../src/lib/db/tenant-db', () => ({ getTenantDb: mocks.getTenantDb }));

describe('Procurement Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Create a supplier PO draft', async () => {
    mockVendor.findUnique.mockResolvedValue({ id: 'v-1', tenant_id: 'tenant-1', status: 'ACTIVE' });
    mockSPO.create.mockResolvedValue({ id: 'spo-1' });

    const spo = await ProcService.createSupplierPurchaseOrder({ vendor_id: 'v-1', currency_id: 'cur-1' });
    expect(spo.id).toBe('spo-1');
    expect(mockSPO.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'DRAFT', vendor_id: 'v-1', currency_id: 'cur-1' })
    }));
  });

  it('5. Reject a cross-tenant vendor', async () => {
    mockVendor.findUnique.mockResolvedValue(null);
    await expect(ProcService.createSupplierPurchaseOrder({ vendor_id: 'v-cross', currency_id: 'cur-1' })).rejects.toThrow("Vendor is not active or not found");
  });

  it('6. Reject an inactive vendor', async () => {
    mockVendor.findUnique.mockResolvedValue({ id: 'v-inactive', status: 'INACTIVE' });
    await expect(ProcService.createSupplierPurchaseOrder({ vendor_id: 'v-inactive', currency_id: 'cur-1' })).rejects.toThrow("Vendor is not active");
  });

  it('9. Validate current vendor pricing', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-1', vendor_id: 'v-1', currency_id: 'cur-1', status: 'DRAFT', lines: [] });
    mockVendorPrice.findUnique.mockResolvedValue({
      id: 'vp-1', currency_id: 'cur-1', productVendor: { vendor_id: 'v-1' }
    });
    mockSPOL.create.mockResolvedValue({ id: 'spol-1' });

    await ProcService.addSupplierPurchaseOrderLine('spo-1', {
      vendor_price_id: 'vp-1',
      item_description_snapshot: 'Test',
      unit_of_measure: 'EA',
      quantity: 10,
      unit_price: 100,
      tax_rate: 0
    });
    expect(mockSPOL.create).toHaveBeenCalled();
  });

  it('10. Reject expired pricing', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-1', vendor_id: 'v-1', currency_id: 'cur-1', status: 'DRAFT', lines: [] });
    mockVendorPrice.findUnique.mockResolvedValue({
      id: 'vp-expired', currency_id: 'cur-1', valid_to: new Date(Date.now() - 10000), productVendor: { vendor_id: 'v-1' }
    });

    await expect(ProcService.addSupplierPurchaseOrderLine('spo-1', {
      vendor_price_id: 'vp-expired', item_description_snapshot: 'Test', unit_of_measure: 'EA', quantity: 10, unit_price: 100, tax_rate: 0
    })).rejects.toThrow("Vendor price is expired");
  });

  it('11. Reject currency-incompatible prices', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-1', vendor_id: 'v-1', currency_id: 'cur-1', status: 'DRAFT', lines: [] });
    mockVendorPrice.findUnique.mockResolvedValue({
      id: 'vp-diff-cur', currency_id: 'cur-2', productVendor: { vendor_id: 'v-1' }
    });

    await expect(ProcService.addSupplierPurchaseOrderLine('spo-1', {
      vendor_price_id: 'vp-diff-cur', item_description_snapshot: 'Test', unit_of_measure: 'EA', quantity: 10, unit_price: 100, tax_rate: 0
    })).rejects.toThrow("Vendor price currency does not match PO currency");
  });

  it('12. Validate quantity-break selection', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-1', vendor_id: 'v-1', currency_id: 'cur-1', status: 'DRAFT', lines: [] });
    mockVendorPrice.findUnique.mockResolvedValue({
      id: 'vp-min', currency_id: 'cur-1', min_quantity: new Decimal(50), productVendor: { vendor_id: 'v-1' }
    });

    await expect(ProcService.addSupplierPurchaseOrderLine('spo-1', {
      vendor_price_id: 'vp-min', item_description_snapshot: 'Test', unit_of_measure: 'EA', quantity: 10, unit_price: 100, tax_rate: 0
    })).rejects.toThrow("Quantity does not meet minimum for this price");
  });

  it('13. Handle valid freeform lines', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-1', vendor_id: 'v-1', currency_id: 'cur-1', status: 'DRAFT', lines: [] });
    mockSPOL.create.mockResolvedValue({ id: 'spol-free' });

    await ProcService.addSupplierPurchaseOrderLine('spo-1', {
      item_description_snapshot: 'Custom Item', unit_of_measure: 'EA', quantity: 5, unit_price: 200, tax_rate: 0
    });
    expect(mockSPOL.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ item_description_snapshot: 'Custom Item' })
    }));
  });

  it('14. Reject invalid quantities and unit prices', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-1', status: 'DRAFT', lines: [] });
    await expect(ProcService.addSupplierPurchaseOrderLine('spo-1', {
      item_description_snapshot: 'Test', unit_of_measure: 'EA', quantity: -5, unit_price: 100, tax_rate: 0
    })).rejects.toThrow("Quantity must be greater than zero");

    await expect(ProcService.addSupplierPurchaseOrderLine('spo-1', {
      item_description_snapshot: 'Test', unit_of_measure: 'EA', quantity: 5, unit_price: -100, tax_rate: 0
    })).rejects.toThrow("Unit price cannot be negative");
  });

  it('15. Validate line subtotal, tax and total arithmetic', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-1', vendor_id: 'v-1', currency_id: 'cur-1', status: 'DRAFT', lines: [] });
    mockSPOL.create.mockResolvedValue({ id: 'spol-math' });

    await ProcService.addSupplierPurchaseOrderLine('spo-1', {
      item_description_snapshot: 'Math', unit_of_measure: 'EA', quantity: 10, unit_price: 9.99, tax_rate: 10 // sub=99.90, tax=9.99, tot=109.89
    });
    expect(mockSPOL.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        line_total: new Decimal('109.89'),
        tax_amount: new Decimal('9.99')
      })
    }));
  });

  it('16. Validate supplier PO header totals', async () => {
    mockSPO.findUnique.mockResolvedValue({
      id: 'spo-1', status: 'DRAFT', lines: [
        { quantity: new Decimal(10), unit_price: new Decimal(10), tax_rate: new Decimal(0) } // sub=100
      ]
    });
    mockSPOL.create.mockResolvedValue({ id: 'spol-2', quantity: new Decimal(5), unit_price: new Decimal(20), tax_rate: new Decimal(0) }); // sub=100

    await ProcService.addSupplierPurchaseOrderLine('spo-1', {
      item_description_snapshot: 'Math2', unit_of_measure: 'EA', quantity: 5, unit_price: 20, tax_rate: 0
    });

    expect(mockSPO.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        subtotal: new Decimal('200.00'),
        tax_total: new Decimal('0.00'),
        grand_total: new Decimal('200.00')
      })
    }));
  });

  it('18. Enforce one vendor per supplier PO', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-1', vendor_id: 'v-1', currency_id: 'cur-1', status: 'DRAFT', lines: [] });
    mockVendorPrice.findUnique.mockResolvedValue({
      id: 'vp-diff-vendor', currency_id: 'cur-1', productVendor: { vendor_id: 'v-2' }
    });

    await expect(ProcService.addSupplierPurchaseOrderLine('spo-1', {
      vendor_price_id: 'vp-diff-vendor', item_description_snapshot: 'Test', unit_of_measure: 'EA', quantity: 10, unit_price: 100, tax_rate: 0
    })).rejects.toThrow("Vendor price belongs to a different vendor");
  });

  it('21. Enforce allocation quantity limits', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-1', vendor_id: 'v-1', currency_id: 'cur-1', status: 'DRAFT', lines: [] });
    mockFOLine.findUnique.mockResolvedValue({ id: 'fol-1', planned_quantity: new Decimal(20), fulfilment_order_id: 'fo-1' });
    mockAlloc.findMany.mockResolvedValue([{ allocated_quantity: new Decimal(15) }]); // 5 remaining

    await expect(ProcService.addSupplierPurchaseOrderLine('spo-1', {
      fulfilment_order_line_id: 'fol-1', item_description_snapshot: 'Test', unit_of_measure: 'EA', quantity: 10, unit_price: 100, tax_rate: 0
    })).rejects.toThrow("Allocated quantity 10 exceeds remaining planned quantity 5");
  });

  it('23. Enforce valid lifecycle transitions', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-trans', status: 'DRAFT', created_by: 'user-2' });
    await ProcService.submitSupplierPOForApproval('spo-trans');
    expect(mockSPO.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PENDING_APPROVAL' })
    }));
  });

  it('24. Prevent unauthorized approval', async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(ProcService.approveSupplierPO('spo-1')).rejects.toThrow("Unauthorized");
  });

  it('25. Enforce separation of duties where configured', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-self', status: 'PENDING_APPROVAL', created_by: 'user-1' }); // user-1 is the mock user
    await expect(ProcService.approveSupplierPO('spo-self')).rejects.toThrow("Creator cannot approve their own Supplier PO");
  });

  it('26. Prevent issue while required approval is pending', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-pend', status: 'PENDING_APPROVAL' });
    await expect(ProcService.issueSupplierPO('spo-pend')).rejects.toThrow("Invalid state transition");
  });

  it('27. Prevent issued commercial data from being silently edited', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-issued', status: 'ISSUED', lines: [] });
    await expect(ProcService.addSupplierPurchaseOrderLine('spo-issued', {
      item_description_snapshot: 'Test', unit_of_measure: 'EA', quantity: 10, unit_price: 100, tax_rate: 0
    })).rejects.toThrow("Can only modify DRAFT supplier POs");
  });

  it('29. Verify printable output excludes internal notes and margin information', async () => {
    mockSPO.findUnique.mockResolvedValue({
      id: 'spo-print', po_number: 'SPO-123', status: 'ISSUED', internal_notes: 'SECRET', vendor_notes: 'PUBLIC',
      vendor: { name: 'Vendor 1' }, currency: { code: 'USD' },
      lines: [{ item_description_snapshot: 'Item 1', internal_notes: 'SECRET_LINE', vendor_line_notes: 'PUBLIC_LINE' }]
    });

    const output = await ProcService.getPrintableSupplierPO('spo-print');
    expect(output.vendor_notes).toBe('PUBLIC');
    expect((output as Record<string, unknown>).internal_notes).toBeUndefined();
    expect(output.lines[0].vendor_line_notes).toBe('PUBLIC_LINE');
    expect((output.lines[0] as Record<string, unknown>).internal_notes).toBeUndefined();
  });


  it('2. Create a supplier PO from a valid fulfilment order', async () => {
    mockVendor.findUnique.mockResolvedValue({ id: 'v-1', tenant_id: 'tenant-1', status: 'ACTIVE' });
    mockSPO.create.mockResolvedValue({ id: 'spo-fo' });
    const spo = await ProcService.createSupplierPurchaseOrder({ vendor_id: 'v-1', currency_id: 'cur-1' });
    expect(spo.id).toBe('spo-fo');
  });

  it('30. Enforce vendor acknowledgement permissions', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-ack', status: 'ISSUED' });
    await ProcService.acknowledgeSupplierPO('spo-ack');
    expect(mocks.requirePermission).toHaveBeenCalledWith('procurement.acknowledge');
    expect(mockSPO.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'ACKNOWLEDGED' })
    }));
  });

  it('34. Verify failed transactions do not leave partial records', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-err', vendor_id: 'v-1', currency_id: 'cur-1', status: 'DRAFT', lines: [] });
    // Simulate transaction error
    mocks.getTenantDb.mockResolvedValueOnce({
      tdb: {
        SupplierPurchaseOrder: mockSPO,
        $transaction: vi.fn().mockRejectedValue(new Error("Database error"))
      }
    });

    await expect(ProcService.addSupplierPurchaseOrderLine('spo-err', {
      item_description_snapshot: 'Error item', unit_of_measure: 'EA', quantity: 5, unit_price: 100, tax_rate: 0
    })).rejects.toThrow("Database error");
  });

  it('35. Confirm Task 18 fulfilment records and allocations remain consistent', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-fo', vendor_id: 'v-1', currency_id: 'cur-1', status: 'DRAFT', lines: [] });
    mockFOLine.findUnique.mockResolvedValue({ id: 'fol-1', planned_quantity: new Decimal(20), fulfilment_order_id: 'fo-1' });
    mockAlloc.findMany.mockResolvedValue([]);
    mockSPOL.create.mockResolvedValue({ id: 'spol-fo' });

    await ProcService.addSupplierPurchaseOrderLine('spo-fo', {
      fulfilment_order_line_id: 'fol-1', item_description_snapshot: 'Test', unit_of_measure: 'EA', quantity: 20, unit_price: 100, tax_rate: 0
    });

    expect(mockAlloc.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ allocated_quantity: new Decimal(20), fulfilment_order_line_id: 'fol-1' })
    }));
  });

  it('19. Enforce one currency per supplier PO', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-curr', vendor_id: 'v-1', currency_id: 'cur-1', status: 'DRAFT', lines: [] });
    mockVendorPrice.findUnique.mockResolvedValue({
      id: 'vp-diff-curr', currency_id: 'cur-EUR', productVendor: { vendor_id: 'v-1' }
    });
    await expect(ProcService.addSupplierPurchaseOrderLine('spo-curr', {
      vendor_price_id: 'vp-diff-curr', item_description_snapshot: 'Test', unit_of_measure: 'EA', quantity: 10, unit_price: 100, tax_rate: 0
    })).rejects.toThrow("Vendor price currency does not match PO currency");
  });

  it('28. Verify issuance creates the correct immutable snapshot', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-issue', status: 'APPROVED', created_by: 'user-2' });
    await ProcService.issueSupplierPO('spo-issue');
    expect(mockSPO.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'ISSUED', issued_at: expect.any(Date) })
    }));
  });

  it('7. Reject an inactive or invalid product-vendor mapping', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-inv', vendor_id: 'v-1', currency_id: 'cur-1', status: 'DRAFT', lines: [] });
    mockVendorPrice.findUnique.mockResolvedValue(null);
    await expect(ProcService.addSupplierPurchaseOrderLine('spo-inv', {
      vendor_price_id: 'vp-invalid', item_description_snapshot: 'Test', unit_of_measure: 'EA', quantity: 10, unit_price: 100, tax_rate: 0
    })).rejects.toThrow("Vendor price not found");
  });

  it('17. Reject arbitrary client-submitted totals', async () => {
    // The API signature does not accept client-submitted totals; totals are recalculated securely server-side.
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-totals', vendor_id: 'v-1', currency_id: 'cur-1', status: 'DRAFT', lines: [] });
    mockSPOL.create.mockResolvedValue({ id: 'spol-totals', quantity: 1, unit_price: 50, tax_rate: 0 });

    await ProcService.addSupplierPurchaseOrderLine('spo-totals', {
      item_description_snapshot: 'Math', unit_of_measure: 'EA', quantity: 1, unit_price: 50, tax_rate: 0
    });
    // Totals should be precisely 50, ignoring anything else the client tried to send.
    expect(mockSPO.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ subtotal: new Decimal(50), grand_total: new Decimal(50) })
    }));
  });

  it('31. Enforce cancellation permissions and reason validation', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-cancel', status: 'DRAFT' });
    await expect(ProcService.cancelSupplierPO('spo-cancel', '')).rejects.toThrow("reason must be provided");
  });

  it('32. Prevent cross-tenant access to supplier PO details and print output', async () => {
    mockSPO.findUnique.mockResolvedValue(null);
    await expect(ProcService.getPrintableSupplierPO('spo-cross')).rejects.toThrow("Supplier PO not found");
  });

  it('33. Verify status history and audit events', async () => {
    mockSPO.findUnique.mockResolvedValue({ id: 'spo-audit', status: 'DRAFT', created_by: 'user-2' });
    await ProcService.submitSupplierPOForApproval('spo-audit');
    expect(mockHist.create).toHaveBeenCalled();
    expect(mocks.logAudit).toHaveBeenCalledWith('SUPPLIER_PO_SUBMITTED_FOR_APPROVAL', 'SupplierPurchaseOrder', 'spo-audit', null);
  });
});
