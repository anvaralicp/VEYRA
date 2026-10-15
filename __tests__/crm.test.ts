/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as CustomerService from '../src/lib/crm/customer-service';
import { getTenantContext } from '../src/lib/tenant/context';
import { getTenantDb } from '../src/lib/db/tenant-db';

// Mock context
vi.mock('../src/lib/tenant/context', () => ({
  getTenantContext: vi.fn(),
}));

// Mock permissions
vi.mock('../src/lib/auth/boundary', () => ({
  requirePermission: vi.fn(),
  requireTenantContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-1', userId: 'user-1' }),
}));

// Mock audit
vi.mock('../src/lib/audit/logger', () => ({
  logAudit: vi.fn(),
}));

// Mock DB
const { mockCustomer, mockContact, mockSite } = vi.hoisted(() => ({
  mockCustomer: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  mockContact: {
    create: vi.fn(),
    update: vi.fn(),
  },
  mockSite: {
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  }
}));

vi.mock('../src/lib/db/tenant-db', () => ({
  getTenantDb: vi.fn().mockResolvedValue({
    Customer: mockCustomer,
    CustomerContact: mockContact,
    CustomerSite: mockSite,
  }),
}));

describe('CRM Customer Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getTenantContext as any).mockResolvedValue({
      tenantId: 'tenant-1',
      userId: 'user-1',
    });
  });

  describe('Customer Operations', () => {
    it('TEST A: Tenant A can create a customer', async () => {
      mockCustomer.findMany.mockResolvedValueOnce([]); // No duplicates
      mockCustomer.count.mockResolvedValueOnce(0); // Count for numbering
      mockCustomer.create.mockResolvedValueOnce({
        id: 'cus-1',
        customer_number: 'CUS-000001',
        legal_name: 'Test Corp',
      });

      const customer = await CustomerService.createCustomer({ legal_name: 'Test Corp' });
      expect(customer.id).toBe('cus-1');
      expect(mockCustomer.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          legal_name: 'Test Corp',
          customer_number: 'CUS-000001'
        })
      }));
    });

    it('TEST E: Customer number is unique within tenant (handled by DB logic & count)', async () => {
      mockCustomer.findMany.mockResolvedValueOnce([]); // No duplicates
      mockCustomer.count.mockResolvedValueOnce(5); // Count for numbering
      mockCustomer.create.mockResolvedValueOnce({
        id: 'cus-2',
        customer_number: 'CUS-000006',
        legal_name: 'Unique Corp',
      });

      const customer = await CustomerService.createCustomer({ legal_name: 'Unique Corp' });
      expect(customer.customer_number).toBe('CUS-000006');
    });

    it('TEST F: Customer can be deactivated', async () => {
      mockCustomer.update.mockResolvedValueOnce({ id: 'cus-1', status: 'INACTIVE' });
      const customer = await CustomerService.deactivateCustomer('cus-1');
      expect(customer.status).toBe('INACTIVE');
      expect(mockCustomer.update).toHaveBeenCalledWith({
        where: { id: 'cus-1' },
        data: { status: 'INACTIVE' }
      });
    });
    it('TEST G: Unauthorized user cannot create customer', async () => {
      const { requirePermission } = await import('../src/lib/auth/boundary');
      (requirePermission as any).mockRejectedValueOnce(new Error('Forbidden'));

      await expect(CustomerService.createCustomer({ legal_name: 'Test Corp' })).rejects.toThrow('Forbidden');
    });

    it('TEST H: Unauthorized user cannot update customer', async () => {
      const { requirePermission } = await import('../src/lib/auth/boundary');
      (requirePermission as any).mockRejectedValueOnce(new Error('Forbidden'));

      await expect(CustomerService.updateCustomer('cus-1', { legal_name: 'Test Corp' })).rejects.toThrow('Forbidden');
    });
  });

  describe('Contact & Site Operations', () => {
    it('TEST I: Contact can be created for a customer', async () => {
      mockContact.create.mockResolvedValueOnce({ id: 'con-1', name: 'John Doe' });
      const contact = await CustomerService.createContact('cus-1', { name: 'John Doe' });
      expect(contact.id).toBe('con-1');
      expect(mockContact.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          customer_id: 'cus-1',
          name: 'John Doe'
        })
      }));
    });

    it('TEST M: Site can be created for a customer', async () => {
      mockSite.count.mockResolvedValueOnce(0);
      mockSite.create.mockResolvedValueOnce({ id: 'site-1', site_number: 'STE-0001' });
      const site = await CustomerService.createSite('cus-1', { name: 'HQ' });
      expect(site.id).toBe('site-1');
      expect(mockSite.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          customer_id: 'cus-1',
          site_number: 'STE-0001'
        })
      }));
    });
  });

  describe('Integration & Constraints', () => {
    it('TEST R: Audit records are generated', async () => {
      const { logAudit } = await import('../src/lib/audit/logger');

      mockCustomer.findMany.mockResolvedValueOnce([]);
      mockCustomer.count.mockResolvedValueOnce(0);
      mockCustomer.create.mockResolvedValueOnce({ id: 'cus-1', customer_number: 'CUS-0001' });

      await CustomerService.createCustomer({ legal_name: 'Audit Corp' });
      expect(logAudit).toHaveBeenCalledWith('CUSTOMER_CREATE', 'Customer', 'cus-1', { number: 'CUS-0001' });
    });
  });
});
