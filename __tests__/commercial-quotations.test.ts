
/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as QuotationService from '../src/lib/commercial/quotation-service';
import Decimal from 'decimal.js';


// Context Mock
vi.mock('../src/lib/tenant/context', () => ({
  getTenantContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-1', userId: 'user-1' }),
}));

// Boundary Mock
vi.mock('../src/lib/auth/boundary', () => ({
  requirePermission: vi.fn(),
  checkPermissionForUI: vi.fn(),
  getAuthContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-1', userId: 'u1' }),
  requireTenantContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-1', userId: 'u1' }),
}));

// Audit Mock
vi.mock('../src/lib/audit/logger', () => ({
  logAudit: vi.fn(),
}));

// Costing Mock
const { mockCalculateCommercialCost } = vi.hoisted(() => {
  return { mockCalculateCommercialCost: vi.fn() };
});
vi.mock('../src/lib/commercial/costing-service', () => ({
  calculateCommercialCost: mockCalculateCommercialCost
}));

// DB Mocks
const {
  mockQuotation, mockQuotationRevision, mockQuotationLine,
  mockOpportunity, mockBOQ, mockBOQRevision, mockCurrency, mockProductVendor,
  mockTx
} = vi.hoisted(() => ({
  mockQuotation: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  mockQuotationRevision: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    mockCurrency: { findUnique: vi.fn() },
    mockProductVendor: { findUnique: vi.fn() },
    mockOpportunity: { findUnique: vi.fn() },
    mockBOQ: { findUnique: vi.fn() },
    mockBOQRevision: { findUnique: vi.fn() },
    mockTx: vi.fn(),
  mockQuotationLine: {
    create: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn()
  }
}));

vi.mock('../src/lib/db/tenant-db', () => ({
  getTenantDb: vi.fn().mockResolvedValue({
    QuotationApprovalSettings: { findUnique: vi.fn().mockResolvedValue(null) },
    tdb: {
      Quotation: mockQuotation,
      QuotationRevision: mockQuotationRevision,
      QuotationLine: mockQuotationLine,
      Opportunity: mockOpportunity,
      BOQ: mockBOQ,
      BOQRevision: mockBOQRevision,
      Currency: mockCurrency,
      ProductVendor: mockProductVendor,
      QuotationApprovalSettings: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn().mockImplementation(async (cb) => {
        return cb({
          Quotation: mockQuotation,
          QuotationRevision: mockQuotationRevision,
          QuotationLine: mockQuotationLine
        });
      })
    },
    Quotation: mockQuotation,
    QuotationRevision: mockQuotationRevision,
    QuotationLine: mockQuotationLine,
    Opportunity: mockOpportunity,
    BOQ: mockBOQ,
    BOQRevision: mockBOQRevision,
    Currency: mockCurrency,
    ProductVendor: mockProductVendor,
    $transaction: vi.fn().mockImplementation(async (cb) => {
      return cb({
        Quotation: mockQuotation,
        QuotationRevision: mockQuotationRevision,
        QuotationLine: mockQuotationLine,
      });
    })
  })
}));

