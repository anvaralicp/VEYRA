import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Next.js cache and navigation
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(),
}));

// Mock services
vi.mock('../src/lib/crm/lead-service', () => ({
  createLead: vi.fn().mockResolvedValue({ id: 'lead-123', lead_number: 'LEAD-000001' }),
  convertLead: vi.fn().mockResolvedValue({ customerId: 'cust-123', opportunityId: 'opp-123' }),
}));

vi.mock('../src/lib/crm/opportunity-service', () => ({
  createOpportunity: vi.fn().mockResolvedValue({ id: 'opp-123', opportunity_number: 'OPP-000001' }),
  markOpportunityWon: vi.fn().mockResolvedValue({ id: 'opp-123', status: 'WON' }),
  markOpportunityLost: vi.fn().mockResolvedValue({ id: 'opp-123', status: 'LOST' }),
}));

vi.mock('../src/lib/presales/boq-service', () => ({
  createBOQ: vi.fn().mockResolvedValue({ id: 'boq-123', boq_number: 'BOQ-000001' }),
  addBOQLine: vi.fn().mockResolvedValue({ id: 'line-123' }),
  submitBOQRevision: vi.fn().mockResolvedValue(undefined),
  approveBOQRevision: vi.fn().mockResolvedValue(undefined),
  rejectBOQRevision: vi.fn().mockResolvedValue(undefined),
  createBOQRevision: vi.fn().mockResolvedValue({ id: 'rev-2', revision_number: 2 }),
}));

vi.mock('../src/lib/presales/requirement-service', () => ({
  createRequirement: vi.fn().mockResolvedValue({ id: 'req-123', requirement_number: 'REQ-000001' }),
}));

vi.mock('../src/lib/presales/site-survey-service', () => ({
  createSiteSurvey: vi.fn().mockResolvedValue({ id: 'sur-123', survey_number: 'SUR-000001' }),
}));

vi.mock('../src/lib/presales/solution-service', () => ({
  createSolution: vi.fn().mockResolvedValue({ id: 'sol-123', solution_number: 'SOL-000001' }),
  createSolutionRevision: vi.fn().mockResolvedValue({ id: 'rev-2', revision_number: 2 }),
}));

vi.mock('../src/lib/crm/customer-service', () => ({
  createCustomer: vi.fn().mockResolvedValue({ id: 'cust-123', customer_number: 'CUS-000001' }),
  updateCustomer: vi.fn().mockResolvedValue({ id: 'cust-123' }),
  createContact: vi.fn().mockResolvedValue({ id: 'contact-123' }),
  createSite: vi.fn().mockResolvedValue({ id: 'site-123' }),
}));

vi.mock('../src/lib/commercial/procurement-service', () => ({
  createSupplierPurchaseOrder: vi.fn().mockResolvedValue({ id: 'spo-123', po_number: 'SPO-000001' }),
  addSupplierPurchaseOrderLine: vi.fn().mockResolvedValue({ id: 'line-123' }),
  submitSupplierPOForApproval: vi.fn().mockResolvedValue(undefined),
  approveSupplierPO: vi.fn().mockResolvedValue(undefined),
  issueSupplierPO: vi.fn().mockResolvedValue(undefined),
  acknowledgeSupplierPO: vi.fn().mockResolvedValue(undefined),
  cancelSupplierPO: vi.fn().mockResolvedValue(undefined),
}));

import { revalidatePath } from 'next/cache';
import * as LeadService from '../src/lib/crm/lead-service';
import * as OpportunityService from '../src/lib/crm/opportunity-service';
import * as BOQService from '../src/lib/presales/boq-service';
import * as RequirementService from '../src/lib/presales/requirement-service';
import * as SiteSurveyService from '../src/lib/presales/site-survey-service';
import * as SolutionService from '../src/lib/presales/solution-service';
import * as CustomerService from '../src/lib/crm/customer-service';
import * as ProcService from '../src/lib/commercial/procurement-service';

import {
  createLeadAction,
  convertLeadAction,
  createOpportunityAction,
  markOpportunityWonAction,
  markOpportunityLostAction,
  createBOQAction,
  addBOQLineAction,
  submitBOQRevisionAction,
  approveBOQRevisionAction,
  rejectBOQRevisionAction,
  newBOQRevisionAction,
  createRequirementAction,
  createSiteSurveyAction,
  createSolutionAction,
  newSolutionRevisionAction,
  createCustomerAction,
  updateCustomerAction,
  createContactAction,
  createSiteAction,
  createSupplierPurchaseOrder,
  addSupplierPurchaseOrderLine,
  submitSupplierPOForApproval,
  approveSupplierPO,
  issueSupplierPO,
  acknowledgeSupplierPO,
  cancelSupplierPO
} from '../src/app/(authenticated)/actions';

