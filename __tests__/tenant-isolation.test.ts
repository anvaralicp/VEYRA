/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTenantDb, isTenantScopedModel } from '../src/lib/db/tenant-db';
import { normalizeWhere } from '../src/lib/db/legacy-adapter';

// Mock getTenantContext to simulate authenticated multi-tenant requests
vi.mock('../src/lib/tenant/context', () => {
  return {
    getTenantContext: vi.fn(),
  };
});

const {
  mockCustomerModel,
  mockLeadModel,
  mockQuotationModel,
  mockStockLocationModel,
  mockUserModel,
  mockTenantMemberModel,
  mockRoleModel,
} = vi.hoisted(() => {
  function createMockCollection() {
    let lastWhere: any = null;
    const collection: any = {
      where: vi.fn().mockImplementation((w) => {
        lastWhere = w;
        return collection;
      }),
      all: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation((data) => Promise.resolve({ id: 'gen-id', ...data })),
      createAll: vi.fn().mockImplementation((items) =>
        Promise.resolve(items.map((it: any, idx: number) => ({ id: `gen-${idx}`, ...it })))
      ),
      first: vi.fn().mockResolvedValue(null),
      // In Prisma 8 / orm-postgres, update/delete returns null when 0 rows match the where clause
      update: vi.fn().mockImplementation((data) => {
        if (lastWhere && lastWhere.tenant_id === 'non-matching') return Promise.resolve(null);
        return Promise.resolve({ id: 'updated-id', ...data });
      }),
      updateAll: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn().mockImplementation(() => {
        if (lastWhere && lastWhere.tenant_id === 'non-matching') return Promise.resolve(null);
        return Promise.resolve({ id: 'deleted-id' });
      }),
      deleteAll: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn().mockImplementation((opts) => Promise.resolve({ id: 'upserted-id', ...opts.create })),
      aggregate: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue({ _count: 0 }) }),
    };
    return collection;
  }

  return {
    mockCustomerModel: createMockCollection(),
    mockLeadModel: createMockCollection(),
    mockQuotationModel: createMockCollection(),
    mockStockLocationModel: createMockCollection(),
    mockUserModel: createMockCollection(),
    mockTenantMemberModel: createMockCollection(),
    mockRoleModel: createMockCollection(),
  };
});

vi.mock('../src/prisma/db', () => ({
  db: {
    orm: {
      public: {
        Customer: mockCustomerModel,
        Lead: mockLeadModel,
        Quotation: mockQuotationModel,
        StockLocation: mockStockLocationModel,
        User: mockUserModel,
        TenantMember: mockTenantMemberModel,
        Role: mockRoleModel,
      },
    },
    Customer: mockCustomerModel,
    customer: mockCustomerModel,
    Lead: mockLeadModel,
    lead: mockLeadModel,
    Quotation: mockQuotationModel,
    quotation: mockQuotationModel,
    StockLocation: mockStockLocationModel,
    stockLocation: mockStockLocationModel,
    User: mockUserModel,
    user: mockUserModel,
    TenantMember: mockTenantMemberModel,
    tenantMember: mockTenantMemberModel,
    Role: mockRoleModel,
    role: mockRoleModel,
    transaction: vi.fn(async (cb: any) => {
      return cb({
        orm: {
          public: {
            Customer: mockCustomerModel,
            Lead: mockLeadModel,
            Quotation: mockQuotationModel,
            StockLocation: mockStockLocationModel,
            User: mockUserModel,
            TenantMember: mockTenantMemberModel,
            Role: mockRoleModel,
          },
        },
        Customer: mockCustomerModel,
        customer: mockCustomerModel,
        Lead: mockLeadModel,
        lead: mockLeadModel,
        Quotation: mockQuotationModel,
        quotation: mockQuotationModel,
        StockLocation: mockStockLocationModel,
        stockLocation: mockStockLocationModel,
        User: mockUserModel,
        user: mockUserModel,
        TenantMember: mockTenantMemberModel,
        tenantMember: mockTenantMemberModel,
        Role: mockRoleModel,
        role: mockRoleModel,
      });
    }),
  },
}));