describe('Quotation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCurrency.findUnique.mockResolvedValue({
      id: 'curr-usd', code: 'USD', name: 'US Dollar', symbol: '$', decimal_places: 2
    });

    mockOpportunity.findUnique.mockResolvedValue({
      id: 'opp-1', tenant_id: 'tenant-1', name: 'Big Deal',
      customer_id: 'cust-1', customer: { name: 'Acme', billing_address: '123 St', tax_id: 'TAX-123' }
    });

    mockQuotation.count.mockResolvedValue(0);

    mockQuotation.create.mockResolvedValue({
      id: 'q-1', tenant_id: 'tenant-1', quotation_number: 'QT-2026-0001',
      revisions: [
        { id: 'qr-1', revision_number: 1, status: 'DRAFT', currency_code_snapshot: 'USD', currency_decimal_places_snapshot: 2 }
      ]
    });

    mockQuotation.findUnique.mockResolvedValue({
      id: 'q-1', tenant_id: 'tenant-1', current_revision_id: 'qr-1',
      revisions: [
        { id: 'qr-1', revision_number: 1, status: 'DRAFT', currency_code_snapshot: 'USD', currency_decimal_places_snapshot: 2 }
      ]
    });
  });

  describe('Creation', () => {
    it('1. Creates quotation from opportunity', async () => {
      const res = await QuotationService.createQuotationFromOpportunity('opp-1', 'curr-usd');
      expect(mockOpportunity.findUnique).toHaveBeenCalled();
      expect(mockQuotation.create).toHaveBeenCalled();
      expect(mockQuotation.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ current_revision_id: 'qr-1' })
      }));
    });

    it('2. Creates quotation from valid approved BOQ', async () => {
      mockBOQ.findUnique.mockResolvedValue({ id: 'boq-1', opportunity_id: 'opp-1' });
      mockBOQRevision.findUnique.mockResolvedValue({
        id: 'boqr-1', status: 'APPROVED',
        lines: [
          { id: 'bl-1', product_name: 'Server', quantity: 2, unit: 'EA' }
        ]
      });

      await QuotationService.createQuotationFromBOQ('boq-1', 'boqr-1', 'curr-usd');
      expect(mockQuotationLine.createMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ source_boq_line_id: 'bl-1', item_type: 'FREEFORM' })
        ])
      }));
    });

    it('3. Rejects unapproved BOQ', async () => {
      mockBOQ.findUnique.mockResolvedValue({ id: 'boq-1', opportunity_id: 'opp-1' });
      mockBOQRevision.findUnique.mockResolvedValue({ id: 'boqr-1', status: 'DRAFT' });
      await expect(QuotationService.createQuotationFromBOQ('boq-1', 'boqr-1', 'curr-usd')).rejects.toThrow('APPROVED');
    });

    it('4. Rejects cross-tenant BOQ', async () => {
      mockBOQ.findUnique.mockResolvedValue(null);
      await expect(QuotationService.createQuotationFromBOQ('boq-invalid', 'boqr-1', 'curr-usd')).rejects.toThrow('not found');
    });
  });

  describe('Line Operations', () => {
    it('5. Adds a freeform line', async () => {
      mockQuotationRevision.findUnique.mockResolvedValue({
        id: 'qr-1', status: 'DRAFT', currency_id: 'curr-usd', currency_decimal_places_snapshot: 2, lines: []
      });
      await QuotationService.addQuotationLine('qr-1', {
        item_type: 'FREEFORM', product_name_snapshot: 'Custom Service',
        quantity: 10, manual_unit_price: 150.5
      });

      expect(mockQuotationLine.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          unit_selling_price: 150.5,
          subtotal: 1505
        })
      }));
    });

    it('6. Resolves ProductVendor and computes via costing service', async () => {
      mockQuotationRevision.findUnique.mockResolvedValue({
        id: 'qr-1', status: 'DRAFT', currency_id: 'curr-usd', currency_decimal_places_snapshot: 2, lines: []
      });
      mockProductVendor.findUnique.mockResolvedValue({
        id: 'pv-1', tenant_id: 'tenant-1', product_id: 'prod-1', vendor_id: 'vend-1',
        product: { name: 'DB Server' }, vendor: { name: 'Dell' }
      });
      mockCalculateCommercialCost.mockResolvedValue({
        base_unit_cost: 1000, landed_unit_cost: 1100, landed_cost_line_total: 2200,
        selling_price_unit: 1500, selling_price_line_total: 3000,
        base_price_record_id: 'vp-1', evaluated_components: []
      });

      await QuotationService.addQuotationLine('qr-1', {
        product_vendor_id: 'pv-1', quantity: 2, pricing_method: 'MARGIN', target_percentage: 20
      });

      expect(mockCalculateCommercialCost).toHaveBeenCalled();
      expect(mockQuotationLine.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          product_service_id: 'prod-1', vendor_id: 'vend-1', vendor_price_id: 'vp-1',
          unit_selling_price: 1500, subtotal: 3000
        })
      }));
    });

    it('7. Rejects cross-tenant ProductVendor', async () => {
      mockQuotationRevision.findUnique.mockResolvedValue({
        id: 'qr-1', status: 'DRAFT', currency_id: 'curr-usd', currency_decimal_places_snapshot: 2, lines: []
      });
      mockProductVendor.findUnique.mockResolvedValue({ id: 'pv-1', tenant_id: 'tenant-OTHER' });

      await expect(QuotationService.addQuotationLine('qr-1', { product_vendor_id: 'pv-1' }))
        .rejects.toThrow('Invalid product vendor');
    });

    it('8. Correct tax calculation and rounding', async () => {
      mockQuotationRevision.findUnique.mockResolvedValue({
        id: 'qr-1', status: 'DRAFT', currency_id: 'curr-usd', currency_decimal_places_snapshot: 2, lines: []
      });
      await QuotationService.addQuotationLine('qr-1', {
        item_type: 'FREEFORM', quantity: 1, manual_unit_price: 100.123, tax_rate: 10
      });
      // 100.123 -> rounded to DP2 subtotal: 100.12
      // Tax: 100.12 * 10% = 10.012 -> rounded 10.01
      // Line Total: 100.12 + 10.01 = 110.13
      expect(mockQuotationLine.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          subtotal: 100.12, tax_amount: 10.01, line_total: 110.13
        })
      }));
    });

    it('9. Modifying an issued revision is rejected', async () => {
      mockQuotationRevision.findUnique.mockResolvedValue({ id: 'qr-1', status: 'ISSUED' });
      await expect(QuotationService.addQuotationLine('qr-1', {})).rejects.toThrow('Cannot modify');
    });
  });

  describe('Revision Workflow', () => {
    it('10. Issuing a revision updates statuses and timestamps', async () => {
      mockQuotationRevision.findUnique.mockResolvedValue({ id: 'qr-1', status: 'DRAFT', quotation_id: 'q-1' });
      await QuotationService.issueQuotation('qr-1');
      expect(mockQuotationRevision.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'ISSUED' })
      }));
      expect(mockQuotation.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'ISSUED' })
      }));
    });

    it('11. Issuing already issued revision is rejected', async () => {
      mockQuotationRevision.findUnique.mockResolvedValue({ id: 'qr-1', status: 'ISSUED' });
      await expect(QuotationService.issueQuotation('qr-1')).rejects.toThrow('Only draft');
    });

    it('12. Create new revision from issued revision', async () => {
      mockQuotation.findUnique.mockResolvedValue({
        id: 'q-1', current_revision_id: 'qr-1',
        revisions: [
          { id: 'qr-1', revision_number: 1, status: 'ISSUED', subtotal: 100, currency_code_snapshot: 'USD' }
        ]
      });
      mockQuotationLine.findMany?.mockResolvedValue([{ id: 'line-1', subtotal: 100 }]);
      mockQuotationRevision.create.mockResolvedValue({ id: 'qr-2', revision_number: 2 });

      await QuotationService.createQuotationRevision('q-1');

      // Old revision superseded
      expect(mockQuotationRevision.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'qr-1' }, data: { status: 'SUPERSEDED' }
      }));

      // New revision created
      expect(mockQuotationRevision.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ revision_number: 2, status: 'DRAFT', subtotal: 100 })
      }));

      // Lines copied
      expect(mockQuotationLine.createMany).toHaveBeenCalled();
    });

    it('13. Create new revision fails if draft exists', async () => {
      mockQuotation.findUnique.mockResolvedValue({
        id: 'q-1', current_revision_id: 'qr-1',
        revisions: [{ id: 'qr-1', revision_number: 1, status: 'DRAFT' }]
      });
      await expect(QuotationService.createQuotationRevision('q-1')).rejects.toThrow('while a draft');
    });
  });
});
