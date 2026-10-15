/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as CostingService from '../src/lib/commercial/costing-service';
import Decimal from 'decimal.js';

vi.mock('../src/lib/tenant/context', () => ({
  getTenantContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-1', userId: 'user-1' }),
}));

vi.mock('../src/lib/auth/boundary', () => ({
  requirePermission: vi.fn(),
}));

vi.mock('../src/lib/audit/logger', () => ({
  logAudit: vi.fn(),
}));

const { mockCostingSettings, mockCalculateVendorCost } = vi.hoisted(() => {
  return {
    mockCostingSettings: { findUnique: vi.fn(), upsert: vi.fn() },
    mockCalculateVendorCost: vi.fn()
  };
});

vi.mock('../src/lib/db/tenant-db', () => ({
  getTenantDb: vi.fn().mockResolvedValue({
    CostingSettings: mockCostingSettings,
  })
}));

vi.mock('../src/lib/commercial/vendor-price-service', () => ({
  calculateVendorCost: mockCalculateVendorCost
}));

describe('Commercial Costing Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCalculateVendorCost.mockResolvedValue({
      vendor_price_id: 'vp-1',
      unit_cost: new Decimal(100),
      quantity: new Decimal(10),
      subtotal: new Decimal(1000),
      currency: { id: 'curr-1', code: 'USD', decimal_places: 2 }
    });
  });

  describe('Settings Validation', () => {
    it('1. Fetches settings with defaults if missing', async () => {
      mockCostingSettings.findUnique.mockResolvedValue(null);
      const res = await CostingService.getCostingSettings();
      expect(res.default_pricing_method).toBe("MARGIN");
      expect(res.default_target_percentage.toString()).toBe("20");
    });

    it('2. Rejects negative min margin percentage', async () => {
      await expect(CostingService.updateCostingSettings({
        min_margin_percentage: -5
      })).rejects.toThrow('negative');
    });

    it('3. Rejects min margin >= 100', async () => {
      await expect(CostingService.updateCostingSettings({
        min_margin_percentage: 100
      })).rejects.toThrow('less than 100');
    });

    it('4. Rejects default margin >= 100', async () => {
      await expect(CostingService.updateCostingSettings({
        default_pricing_method: 'MARGIN',
        default_target_percentage: 100
      })).rejects.toThrow('less than 100');
    });

    it('5. Upserts settings and audits', async () => {
      mockCostingSettings.upsert.mockResolvedValueOnce({ id: 'cs-1' });
      await CostingService.updateCostingSettings({
        default_pricing_method: 'MARKUP',
        default_target_percentage: 30,
        max_markup_percentage: 150
      });
      const logger = await import('../src/lib/audit/logger');
      expect(logger.logAudit).toHaveBeenCalledWith("COSTING_SETTINGS_UPDATED", "CostingSettings", "cs-1", null);
      expect(mockCostingSettings.upsert).toHaveBeenCalled();
    });
  });

  describe('Calculation Engine', () => {
    it('6. Correct landed-cost total without components', async () => {
      mockCostingSettings.findUnique.mockResolvedValue(null);
      const res = await CostingService.calculateCommercialCost({
        product_vendor_id: 'pv-1',
        currency_id: 'curr-1',
        quantity: 10,
        effective_date: new Date(),
        components: [],
        pricing_method: "MARGIN",
        target_percentage: 20
      });
      // 10 units @ 100 = 1000 base line total
      expect(res.base_line_total).toBe(1000);
      expect(res.landed_cost_line_total).toBe(1000);
      expect(res.landed_unit_cost).toBe(100);
    });

    it('7. Fixed freight amount calculation', async () => {
      mockCostingSettings.findUnique.mockResolvedValue(null);
      const res = await CostingService.calculateCommercialCost({
        product_vendor_id: 'pv-1',
        currency_id: 'curr-1',
        quantity: 10,
        effective_date: new Date(),
        components: [
          { type: 'FREIGHT', description: 'Sea Freight', method: 'FIXED_AMOUNT', amount: 200 }
        ],
        pricing_method: "MARGIN",
        target_percentage: 20
      });
      // Base: 1000. Fixed freight (line level): 200. Total = 1200
      expect(res.landed_cost_line_total).toBe(1200);
      expect(res.landed_unit_cost).toBe(120);
    });

    it('8. Percentage component calculation', async () => {
      mockCostingSettings.findUnique.mockResolvedValue(null);
      const res = await CostingService.calculateCommercialCost({
        product_vendor_id: 'pv-1',
        currency_id: 'curr-1',
        quantity: 10,
        effective_date: new Date(),
        components: [
          { type: 'CUSTOMS', description: 'Import Duty', method: 'PERCENTAGE_OF_BASE_COST', amount: 15 } // 15% of 1000 = 150
        ],
        pricing_method: "MARGIN",
        target_percentage: 20
      });
      expect(res.landed_cost_line_total).toBe(1150);
      expect(res.landed_unit_cost).toBe(115);
    });

    it('9. Correct margin-based selling price', async () => {
      mockCostingSettings.findUnique.mockResolvedValue(null);
      const res = await CostingService.calculateCommercialCost({
        product_vendor_id: 'pv-1',
        currency_id: 'curr-1',
        quantity: 10, // Cost = 1000
        effective_date: new Date(),
        components: [],
        pricing_method: "MARGIN",
        target_percentage: 20 // 1000 / (1 - 0.2) = 1250
      });
      expect(res.selling_price_line_total).toBe(1250);
      expect(res.selling_price_unit).toBe(125);
      expect(res.actual_margin_percentage).toBe(20);
    });

    it('10. Correct markup-based selling price', async () => {
      mockCostingSettings.findUnique.mockResolvedValue(null);
      const res = await CostingService.calculateCommercialCost({
        product_vendor_id: 'pv-1',
        currency_id: 'curr-1',
        quantity: 10, // Cost = 1000
        effective_date: new Date(),
        components: [],
        pricing_method: "MARKUP",
        target_percentage: 20 // 1000 * 1.2 = 1200
      });
      expect(res.selling_price_line_total).toBe(1200);
      expect(res.selling_price_unit).toBe(120);
      expect(res.actual_markup_percentage).toBe(20);
    });

    it('11. Margin of 100% rejected', async () => {
      mockCostingSettings.findUnique.mockResolvedValue(null);
      await expect(CostingService.calculateCommercialCost({
        product_vendor_id: 'pv-1', currency_id: 'curr-1', quantity: 10, effective_date: new Date(), components: [],
        pricing_method: "MARGIN", target_percentage: 100
      })).rejects.toThrow('strictly less than 100');
    });

    it('12. Negative percentage rejected', async () => {
      mockCostingSettings.findUnique.mockResolvedValue(null);
      await expect(CostingService.calculateCommercialCost({
        product_vendor_id: 'pv-1', currency_id: 'curr-1', quantity: 10, effective_date: new Date(), components: [],
        pricing_method: "MARGIN", target_percentage: -5
      })).rejects.toThrow('negative');
    });

    it('13. Negative component cost rejected', async () => {
      mockCostingSettings.findUnique.mockResolvedValue(null);
      await expect(CostingService.calculateCommercialCost({
        product_vendor_id: 'pv-1', currency_id: 'curr-1', quantity: 10, effective_date: new Date(),
        components: [{ type: 'FREIGHT', description: '', method: 'FIXED_AMOUNT', amount: -10 }],
        pricing_method: "MARGIN", target_percentage: 20
      })).rejects.toThrow('negative');
    });

    it('14. Minimum margin enforcement', async () => {
      mockCostingSettings.findUnique.mockResolvedValue({
        tenant_id: 't-1', min_margin_percentage: new Decimal(25)
      });
      await expect(CostingService.calculateCommercialCost({
        product_vendor_id: 'pv-1', currency_id: 'curr-1', quantity: 10, effective_date: new Date(), components: [],
        pricing_method: "MARGIN", target_percentage: 20
      })).rejects.toThrow('below the configured minimum');
    });

    it('15. Maximum markup enforcement', async () => {
      mockCostingSettings.findUnique.mockResolvedValue({
        tenant_id: 't-1', max_markup_percentage: new Decimal(15)
      });
      await expect(CostingService.calculateCommercialCost({
        product_vendor_id: 'pv-1', currency_id: 'curr-1', quantity: 10, effective_date: new Date(), components: [],
        pricing_method: "MARKUP", target_percentage: 20
      })).rejects.toThrow('exceeds the configured maximum');
    });

    it('16. Zero-cost behavior (Margin)', async () => {
      const vps = await import('../src/lib/commercial/vendor-price-service');
      mockCalculateVendorCost.mockResolvedValueOnce({
        vendor_price_id: 'vp-0', unit_cost: new Decimal(0), quantity: new Decimal(10), subtotal: new Decimal(0), currency: { decimal_places: 2 }
      });
      mockCostingSettings.findUnique.mockResolvedValue(null);
      const res = await CostingService.calculateCommercialCost({
        product_vendor_id: 'pv-1', currency_id: 'curr-1', quantity: 10, effective_date: new Date(), components: [],
        pricing_method: "MARGIN", target_percentage: 20
      });
      expect(res.selling_price_line_total).toBe(0);
      expect(res.actual_margin_percentage).toBe(0);
    });

    it('17. Zero-cost behavior (Markup)', async () => {
      const vps = await import('../src/lib/commercial/vendor-price-service');
      mockCalculateVendorCost.mockResolvedValueOnce({
        vendor_price_id: 'vp-0', unit_cost: new Decimal(0), quantity: new Decimal(10), subtotal: new Decimal(0), currency: { decimal_places: 2 }
      });
      mockCostingSettings.findUnique.mockResolvedValue(null);
      const res = await CostingService.calculateCommercialCost({
        product_vendor_id: 'pv-1', currency_id: 'curr-1', quantity: 10, effective_date: new Date(), components: [],
        pricing_method: "MARKUP", target_percentage: 20
      });
      expect(res.selling_price_line_total).toBe(0);
      expect(res.actual_markup_percentage).toBe(0);
    });

    it('18. Correct rounding for currency decimal places', async () => {
      const vps = await import('../src/lib/commercial/vendor-price-service');
      mockCalculateVendorCost.mockResolvedValueOnce({
        vendor_price_id: 'vp-1', unit_cost: new Decimal(100.123), quantity: new Decimal(10), subtotal: new Decimal(1001.23), currency: { decimal_places: 2 }
      });
      mockCostingSettings.findUnique.mockResolvedValue(null);
      const res = await CostingService.calculateCommercialCost({
        product_vendor_id: 'pv-1', currency_id: 'curr-1', quantity: 10, effective_date: new Date(),
        components: [{ type: 'FREIGHT', description: '', method: 'FIXED_AMOUNT', amount: 10.555 }],
        pricing_method: "MARKUP", target_percentage: 10.33
      });
      // subtotal 1001.23 + 10.555 = 1011.785
      // 1011.785 * 1.1033 = 1116.2995...
      // Rounded to DP 2 => 1116.30
      expect(res.selling_price_line_total).toBe(1116.30);
    });

    it('19. Missing permission rejected server-side', async () => {
      const boundary = await import('../src/lib/auth/boundary');
      (boundary.requirePermission as any).mockRejectedValueOnce(new Error("Unauthorized"));
      await expect(CostingService.calculateCommercialCost({
        product_vendor_id: 'pv-1', currency_id: 'curr-1', quantity: 10, effective_date: new Date(), components: [],
        pricing_method: "MARGIN", target_percentage: 20
      })).rejects.toThrow("Unauthorized");
    });

    it('20. Cross-tenant product/vendor or currency rejected by price service securely', async () => {
      const vps = await import('../src/lib/commercial/vendor-price-service');
      mockCalculateVendorCost.mockRejectedValueOnce(new Error("Product vendor mapping not found"));
      await expect(CostingService.calculateCommercialCost({
        product_vendor_id: 'pv-invalid', currency_id: 'curr-invalid', quantity: 10, effective_date: new Date(), components: [],
        pricing_method: "MARGIN", target_percentage: 20
      })).rejects.toThrow("mapping not found");
    });
  });
});