describe('Milestone 4 — UI Integration Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CRM Actions', () => {
    it('createLeadAction processes form and redirects to new lead', async () => {
      const formData = new FormData();
      formData.append('company_name', 'Acme Corp');
      formData.append('contact_name', 'John Doe');
      formData.append('owner_id', 'usr-1');

      await expect(createLeadAction(formData)).rejects.toThrow('REDIRECT:/crm/leads/lead-123');
      expect(LeadService.createLead).toHaveBeenCalledWith(
        expect.objectContaining({
          company_name: 'Acme Corp',
          contact_name: 'John Doe',
          owner_id: 'usr-1',
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith('/crm/leads');
    });

    it('convertLeadAction converts lead and redirects to opportunity', async () => {
      const formData = new FormData();
      formData.append('create_customer', 'true');

      await expect(convertLeadAction('lead-123', formData)).rejects.toThrow('REDIRECT:/crm/opportunities/opp-123');
      expect(LeadService.convertLead).toHaveBeenCalledWith('lead-123', {
        create_customer: true,
        customer_id: undefined,
      });
      expect(revalidatePath).toHaveBeenCalledWith('/crm/leads');
      expect(revalidatePath).toHaveBeenCalledWith('/crm/leads/lead-123');
      expect(revalidatePath).toHaveBeenCalledWith('/crm/opportunities');
    });

    it('createOpportunityAction creates opportunity and redirects', async () => {
      const formData = new FormData();
      formData.append('name', 'Cloud Migration');
      formData.append('customer_id', 'cust-123');
      formData.append('owner_id', 'usr-1');

      await expect(createOpportunityAction(formData)).rejects.toThrow('REDIRECT:/crm/opportunities/opp-123');
      expect(OpportunityService.createOpportunity).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Cloud Migration',
          customer_id: 'cust-123',
          owner_id: 'usr-1',
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith('/crm/opportunities');
    });

    it('markOpportunityWonAction and markOpportunityLostAction update opportunity status', async () => {
      await markOpportunityWonAction('opp-123');
      expect(OpportunityService.markOpportunityWon).toHaveBeenCalledWith('opp-123');
      expect(revalidatePath).toHaveBeenCalledWith('/crm/opportunities');

      await markOpportunityLostAction('opp-123', 'Price too high');
      expect(OpportunityService.markOpportunityLost).toHaveBeenCalledWith('opp-123', 'Price too high');
    });

    it('createCustomerAction, updateCustomerAction, createContactAction, createSiteAction succeed', async () => {
      const formData = new FormData();
      formData.append('legal_name', 'Tech Enterprise LLC');
      formData.append('display_name', 'Tech Enterprise');

      await expect(createCustomerAction(formData)).rejects.toThrow('REDIRECT:/crm/customers/cust-123');
      expect(CustomerService.createCustomer).toHaveBeenCalledWith(
        expect.objectContaining({
          legal_name: 'Tech Enterprise LLC',
          display_name: 'Tech Enterprise',
        })
      );

      const updateData = new FormData();
      updateData.append('display_name', 'Tech Enterprise Updated');
      await updateCustomerAction('cust-123', updateData);
      expect(CustomerService.updateCustomer).toHaveBeenCalledWith('cust-123', expect.any(Object));

      const contactData = new FormData();
      contactData.append('name', 'Jane Contact');
      await createContactAction('cust-123', contactData);
      expect(CustomerService.createContact).toHaveBeenCalledWith('cust-123', expect.any(Object));

      const siteData = new FormData();
      siteData.append('name', 'HQ Facility');
      await createSiteAction('cust-123', siteData);
      expect(CustomerService.createSite).toHaveBeenCalledWith('cust-123', expect.any(Object));
    });
  });

  describe('Presales & BOQ Actions', () => {
    it('createBOQAction creates BOQ and redirects', async () => {
      const formData = new FormData();
      formData.append('name', 'Network Infrastructure');
      formData.append('opportunity_id', 'opp-123');

      await expect(createBOQAction(formData)).rejects.toThrow('REDIRECT:/presales/boqs/boq-123');
      expect(BOQService.createBOQ).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Network Infrastructure',
          opportunity_id: 'opp-123',
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith('/presales/boqs');
    });

    it('addBOQLineAction adds line to revision and revalidates', async () => {
      const formData = new FormData();
      formData.append('product_name', 'Cisco Catalyst 9300');
      formData.append('quantity', '2');

      await addBOQLineAction('boq-123', 'rev-1', formData);
      expect(BOQService.addBOQLine).toHaveBeenCalledWith('boq-123', 'rev-1', expect.any(Object));
      expect(revalidatePath).toHaveBeenCalledWith('/presales/boqs/boq-123');
    });

    it('submitBOQRevisionAction, approveBOQRevisionAction, rejectBOQRevisionAction, newBOQRevisionAction manage revision states', async () => {
      await submitBOQRevisionAction('boq-123', 'rev-1');
      expect(BOQService.submitBOQRevision).toHaveBeenCalledWith('boq-123', 'rev-1');
      expect(revalidatePath).toHaveBeenCalledWith('/presales/boqs/boq-123');

      await approveBOQRevisionAction('boq-123', 'rev-1');
      expect(BOQService.approveBOQRevision).toHaveBeenCalledWith('boq-123', 'rev-1');

      await rejectBOQRevisionAction('boq-123', 'rev-1');
      expect(BOQService.rejectBOQRevision).toHaveBeenCalledWith('boq-123', 'rev-1');

      await newBOQRevisionAction('boq-123');
      expect(BOQService.createBOQRevision).toHaveBeenCalledWith('boq-123');
    });

    it('createRequirementAction, createSiteSurveyAction, createSolutionAction, newSolutionRevisionAction invoke services', async () => {
      const reqForm = new FormData();
      reqForm.append('title', 'Server Room Cooling');
      reqForm.append('opportunity_id', 'opp-123');
      await expect(createRequirementAction(reqForm)).rejects.toThrow('REDIRECT:/presales/requirements/req-123');
      expect(RequirementService.createRequirement).toHaveBeenCalled();

      const surForm = new FormData();
      surForm.append('opportunity_id', 'opp-123');
      surForm.append('site_id', 'site-123');
      await expect(createSiteSurveyAction(surForm)).rejects.toThrow('REDIRECT:/presales/site-surveys/sur-123');
      expect(SiteSurveyService.createSiteSurvey).toHaveBeenCalled();

      const solForm = new FormData();
      solForm.append('name', 'Architecture Blueprint');
      solForm.append('opportunity_id', 'opp-123');
      await expect(createSolutionAction(solForm)).rejects.toThrow('REDIRECT:/presales/solutions/sol-123');
      expect(SolutionService.createSolution).toHaveBeenCalled();

      const revForm = new FormData();
      revForm.append('title', 'Revision 2');
      await newSolutionRevisionAction('sol-123', revForm);
      expect(SolutionService.createSolutionRevision).toHaveBeenCalledWith('sol-123', {
        title: 'Revision 2',
        description: undefined,
      });
    });
  });

  describe('Supplier Purchase Order Actions & Workflows', () => {
    it('SPO action wrappers invoke procurement service methods correctly', async () => {
      await createSupplierPurchaseOrder({
        vendor_id: 'vend-1',
        currency_id: 'curr-1',
      });
      expect(ProcService.createSupplierPurchaseOrder).toHaveBeenCalledWith({
        vendor_id: 'vend-1',
        currency_id: 'curr-1',
      });

      await addSupplierPurchaseOrderLine('spo-1', {
        item_description_snapshot: 'Switch',
        unit_of_measure: 'EA',
        quantity: 5,
        unit_price: 100,
        tax_rate: 18,
      });
      expect(ProcService.addSupplierPurchaseOrderLine).toHaveBeenCalledWith('spo-1', expect.any(Object));

      await submitSupplierPOForApproval('spo-1');
      expect(ProcService.submitSupplierPOForApproval).toHaveBeenCalledWith('spo-1');

      await approveSupplierPO('spo-1');
      expect(ProcService.approveSupplierPO).toHaveBeenCalledWith('spo-1');

      await issueSupplierPO('spo-1');
      expect(ProcService.issueSupplierPO).toHaveBeenCalledWith('spo-1');

      await acknowledgeSupplierPO('spo-1');
      expect(ProcService.acknowledgeSupplierPO).toHaveBeenCalledWith('spo-1');

      await cancelSupplierPO('spo-1', 'Cancelled by vendor');
      expect(ProcService.cancelSupplierPO).toHaveBeenCalledWith('spo-1', 'Cancelled by vendor');
    });
  });
});
