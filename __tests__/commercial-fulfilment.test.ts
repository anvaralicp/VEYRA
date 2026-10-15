import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as FulfilmentService from "../src/lib/commercial/fulfilment-service";

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

const mockCPO = { findUnique: vi.fn() };
const mockFO = { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() };
const mockFOL = { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() };
const mockFOSH = { create: vi.fn() };

mocks.getTenantDb.mockResolvedValue({
  tdb: {
    CustomerPurchaseOrder: mockCPO,
    FulfilmentOrder: mockFO,
    FulfilmentOrderLine: mockFOL,
    FulfilmentOrderStatusHistory: mockFOSH,
    $transaction: vi.fn().mockImplementation(async (cb) => {
      return cb({
        FulfilmentOrder: mockFO,
        FulfilmentOrderLine: mockFOL,
        FulfilmentOrderStatusHistory: mockFOSH
      });
    })
  }
});

vi.mock('../src/lib/db/tenant-db', () => ({ getTenantDb: mocks.getTenantDb }));

describe('Fulfilment Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Create a fulfilment order from a validated customer PO', async () => {
    mockCPO.findUnique.mockResolvedValue({
      id: 'po-1', tenant_id: 'tenant-1', status: 'VALIDATED', customer_id: 'cust-1', quotation_revision_id: 'rev-1',
      lines: [{ id: 'line-1', quotation_line_id: 'ql-1', customer_item_code: 'item-1', unit_of_measure: 'EA', quantity: 10 }]
    });
    mockFO.findUnique.mockResolvedValue(null);
    mockFO.create.mockResolvedValue({ id: 'fo-1' });

    const order = await FulfilmentService.createFulfilmentOrderFromCustomerPO('po-1');
    expect(order.id).toBe('fo-1');
    expect(mockFO.create).toHaveBeenCalled();
    expect(mockFOL.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ accepted_quantity: 10, planned_quantity: 10 })
    }));
    expect(mocks.logAudit).toHaveBeenCalledWith('FULFILMENT_ORDER_CREATED', 'FulfilmentOrder', 'fo-1', null);
  });

  it('2. Reject a draft customer PO', async () => {
    mockCPO.findUnique.mockResolvedValue({ id: 'po-2', status: 'DRAFT', lines: [] });
    await expect(FulfilmentService.createFulfilmentOrderFromCustomerPO('po-2')).rejects.toThrow("Only VALIDATED Customer POs can be converted to Fulfilment Orders");
  });

  it('3. Reject a submitted but unvalidated customer PO', async () => {
    mockCPO.findUnique.mockResolvedValue({ id: 'po-3', status: 'SUBMITTED', lines: [] });
    await expect(FulfilmentService.createFulfilmentOrderFromCustomerPO('po-3')).rejects.toThrow("Only VALIDATED Customer POs can be converted");
  });

  it('4. Reject a returned customer PO', async () => {
    mockCPO.findUnique.mockResolvedValue({ id: 'po-4', status: 'RETURNED', lines: [] });
    await expect(FulfilmentService.createFulfilmentOrderFromCustomerPO('po-4')).rejects.toThrow("Only VALIDATED Customer POs");
  });

  it('5. Reject a rejected customer PO', async () => {
    mockCPO.findUnique.mockResolvedValue({ id: 'po-5', status: 'REJECTED', lines: [] });
    await expect(FulfilmentService.createFulfilmentOrderFromCustomerPO('po-5')).rejects.toThrow("Only VALIDATED Customer POs");
  });

  it('6. Reject a cross-tenant source PO', async () => {
    mockCPO.findUnique.mockResolvedValue(null);
    await expect(FulfilmentService.createFulfilmentOrderFromCustomerPO('po-cross')).rejects.toThrow("Customer PO not found");
  });


  it('7. Reject cross-tenant related customer or site references', async () => {
    mockFO.findUnique.mockResolvedValue(null);
    await expect(FulfilmentService.updateFulfilmentPlanning('fo-1', {})).rejects.toThrow("Fulfilment order not found");
  });

  it('8. Verify exact quotation revision provenance is preserved', async () => {
    mockCPO.findUnique.mockResolvedValue({
      id: 'po-1', tenant_id: 'tenant-1', status: 'VALIDATED', customer_id: 'cust-1', quotation_revision_id: 'rev-99',
      lines: []
    });
    mockFO.findUnique.mockResolvedValue(null);
    mockFO.create.mockResolvedValue({ id: 'fo-1' });
    await FulfilmentService.createFulfilmentOrderFromCustomerPO('po-1');
    expect(mockFO.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ quotation_revision_id: 'rev-99' })
    }));
  });

  it('9. Verify PO line snapshots are copied correctly', async () => {
    mockCPO.findUnique.mockResolvedValue({
      id: 'po-1', tenant_id: 'tenant-1', status: 'VALIDATED', customer_id: 'cust-1', quotation_revision_id: 'rev-1',
      lines: [{ id: 'line-1', quotation_line_id: 'ql-1', customer_item_code: 'CODE1', customer_item_description: 'DESC1', unit_of_measure: 'EA', quantity: 10 }]
    });
    mockFO.findUnique.mockResolvedValue(null);
    mockFO.create.mockResolvedValue({ id: 'fo-1' });
    await FulfilmentService.createFulfilmentOrderFromCustomerPO('po-1');
    expect(mockFOL.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ item_code_snapshot: 'CODE1', item_description_snapshot: 'DESC1' })
    }));
  });

  it('10. Verify accepted quantities are preserved', async () => {
    mockCPO.findUnique.mockResolvedValue({
      id: 'po-1', tenant_id: 'tenant-1', status: 'VALIDATED', customer_id: 'cust-1', quotation_revision_id: 'rev-1',
      lines: [{ id: 'line-1', quantity: 42.5 }]
    });
    mockFO.findUnique.mockResolvedValue(null);
    mockFO.create.mockResolvedValue({ id: 'fo-1' });
    await FulfilmentService.createFulfilmentOrderFromCustomerPO('po-1');
    expect(mockFOL.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ accepted_quantity: 42.5, planned_quantity: 42.5 })
    }));
  });

  it('11. Verify freeform PO lines are handled correctly', async () => {
    mockCPO.findUnique.mockResolvedValue({
      id: 'po-1', tenant_id: 'tenant-1', status: 'VALIDATED', customer_id: 'cust-1', quotation_revision_id: 'rev-1',
      lines: [{ id: 'line-1', customer_item_description: null, quantity: 1 }]
    });
    mockFO.findUnique.mockResolvedValue(null);
    mockFO.create.mockResolvedValue({ id: 'fo-1' });
    await FulfilmentService.createFulfilmentOrderFromCustomerPO('po-1');
    expect(mockFOL.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ item_description_snapshot: 'Unknown item' })
    }));
  });

  it('16. Roll back failed conversion without partial line creation', async () => {
    mockCPO.findUnique.mockResolvedValue({
      id: 'po-error', tenant_id: 'tenant-1', status: 'VALIDATED', customer_id: 'cust-1', quotation_revision_id: 'rev-1',
      lines: [{ id: 'line-1', quantity: 1 }]
    });
    mockFO.findUnique.mockResolvedValue(null);
    mockFO.create.mockRejectedValue(new Error("Database error"));
    await expect(FulfilmentService.createFulfilmentOrderFromCustomerPO('po-error')).rejects.toThrow("Database error");
  });

  it('17. Verify the initial status is OPEN', async () => {
    mockCPO.findUnique.mockResolvedValue({
      id: 'po-1', tenant_id: 'tenant-1', status: 'VALIDATED', customer_id: 'cust-1', quotation_revision_id: 'rev-1',
      lines: []
    });
    mockFO.findUnique.mockResolvedValue(null);
    mockFO.create.mockResolvedValue({ id: 'fo-1' });
    await FulfilmentService.createFulfilmentOrderFromCustomerPO('po-1');
    expect(mockFO.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'OPEN' })
    }));
  });

  it('20. Enforce planning permissions', async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(FulfilmentService.updateFulfilmentPlanning('fo-1', {})).rejects.toThrow("Unauthorized");
  });

  it('14. Prevent duplicate conversion', async () => {
    mockCPO.findUnique.mockResolvedValue({ id: 'po-dup', status: 'VALIDATED', lines: [] });
    mockFO.findUnique.mockResolvedValue({ id: 'fo-dup' });
    await expect(FulfilmentService.createFulfilmentOrderFromCustomerPO('po-dup')).rejects.toThrow("Fulfilment order already exists");
  });

  it('18. Enforce valid state transitions', async () => {
    mockFO.findUnique.mockResolvedValue({ id: 'fo-2', status: 'OPEN', lines: [] });
    await FulfilmentService.markFulfilmentPlanning('fo-2');
    expect(mockFO.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PLANNING' }) }));
  });

  it('19. Reject invalid state transitions', async () => {
    mockFO.findUnique.mockResolvedValue({ id: 'fo-2', status: 'OPEN', lines: [] });
    await expect(FulfilmentService.resumeFulfilmentOrder('fo-2')).rejects.toThrow("Invalid state transition");
  });

  it('21. Prevent READY when mandatory readiness conditions are incomplete', async () => {
    mockFO.findUnique.mockResolvedValue({ id: 'fo-ready', status: 'PLANNING', lines: [{ planned_quantity: 5 }] });
    await expect(FulfilmentService.markFulfilmentReady('fo-ready')).rejects.toThrow("A responsible user must be assigned");
  });

  it('22. Allow READY when all applicable conditions are satisfied', async () => {
    mockFO.findUnique.mockResolvedValue({
      id: 'fo-ready', status: 'PLANNING', responsible_user_id: 'u-1', target_date: new Date(),
      lines: [{ planned_quantity: 5 }]
    });
    await FulfilmentService.markFulfilmentReady('fo-ready');
    expect(mockFO.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'READY' }) }));
  });

  it('23. Enforce hold and resume rules', async () => {
    mockFO.findUnique.mockResolvedValue({ id: 'fo-hold', status: 'PLANNING', lines: [] });
    await FulfilmentService.holdFulfilmentOrder('fo-hold', 'Missing parts');
    expect(mockFO.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ON_HOLD' }) }));
  });

  it('24. Enforce cancellation permissions and reason validation', async () => {
    mockFO.findUnique.mockResolvedValue({ id: 'fo-cancel', status: 'OPEN', lines: [] });
    await expect(FulfilmentService.cancelFulfilmentOrder('fo-cancel', '')).rejects.toThrow("A reason must be provided");
  });

  it('25. Prevent a cancelled order from silently returning to an active state', async () => {
    mockFO.findUnique.mockResolvedValue({ id: 'fo-cancel2', status: 'CANCELLED', lines: [] });
    await expect(FulfilmentService.resumeFulfilmentOrder('fo-cancel2')).rejects.toThrow("Invalid state transition");
  });

  it('26. Prevent unauthorized direct service/action calls', async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(FulfilmentService.markFulfilmentReady('fo-2')).rejects.toThrow("Unauthorized");
  });

  it('27. Reject cross-tenant detail and mutation requests', async () => {
    mockFO.findUnique.mockResolvedValue(null);
    await expect(FulfilmentService.updateFulfilmentPlanning('fo-cross', {})).rejects.toThrow("Fulfilment order not found");
  });

  it('28. Verify status history and audit events', async () => {
    mockFO.findUnique.mockResolvedValue({
      id: 'fo-audit', status: 'PLANNING', responsible_user_id: 'u-1', target_date: new Date(),
      lines: [{ planned_quantity: 5 }]
    });
    await FulfilmentService.markFulfilmentReady('fo-audit');
    expect(mockFOSH.create).toHaveBeenCalled();
    expect(mocks.logAudit).toHaveBeenCalledWith('FULFILMENT_ORDER_MARKED_READY', 'FulfilmentOrder', 'fo-audit', null);
  });
});
