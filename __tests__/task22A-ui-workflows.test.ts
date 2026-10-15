import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitGoodsReceiptDraft } from '../src/app/(authenticated)/inventory/receipts/new/actions';
import { submitStockCountDraft } from '../src/app/(authenticated)/inventory/counts/new/actions';
import { updatePlanningActionApi, markReadyActionApi } from '../src/app/(authenticated)/commercial/fulfilment/[id]/planning/actions';

// Mock services
vi.mock('../src/lib/inventory/goods-receipt-service', () => ({
  createGoodsReceiptFromSupplierPO: vi.fn().mockResolvedValue({ id: 'gr-1' }),
  addGoodsReceiptLine: vi.fn().mockResolvedValue({ id: 'grl-1' }),
  updateGoodsReceiptLine: vi.fn().mockResolvedValue({}),
}));

vi.mock('../src/lib/inventory/stock-count-service', () => ({
  createStockCount: vi.fn().mockResolvedValue({ id: 'cnt-1' }),
  addStockCountLine: vi.fn().mockResolvedValue({}),
}));

vi.mock('../src/lib/commercial/fulfilment-service', () => ({
  updateFulfilmentPlanning: vi.fn().mockResolvedValue({}),
  updateFulfilmentOrderLinePlanning: vi.fn().mockResolvedValue({}),
  markFulfilmentReady: vi.fn().mockResolvedValue({}),
}));

import { createGoodsReceiptFromSupplierPO, addGoodsReceiptLine, updateGoodsReceiptLine } from '../src/lib/inventory/goods-receipt-service';
import { createStockCount, addStockCountLine } from '../src/lib/inventory/stock-count-service';
import { updateFulfilmentPlanning, updateFulfilmentOrderLinePlanning, markFulfilmentReady } from '../src/lib/commercial/fulfilment-service';

describe('Task 22A UI Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Receipt creation service invocation', async () => {
    const formData = new FormData();
    formData.append('spo_id', 'spo-1');
    formData.append('location_id', 'loc-1');
    formData.append('delivery_note', 'Delivery Note 123');
    formData.append('line_id', 'line-1');
    formData.append('recv_line-1', '10');
    formData.append('acc_line-1', '8');
    formData.append('rej_line-1', '2');
    formData.append('reason_line-1', 'Damaged');

    const result = await submitGoodsReceiptDraft(formData);

    expect(result).toBe('gr-1');
    expect(createGoodsReceiptFromSupplierPO).toHaveBeenCalledWith('spo-1', 'loc-1', 'Delivery Note 123');
    expect(addGoodsReceiptLine).toHaveBeenCalledWith('gr-1', 'line-1', 10);
    expect(updateGoodsReceiptLine).toHaveBeenCalledWith('grl-1', {
      accepted_quantity: 8,
      rejected_quantity: 2,
      rejection_reason: 'Damaged'
    });
  });

  it('2. Stock count creation service invocation', async () => {
    const formData = new FormData();
    formData.append('location_id', 'loc-1');
    formData.append('notes', 'Annual Count');
    formData.append('product_id', 'prod-1');
    formData.append('phys_prod-1', '100');
    formData.append('reason_prod-1', 'Found extra');

    const result = await submitStockCountDraft(formData);

    expect(result).toBe('cnt-1');
    expect(createStockCount).toHaveBeenCalledWith('loc-1', 'Annual Count');
    expect(addStockCountLine).toHaveBeenCalledWith('cnt-1', 'prod-1', 100, 'Found extra');
  });

  it('3. Fulfilment planning service invocation', async () => {
    const formData = new FormData();
    formData.append('customer_site_id', 'site-1');
    formData.append('target_date', '2026-10-15');
    formData.append('responsible_user_id', 'user-1');
    formData.append('notes', 'Urgent delivery');
    formData.append('line_id', 'line-1');
    formData.append('planned_line-1', '50');
    formData.append('notes_line-1', 'Pack well');

    await updatePlanningActionApi('order-1', formData);

    expect(updateFulfilmentPlanning).toHaveBeenCalledWith('order-1', {
      customer_site_id: 'site-1',
      target_date: '2026-10-15',
      responsible_user_id: 'user-1',
      notes: 'Urgent delivery'
    });
    expect(updateFulfilmentOrderLinePlanning).toHaveBeenCalledWith('line-1', {
      planned_quantity: 50,
      notes: 'Pack well'
    });
  });

  it('4. Fulfilment readiness transitions', async () => {
    await markReadyActionApi('order-1');
    expect(markFulfilmentReady).toHaveBeenCalledWith('order-1');
  });
});
