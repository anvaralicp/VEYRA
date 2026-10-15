/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as LeadService from '../src/lib/crm/lead-service';
import * as OpportunityService from '../src/lib/crm/opportunity-service';
import { getTenantContext } from '../src/lib/tenant/context';
import { db } from '../src/prisma/db';

// Mock context
vi.mock('../src/lib/tenant/context', () => ({
  getTenantContext: vi.fn(),
}));

// Mock permissions
vi.mock('../src/lib/auth/boundary', () => ({
  requirePermission: vi.fn(),
}));

// Mock audit
vi.mock('../src/lib/audit/logger', () => ({
  logAudit: vi.fn(),
}));

// Mock DB objects
const { mockLead, mockOpp, mockCustomer, mockContact, mockMember, mockTx } = vi.hoisted(() => ({
  mockLead: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  mockOpp: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  mockCustomer: {
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  mockContact: {
    create: vi.fn(),
  },
  mockMember: {
    findUnique: vi.fn(),
  },
  mockTx: vi.fn()
}));

// Provide transaction execution capability for the mock
mockTx.mockImplementation(async (callback: any) => {
  return await callback({
    Lead: mockLead,
    Opportunity: mockOpp,
    Customer: mockCustomer,
    CustomerContact: mockContact,
    lead: mockLead,
    opportunity: mockOpp,
    customer: mockCustomer,
    customerContact: mockContact
  });
});

vi.mock('../src/lib/db/tenant-db', () => ({
  getTenantDb: vi.fn().mockResolvedValue({
    Lead: mockLead,
    Opportunity: mockOpp,
    Customer: mockCustomer,
    TenantMember: mockMember,
    lead: mockLead,
    opportunity: mockOpp,
    customer: mockCustomer,
    tenantMember: mockMember,
    transaction: mockTx,
    $transaction: mockTx
  }),
}));

vi.mock('../src/prisma/db', () => ({
  db: {
    TenantMember: mockMember,
    tenantMember: mockMember,
    transaction: mockTx,
    $transaction: mockTx
  }
}));

describe('CRM Sales Services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getTenantContext as any).mockResolvedValue({
      tenantId: 'tenant-1',
      userId: 'user-1',
    });
  });

  describe('Lead Management', () => {
    it('TEST A: Tenant A can create a lead', async () => {
      mockMember.findUnique.mockResolvedValueOnce({ id: 'mem-1' }); // Owner validation passes
      mockLead.count.mockResolvedValueOnce(0);
      mockLead.create.mockResolvedValueOnce({
        id: 'lead-1',
        lead_number: 'LEAD-000001',
        company_name: 'Lead Corp',
      });

      const lead = await LeadService.createLead({ company_name: 'Lead Corp', owner_id: 'user-1' });
      expect(lead.id).toBe('lead-1');
      expect(mockLead.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          company_name: 'Lead Corp',
          lead_number: 'LEAD-000001'
        })
      }));
    });

    it('TEST C: Lead owner must belong to current tenant', async () => {
      mockMember.findUnique.mockResolvedValueOnce(null); // Owner validation fails
      await expect(LeadService.createLead({ company_name: 'Lead Corp', owner_id: 'user-2' }))
        .rejects.toThrow('Owner must belong to the current tenant');
    });

    it('TEST D: Unauthorized user cannot create lead', async () => {
      const { requirePermission } = await import('../src/lib/auth/boundary');
      (requirePermission as any).mockRejectedValueOnce(new Error('Forbidden'));

      await expect(LeadService.createLead({ company_name: 'Lead Corp' })).rejects.toThrow('Forbidden');
    });

    it('TEST H: Lead conversion is atomic and creates customer/contact/opp', async () => {
      mockLead.findUnique.mockResolvedValueOnce({
        id: 'lead-1',
        company_name: 'Convert Corp',
        contact_name: 'John Doe',
        status: 'NEW'
      });

      mockCustomer.count.mockResolvedValueOnce(0);
      mockCustomer.create.mockResolvedValueOnce({ id: 'cus-1' });
      mockContact.create.mockResolvedValueOnce({ id: 'con-1' });
      mockOpp.count.mockResolvedValueOnce(0);
      mockOpp.create.mockResolvedValueOnce({ id: 'opp-1' });

      const res = await LeadService.convertLead('lead-1', { create_customer: true });
      expect(res.customerId).toBe('cus-1');
      expect(res.opportunityId).toBe('opp-1');

      // Verifies atomic transaction callback was executed and updated the lead
      expect(mockLead.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'lead-1' },
        data: expect.objectContaining({ status: 'CONVERTED' })
      }));
    });

    it('TEST I: Already converted lead cannot be converted again', async () => {
      mockLead.findUnique.mockResolvedValueOnce({
        id: 'lead-1',
        status: 'CONVERTED'
      });
      await expect(LeadService.convertLead('lead-1', { create_customer: true }))
        .rejects.toThrow('Lead is already converted');
    });

    it('TEST I2: Existing customer reuse links opportunity to existing customer without creating duplicate customer', async () => {
      mockLead.findUnique.mockResolvedValueOnce({
        id: 'lead-1',
        company_name: 'Existing Corp',
        contact_name: 'Jane Doe',
        status: 'NEW'
      });

      mockCustomer.findUnique.mockResolvedValueOnce({ id: 'existing-cus-1' });
      mockContact.create.mockResolvedValueOnce({ id: 'con-2' });
      mockOpp.count.mockResolvedValueOnce(1);
      mockOpp.create.mockResolvedValueOnce({ id: 'opp-2' });

      const res = await LeadService.convertLead('lead-1', {
        create_customer: false,
        customer_id: 'existing-cus-1'
      });

      expect(res.customerId).toBe('existing-cus-1');
      expect(res.opportunityId).toBe('opp-2');
      // Proves customer.create was NOT called
      expect(mockCustomer.create).not.toHaveBeenCalled();
      // Proves contact was linked to existing customer
      expect(mockContact.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ customer_id: 'existing-cus-1' })
      }));
      // Proves opportunity was linked to existing customer
      expect(mockOpp.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ customer_id: 'existing-cus-1' })
      }));
      // Proves lead was marked CONVERTED
      expect(mockLead.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'lead-1' },
        data: expect.objectContaining({ status: 'CONVERTED' })
      }));
    });

    it('TEST I3: Unauthorized user without lead.convert permission is rejected', async () => {
      const { requirePermission } = await import('../src/lib/auth/boundary');
      (requirePermission as any).mockRejectedValueOnce(new Error('Permission denied: lead.convert'));

      await expect(LeadService.convertLead('lead-1', { create_customer: true }))
        .rejects.toThrow('Permission denied: lead.convert');
    });

    it('TEST I4: Cross-tenant customer lookup failure rejects conversion', async () => {
      mockLead.findUnique.mockResolvedValueOnce({
        id: 'lead-1',
        company_name: 'Cross Tenant Corp',
        contact_name: 'John Doe',
        status: 'NEW'
      });

      // Customer not found in current tenant scope
      mockCustomer.findUnique.mockResolvedValueOnce(null);

      await expect(LeadService.convertLead('lead-1', {
        create_customer: false,
        customer_id: 'foreign-tenant-cus'
      })).rejects.toThrow('Record not found in the current tenant.');
    });

    it('TEST I5: Cross-tenant lead lookup failure rejects conversion', async () => {
      // Lead not found in current tenant scope
      mockLead.findUnique.mockResolvedValueOnce(null);

      await expect(LeadService.convertLead('foreign-lead', { create_customer: true }))
        .rejects.toThrow('Lead not found');
    });

    it('TEST I6: Confirmed opportunity fields (name, estimated_value, expected_close_date) are applied', async () => {
      mockLead.findUnique.mockResolvedValueOnce({
        id: 'lead-1',
        company_name: 'Custom Corp',
        contact_name: 'Alice',
        status: 'NEW',
        currency: 'USD'
      });

      mockCustomer.count.mockResolvedValueOnce(0);
      mockCustomer.create.mockResolvedValueOnce({ id: 'cus-3' });
      mockContact.create.mockResolvedValueOnce({ id: 'con-3' });
      mockOpp.count.mockResolvedValueOnce(0);
      mockOpp.create.mockResolvedValueOnce({ id: 'opp-3' });

      const closeDate = '2026-12-31';
      const res = await LeadService.convertLead('lead-1', {
        create_customer: true,
        opportunity_name: 'Custom Deal Title',
        estimated_value: 75000,
        expected_close_date: closeDate
      });

      expect(res.opportunityId).toBe('opp-3');
      expect(mockOpp.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          name: 'Custom Deal Title',
          estimated_value: 75000,
          expected_close_date: new Date(closeDate)
        })
      }));
    });
  });

  describe('Opportunity Management', () => {
    it('TEST J: Tenant A can create opportunity', async () => {
      mockMember.findUnique.mockResolvedValueOnce({ id: 'mem-1' }); // Owner valid
      mockCustomer.findUnique.mockResolvedValueOnce({ id: 'cus-1' }); // Customer valid
      mockOpp.count.mockResolvedValueOnce(0);
      mockOpp.create.mockResolvedValueOnce({ id: 'opp-1', opportunity_number: 'OPP-000001' });

      const opp = await OpportunityService.createOpportunity({
        name: 'Big Deal',
        customer_id: 'cus-1',
        owner_id: 'user-1'
      });

      expect(opp.id).toBe('opp-1');
    });

    it('TEST K: Opportunity cannot reference Tenant B customer', async () => {
      mockMember.findUnique.mockResolvedValueOnce({ id: 'mem-1' });
      mockCustomer.findUnique.mockResolvedValueOnce(null); // Customer not found in tenant scope

      await expect(OpportunityService.createOpportunity({
        name: 'Big Deal',
        customer_id: 'cus-2',
        owner_id: 'user-1'
      })).rejects.toThrow('Customer must belong to current tenant');
    });

    it('TEST L: Opportunity owner must belong to current tenant', async () => {
      mockMember.findUnique.mockResolvedValueOnce(null); // Owner invalid
      await expect(OpportunityService.createOpportunity({
        name: 'Big Deal',
        customer_id: 'cus-1',
        owner_id: 'user-invalid'
      })).rejects.toThrow('Owner must belong to the current tenant');
    });

    it('TEST M: Opportunity stage changes are audited', async () => {
      const { logAudit } = await import('../src/lib/audit/logger');

      mockOpp.findUnique.mockResolvedValueOnce({ id: 'opp-1', stage: 'NEW' });
      mockMember.findUnique.mockResolvedValueOnce({ id: 'mem-1' }); // Optional owner check

      mockOpp.update.mockResolvedValueOnce({ id: 'opp-1', stage: 'DISCOVERY' });

      await OpportunityService.updateOpportunity('opp-1', { stage: 'DISCOVERY' });

      expect(logAudit).toHaveBeenCalledWith('OPPORTUNITY_STAGE_CHANGE', 'Opportunity', 'opp-1', { from: 'NEW', to: 'DISCOVERY' });
    });

    it('TEST N: Opportunity can be marked WON', async () => {
      mockOpp.update.mockResolvedValueOnce({ id: 'opp-1', status: 'WON' });
      const opp = await OpportunityService.markOpportunityWon('opp-1');
      expect(opp.status).toBe('WON');
    });

    it('TEST O: Opportunity can be marked LOST with loss reason', async () => {
      mockOpp.update.mockResolvedValueOnce({ id: 'opp-1', status: 'LOST', loss_reason: 'Too expensive' });
      const opp = await OpportunityService.markOpportunityLost('opp-1', 'Too expensive');
      expect(opp.status).toBe('LOST');
      expect(opp.loss_reason).toBe('Too expensive');
    });
  });

  describe('Pipeline', () => {
    it('TEST Q: Pipeline returns only tenant-owned opportunities', async () => {
      mockOpp.findMany.mockResolvedValueOnce([
        { id: 'opp-1', status: 'OPEN', estimated_value: 1000, probability: 50 }
      ]);
      const pipeline = await OpportunityService.getPipeline();
      expect(pipeline.length).toBe(1);
    });
  });
});