import { getTenantContext } from '../src/lib/tenant/context';
import { db } from '../src/prisma/db';

describe('Tenant Isolation Regression Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Model Scope & Coverage Verification', () => {
    it('accurately classifies tenant-scoped vs system/global models', () => {
      // Commercial, Presales, CRM, and Inventory tenant-scoped models
      expect(isTenantScopedModel('Customer')).toBe(true);
      expect(isTenantScopedModel('Lead')).toBe(true);
      expect(isTenantScopedModel('Quotation')).toBe(true);
      expect(isTenantScopedModel('StockLocation')).toBe(true);
      expect(isTenantScopedModel('SupplierPurchaseOrder')).toBe(true);
      expect(isTenantScopedModel('GoodsReceipt')).toBe(true);
      expect(isTenantScopedModel('BOQ')).toBe(true);

      // System/Global un-scoped models
      expect(isTenantScopedModel('Tenant')).toBe(false);
      expect(isTenantScopedModel('User')).toBe(false);
      expect(isTenantScopedModel('Permission')).toBe(false);
    });

    it('normalizes compound unique where clauses into flat property maps', () => {
      const flattenedMember = normalizeWhere({
        user_id_tenant_id: { user_id: 'u-1', tenant_id: 't-1' },
      });
      expect(flattenedMember).toEqual({ user_id: 'u-1', tenant_id: 't-1' });

      const flattenedCurrency = normalizeWhere({
        tenant_id_code: { tenant_id: 't-1', code: 'USD' },
      });
      expect(flattenedCurrency).toEqual({ tenant_id: 't-1', code: 'USD' });
    });
  });

  describe('2. Cross-Tenant Reads & Forged Identifier Immunity', () => {
    it('TEST A: Read operations (findMany) automatically constrain query to authenticated Tenant A', async () => {
      (getTenantContext as any).mockResolvedValue({ tenantId: 'tenant-A', userId: 'user-1' });

      const tenantDb = await getTenantDb();
      await tenantDb.Customer.findMany({ where: { name: 'Acme' } });

      expect(mockCustomerModel.where).toHaveBeenCalledWith({
        name: 'Acme',
        tenant_id: 'tenant-A',
      });
    });

    it('TEST B: Read operations automatically scope commercial and inventory models (Lead, StockLocation)', async () => {
      (getTenantContext as any).mockResolvedValue({ tenantId: 'tenant-A', userId: 'user-1' });

      const tenantDb = await getTenantDb();
      await tenantDb.Lead.findMany({ where: { status: 'NEW' } });
      await tenantDb.StockLocation.findFirst({ where: { code: 'WH-1' } });

      expect(mockLeadModel.where).toHaveBeenCalledWith({
        status: 'NEW',
        tenant_id: 'tenant-A',
      });
      expect(mockStockLocationModel.where).toHaveBeenCalledWith({
        code: 'WH-1',
        tenant_id: 'tenant-A',
      });
    });

    it('TEST C: Tenant A attempting to query Tenant B records by supplying forged tenant_id is overridden', async () => {
      (getTenantContext as any).mockResolvedValue({ tenantId: 'tenant-A', userId: 'user-1' });

      const tenantDb = await getTenantDb();
      await tenantDb.Customer.findMany({ where: { tenant_id: 'tenant-B' } });

      // Overwritten with authenticated tenant-A
      expect(mockCustomerModel.where).toHaveBeenCalledWith({
        tenant_id: 'tenant-A',
      });
    });

    it('TEST C2: Compound unique selector query flattens and enforces authenticated tenant_id', async () => {
      (getTenantContext as any).mockResolvedValue({ tenantId: 'tenant-A', userId: 'user-1' });

      const tenantDb = await getTenantDb();
      await tenantDb.TenantMember.findUnique({
        where: {
          user_id_tenant_id: { user_id: 'u-1', tenant_id: 'forged-tenant-B' },
        },
      });

      expect(mockTenantMemberModel.where).toHaveBeenCalledWith({
        user_id: 'u-1',
        tenant_id: 'tenant-A',
      });
    });
  });

  describe('3. Atomic Cross-Tenant Writes, Updates, and Deletions', () => {
    it('TEST D: Create operations assign the authenticated tenant and overwrite forged tenant_id', async () => {
      (getTenantContext as any).mockResolvedValue({ tenantId: 'tenant-A', userId: 'user-1' });

      const tenantDb = await getTenantDb();
      await tenantDb.Lead.create({
        data: {
          tenant_id: 'forged-tenant-B',
          company_name: 'Initech',
        },
      });

      expect(mockLeadModel.create).toHaveBeenCalledWith({
        tenant_id: 'tenant-A',
        company_name: 'Initech',
      });
    });

    it('TEST E: Nested writes inherit the authenticated tenant ID recursively', async () => {
      (getTenantContext as any).mockResolvedValue({ tenantId: 'tenant-A', userId: 'user-1' });

      const tenantDb = await getTenantDb();
      await tenantDb.Quotation.create({
        data: {
          title: 'Enterprise Quote',
          revisions: {
            create: {
              revision_number: 1,
              tenant_id: 'forged-tenant-B',
            },
          },
        },
      });

      expect(mockQuotationModel.create).toHaveBeenCalledWith({
        tenant_id: 'tenant-A',
        title: 'Enterprise Quote',
        revisions: {
          create: {
            revision_number: 1,
            tenant_id: 'tenant-A',
          },
        },
      });
    });

    it('TEST F: Atomic single-record update passes tenant_id in where clause and rejects non-matching row', async () => {
      (getTenantContext as any).mockResolvedValue({ tenantId: 'tenant-A', userId: 'user-1' });

      const tenantDb = await getTenantDb();
      // Successful update within tenant
      await tenantDb.Customer.update({
        where: { id: 'rec-1' },
        data: { name: 'Legit Update' },
      });

      expect(mockCustomerModel.where).toHaveBeenCalledWith({
        id: 'rec-1',
        tenant_id: 'tenant-A',
      });

      // Update targeting record belonging to another tenant (returns null from database query)
      mockCustomerModel.update.mockResolvedValueOnce(null);

      await expect(
        tenantDb.Customer.update({ where: { id: 'rec-b' }, data: { name: 'Compromised' } })
      ).rejects.toThrow('Record not found in the current tenant.');
    });

    it('TEST G: Atomic single-record delete passes tenant_id in where clause and rejects non-matching row', async () => {
      (getTenantContext as any).mockResolvedValue({ tenantId: 'tenant-A', userId: 'user-1' });

      const tenantDb = await getTenantDb();
      await tenantDb.StockLocation.delete({ where: { id: 'loc-1' } });

      expect(mockStockLocationModel.where).toHaveBeenCalledWith({
        id: 'loc-1',
        tenant_id: 'tenant-A',
      });

      // Deleting non-existent/cross-tenant record returns null
      mockStockLocationModel.delete.mockResolvedValueOnce(null);

      await expect(
        tenantDb.StockLocation.delete({ where: { id: 'loc-b' } })
      ).rejects.toThrow('Record not found in the current tenant.');
    });

    it('TEST H: Bulk updateMany and deleteMany automatically scope to authenticated tenant', async () => {
      (getTenantContext as any).mockResolvedValue({ tenantId: 'tenant-B', userId: 'user-2' });

      const tenantDb = await getTenantDb();
      await tenantDb.Lead.updateMany({ where: { status: 'NEW' }, data: { status: 'ARCHIVED' } });
      await tenantDb.Lead.deleteMany({ where: { status: 'TRASH' } });

      expect(mockLeadModel.where).toHaveBeenCalledWith({
        status: 'NEW',
        tenant_id: 'tenant-B',
      });
      expect(mockLeadModel.where).toHaveBeenCalledWith({
        status: 'TRASH',
        tenant_id: 'tenant-B',
      });
    });

    it('TEST I: Upsert injects tenant ID into both create and update clauses and guards access', async () => {
      (getTenantContext as any).mockResolvedValue({ tenantId: 'tenant-A', userId: 'user-1' });

      const tenantDb = await getTenantDb();
      await tenantDb.Quotation.upsert({
        where: { id: 'q-1' },
        create: { title: 'New', tenant_id: 'tenant-B' },
        update: { title: 'Updated', tenant_id: 'tenant-B' },
      });

      expect(mockQuotationModel.upsert).toHaveBeenCalledWith({
        conflictOn: { id: true, tenant_id: true },
        create: { title: 'New', tenant_id: 'tenant-A' },
        update: { title: 'Updated', tenant_id: 'tenant-A' },
      });
    });
  });

  describe('4. Transaction Scoping & Isolation Enforcement', () => {
    it('TEST J: Transactions inherit and enforce atomic tenant isolation on all callbacks', async () => {
      (getTenantContext as any).mockResolvedValue({ tenantId: 'tenant-A', userId: 'user-1' });

      const tenantDb = await getTenantDb();

      await tenantDb.transaction(async (tx: any) => {
        await tx.Lead.findMany({ where: { status: 'ACTIVE' } });
        await tx.Lead.create({ data: { company_name: 'Acme Corp', tenant_id: 'tenant-B' } });
      });

      expect(mockLeadModel.where).toHaveBeenCalledWith({
        status: 'ACTIVE',
        tenant_id: 'tenant-A',
      });
      expect(mockLeadModel.create).toHaveBeenCalledWith({
        company_name: 'Acme Corp',
        tenant_id: 'tenant-A',
      });
    });

    it('TEST K: Cross-tenant update inside transaction callback is rejected uniformly', async () => {
      (getTenantContext as any).mockResolvedValue({ tenantId: 'tenant-A', userId: 'user-1' });

      mockLeadModel.update.mockResolvedValueOnce(null);

      const tenantDb = await getTenantDb();

      await expect(
        tenantDb.transaction(async (tx: any) => {
          await tx.Lead.update({ where: { id: 'lead-b' }, data: { company_name: 'Hack' } });
        })
      ).rejects.toThrow('Record not found in the current tenant.');
    });

    it('TEST L: Supports tdb.tdb self-reference pattern securely under transactions', async () => {
      (getTenantContext as any).mockResolvedValue({ tenantId: 'tenant-A', userId: 'user-1' });

      const tenantDb: any = await getTenantDb();
      expect(tenantDb.tdb).toBeDefined();

      await tenantDb.tdb.Customer.findMany({ where: { name: 'Test' } });
      expect(mockCustomerModel.where).toHaveBeenCalledWith({
        name: 'Test',
        tenant_id: 'tenant-A',
      });
    });
  });

  describe('5. Unauthenticated / Missing Context & Global Models', () => {
    it('TEST M: Missing tenant context is immediately rejected before query execution', async () => {
      (getTenantContext as any).mockRejectedValue(new Error('UNAUTHORIZED: Missing session'));

      await expect(getTenantDb()).rejects.toThrow('UNAUTHORIZED: Missing session');
    });

    it('TEST N: Global/System models (User) are not constrained with tenant_id', async () => {
      (getTenantContext as any).mockResolvedValue({ tenantId: 'tenant-A', userId: 'user-1' });

      const tenantDb = await getTenantDb();
      await tenantDb.User.findMany({ where: { email: 'admin@system.local' } });

      // User model does not have tenant_id injected into where
      expect(mockUserModel.where).toHaveBeenCalledWith({
        email: 'admin@system.local',
      });
    });
  });
});
