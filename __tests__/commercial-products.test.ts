

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as ProductService from '../src/lib/commercial/product-service';
import * as CategoryService from '../src/lib/commercial/category-service';
import * as ManufacturerService from '../src/lib/commercial/manufacturer-service';

vi.mock('../src/lib/tenant/context', () => ({
  getTenantContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-1', userId: 'user-1' }),
}));

vi.mock('../src/lib/auth/boundary', () => ({
  requirePermission: vi.fn(),
}));

vi.mock('../src/lib/audit/logger', () => ({
  logAudit: vi.fn(),
}));

const { mockProduct, mockCategory, mockManufacturer } = vi.hoisted(() => ({
  mockProduct: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
  mockCategory: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
  mockManufacturer: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn(), findFirst: vi.fn() }
}));

vi.mock('../src/lib/db/tenant-db', () => ({
  getTenantDb: vi.fn().mockResolvedValue({
    ProductService: mockProduct,
    ProductCategory: mockCategory,
    Manufacturer: mockManufacturer,
    productService: mockProduct,
    productCategory: mockCategory,
    manufacturer: mockManufacturer
  })
}));

describe('Commercial Foundation Services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ProductService', () => {
    it('AA. ProductService creation', async () => {
      mockProduct.findFirst.mockResolvedValueOnce(null); // No existing code
      mockCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1' });
      mockManufacturer.findUnique.mockResolvedValueOnce({ id: 'mfr-1' });
      mockProduct.create.mockResolvedValueOnce({ id: 'prod-1', item_code: 'PRD-001' });

      const prod = await ProductService.createProduct({
        item_code: 'prd-001', name: 'Server', category_id: 'cat-1', manufacturer_id: 'mfr-1'
      });
      expect(prod.id).toBe('prod-1');
      expect(mockProduct.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ item_code: 'PRD-001', name: 'Server' })
      }));
    });

    it('AB. ProductService retrieval', async () => {
      mockProduct.findUnique.mockResolvedValueOnce({ id: 'prod-1', name: 'Server' });
      const prod = await ProductService.getProductById('prod-1');
      expect(prod?.name).toBe('Server');
    });

    it('AC. ProductService update', async () => {
      mockProduct.findUnique.mockResolvedValueOnce({ id: 'prod-1', item_code: 'PRD-001' });
      mockProduct.findFirst.mockResolvedValueOnce(null); // No collision
      mockProduct.update.mockResolvedValueOnce({ id: 'prod-1', item_code: 'PRD-002' });

      const updated = await ProductService.updateProduct('prod-1', { item_code: 'prd-002', name: 'Updated' });
      expect(updated.item_code).toBe('PRD-002');
    });

    it('AD. ProductService deactivation (AP. Inactive product behavior)', async () => {
      mockProduct.update.mockResolvedValueOnce({ id: 'prod-1', is_active: false });
      const deactivated = await ProductService.deactivateProduct('prod-1');
      expect(deactivated.is_active).toBe(false);
    });

    it('AM. Duplicate item code rejection', async () => {
      mockProduct.findFirst.mockResolvedValueOnce({ id: 'prod-2', item_code: 'PRD-001' });
      await expect(ProductService.createProduct({ item_code: 'prd-001', name: 'Test' }))
        .rejects.toThrow('already exists');
    });

    it('AI. Cross-tenant manufacturer/category rejection', async () => {
      mockProduct.findFirst.mockResolvedValueOnce(null);
      // Mocking that findUnique returns null means the category/mfr does not exist IN this tenant's scoped proxy
      mockCategory.findUnique.mockResolvedValueOnce(null);
      await expect(ProductService.createProduct({ item_code: 'prd-003', name: 'Test', category_id: 'cat-foreign' }))
        .rejects.toThrow('Category must belong to the current tenant');
    });
  });

  describe('CategoryService', () => {
    it('AE. Category creation', async () => {
      mockCategory.findFirst.mockResolvedValueOnce(null);
      mockCategory.create.mockResolvedValueOnce({ id: 'cat-1', code: 'HW' });
      const cat = await CategoryService.createCategory({ code: 'hw', name: 'Hardware' });
      expect(cat.id).toBe('cat-1');
    });

    it('AF. Hierarchical categories', async () => {
      mockCategory.findFirst.mockResolvedValueOnce(null);
      mockCategory.findUnique.mockResolvedValueOnce({ id: 'cat-1', name: 'Hardware' }); // Parent exists
      mockCategory.create.mockResolvedValueOnce({ id: 'cat-2', parent_id: 'cat-1' });

      const child = await CategoryService.createCategory({ code: 'hw-net', name: 'Networking', parent_id: 'cat-1' });
      expect(child.parent_id).toBe('cat-1');
    });

    it('AN. Duplicate category code rejection', async () => {
      mockCategory.findFirst.mockResolvedValueOnce({ id: 'cat-2' });
      await expect(CategoryService.createCategory({ code: 'hw', name: 'Hardware 2' }))
        .rejects.toThrow('already exists');
    });
  });

  describe('ManufacturerService', () => {
    it('AG. Manufacturer creation', async () => {
      mockManufacturer.findFirst.mockResolvedValueOnce(null);
      mockManufacturer.create.mockResolvedValueOnce({ id: 'mfr-1', code: 'CSCO' });
      const mfr = await ManufacturerService.createManufacturer({ code: 'csco', name: 'Cisco' });
      expect(mfr.id).toBe('mfr-1');
    });

    it('AO. Duplicate manufacturer code rejection', async () => {
      mockManufacturer.findFirst.mockResolvedValueOnce({ id: 'mfr-2' });
      await expect(ManufacturerService.createManufacturer({ code: 'csco', name: 'Cisco 2' }))
        .rejects.toThrow('already exists');
    });
  });
});
