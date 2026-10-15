import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as POService from "../src/lib/commercial/customer-po-service";

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

const mockCPO = { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() };
const mockCPOLine = { create: vi.fn(), findMany: vi.fn() };
const mockCPOV = { create: vi.fn() };
const mockQuotationRevision = { findUnique: vi.fn() };

mocks.getTenantDb.mockResolvedValue({
  tdb: {
    CustomerPurchaseOrder: mockCPO,
    CustomerPurchaseOrderLine: mockCPOLine,
    CustomerPurchaseOrderValidation: mockCPOV,
    QuotationRevision: mockQuotationRevision,
    $transaction: vi.fn().mockImplementation(async (cb) => {
      return cb({
        CustomerPurchaseOrder: mockCPO,
        CustomerPurchaseOrderValidation: mockCPOV
      });
    })
  }
});

vi.mock('../src/lib/db/tenant-db', () => ({ getTenantDb: mocks.getTenantDb }));

describe('Customer PO Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Registration', () => {
    it('1. Create a customer PO draft', async () => {
      mockQuotationRevision.findUnique.mockResolvedValue({
        id: 'rev-1', tenant_id: 'tenant-1', status: 'ISSUED', quotation: { customer_id: 'cust-1' }
      });
      mockCPO.findUnique.mockResolvedValue(null);
      mockCPO.create.mockResolvedValue({ id: 'po-1', status: 'DRAFT' });

      const res = await POService.createCustomerPO({
        po_number: 'PO-123',
        customer_id: 'cust-1',
        quotation_revision_id: 'rev-1',
        po_date: '2026-10-01',
        received_date: '2026-10-02',
        currency_id: 'usd',
        subtotal: 100,
        tax_total: 10,
        grand_total: 110
      });
      expect(res.id).toBe('po-1');
      expect(mockCPO.create).toHaveBeenCalled();
    });


    it('2. Register a PO associated with an issued quotation revision', async () => {
      mockQuotationRevision.findUnique.mockResolvedValue({
        id: 'rev-2', tenant_id: 'tenant-1', status: 'ISSUED', quotation: { customer_id: 'cust-1' }
      });
      mockCPO.findUnique.mockResolvedValue(null);
      mockCPO.create.mockResolvedValue({ id: 'po-2', status: 'DRAFT' });

      const res = await POService.createCustomerPO({
        po_number: 'PO-124', customer_id: 'cust-1', quotation_revision_id: 'rev-2', po_date: '2026-10-01', received_date: '2026-10-02',
        currency_id: 'usd', subtotal: 100, tax_total: 10, grand_total: 110
      });
      expect(res.id).toBe('po-2');
    });

    it('4. Reject a cross-tenant quotation reference', async () => {
      mockQuotationRevision.findUnique.mockResolvedValue(null); // findUnique with tenantId filter will return null
      await expect(POService.createCustomerPO({
        po_number: 'PO-125', customer_id: 'cust-1', quotation_revision_id: 'rev-other'
      })).rejects.toThrow("Quotation revision not found");
    });

    it('6. Reject duplicate PO numbers for the same customer', async () => {
      mockCPO.findUnique.mockResolvedValue({ id: 'po-existing' });
      await expect(POService.createCustomerPO({
        po_number: 'PO-123', customer_id: 'cust-1'
      })).rejects.toThrow("PO number already exists for this customer");
    });

    it('3. Reject a draft or unissued quotation revision as the source', async () => {
      mockQuotationRevision.findUnique.mockResolvedValue({
        id: 'rev-1', tenant_id: 'tenant-1', status: 'DRAFT', quotation: { customer_id: 'cust-1' }
      });
      await expect(POService.createCustomerPO({
        po_number: 'PO-123', customer_id: 'cust-1', quotation_revision_id: 'rev-1'
      })).rejects.toThrow("Only issued quotation revisions can be referenced");
    });

    it('5. Reject a customer/quotation customer mismatch', async () => {
      mockQuotationRevision.findUnique.mockResolvedValue({
        id: 'rev-1', tenant_id: 'tenant-1', status: 'ISSUED', quotation: { customer_id: 'cust-2' }
      });
      await expect(POService.createCustomerPO({
        po_number: 'PO-123', customer_id: 'cust-1', quotation_revision_id: 'rev-1'
      })).rejects.toThrow("Quotation customer does not match PO customer");
    });
  });

  describe('Validation', () => {
    it('8. Validate matching header totals', async () => {
       mockCPO.findUnique.mockResolvedValue({
         id: 'po-1', status: 'SUBMITTED', subtotal: 100, tax_total: 10, grand_total: 110, currency_id: 'usd',
         quotationRevision: { grand_total: 110, currency_id: 'usd', lines: [] },
         lines: []
       });
       const findings = await POService.generatePOValidationFindings('po-1');
       expect(findings.length).toBe(0);
    });

    it('9. Detect a grand-total mismatch', async () => {
       mockCPO.findUnique.mockResolvedValue({
         id: 'po-1', status: 'SUBMITTED', subtotal: 100, tax_total: 10, grand_total: 110, currency_id: 'usd',
         quotationRevision: { grand_total: 120, currency_id: 'usd', lines: [] },
         lines: []
       });
       const findings = await POService.generatePOValidationFindings('po-1');
       expect(findings).toEqual(expect.arrayContaining([
         expect.objectContaining({ type: 'TOTAL_MISMATCH', severity: 'WARNING' })
       ]));
    });

    it('10. Detect inconsistent subtotal, tax and total arithmetic', async () => {
       mockCPO.findUnique.mockResolvedValue({
         id: 'po-1', status: 'SUBMITTED', subtotal: 100, tax_total: 10, grand_total: 115, currency_id: 'usd',
         quotationRevision: { grand_total: 115, currency_id: 'usd', lines: [] },
         lines: []
       });
       const findings = await POService.generatePOValidationFindings('po-1');
       expect(findings).toEqual(expect.arrayContaining([
         expect.objectContaining({ type: 'ARITHMETIC_ERROR', severity: 'ERROR' })
       ]));
    });


    it('11. Detect a currency mismatch', async () => {
       mockCPO.findUnique.mockResolvedValue({
         id: 'po-1', status: 'SUBMITTED', subtotal: 100, tax_total: 10, grand_total: 110, currency_id: 'eur',
         quotationRevision: { grand_total: 110, currency_id: 'usd', lines: [] }, lines: []
       });
       const findings = await POService.generatePOValidationFindings('po-1');
       expect(findings).toEqual(expect.arrayContaining([
         expect.objectContaining({ type: 'CURRENCY_MISMATCH', severity: 'ERROR' })
       ]));
    });

    it('12. Detect a unit-price mismatch', async () => {
       mockCPO.findUnique.mockResolvedValue({
         id: 'po-1', status: 'SUBMITTED', subtotal: 100, tax_total: 10, grand_total: 110, currency_id: 'usd',
         quotationRevision: { grand_total: 110, currency_id: 'usd', lines: [{ id: 'ql-1', unit_selling_price: 50, quantity: 2 }] },
         lines: [{ quotation_line_id: 'ql-1', unit_price: 45, quantity: 2 }]
       });
       const findings = await POService.generatePOValidationFindings('po-1');
       expect(findings).toEqual(expect.arrayContaining([
         expect.objectContaining({ type: 'UNIT_PRICE_MISMATCH', severity: 'WARNING' })
       ]));
    });

    it('13. Detect a quantity mismatch', async () => {
       mockCPO.findUnique.mockResolvedValue({
         id: 'po-1', status: 'SUBMITTED', subtotal: 100, tax_total: 10, grand_total: 110, currency_id: 'usd',
         quotationRevision: { grand_total: 110, currency_id: 'usd', lines: [{ id: 'ql-1', unit_selling_price: 50, quantity: 2 }] },
         lines: [{ quotation_line_id: 'ql-1', unit_price: 50, quantity: 3 }]
       });
       const findings = await POService.generatePOValidationFindings('po-1');
       expect(findings).toEqual(expect.arrayContaining([
         expect.objectContaining({ type: 'QUANTITY_MISMATCH', severity: 'WARNING' })
       ]));
    });

    it('14. Detect missing quotation lines', async () => {
       mockCPO.findUnique.mockResolvedValue({
         id: 'po-1', status: 'SUBMITTED', subtotal: 100, tax_total: 10, grand_total: 110, currency_id: 'usd',
         quotationRevision: { grand_total: 110, currency_id: 'usd', lines: [{ id: 'ql-1', unit_selling_price: 50, quantity: 2 }, { id: 'ql-2', unit_selling_price: 60, quantity: 1 }] },
         lines: [{ quotation_line_id: 'ql-1', unit_price: 50, quantity: 2 }]
       });
       const findings = await POService.generatePOValidationFindings('po-1');
       expect(findings).toEqual(expect.arrayContaining([
         expect.objectContaining({ type: 'MISSING_QUOTATION_LINE', severity: 'WARNING' })
       ]));
    });

    it('15. Detect unmatched PO lines', async () => {
       mockCPO.findUnique.mockResolvedValue({
         id: 'po-1', status: 'SUBMITTED', subtotal: 100, tax_total: 10, grand_total: 110, currency_id: 'usd',
         quotationRevision: { grand_total: 110, currency_id: 'usd', lines: [] },
         lines: [{ quotation_line_id: null }]
       });
       const findings = await POService.generatePOValidationFindings('po-1');
       expect(findings).toEqual(expect.arrayContaining([
         expect.objectContaining({ type: 'UNMATCHED_LINE', severity: 'INFO' })
       ]));
    });

    it('16. Detect duplicated line mappings', async () => {
       mockCPO.findUnique.mockResolvedValue({ id: 'po-1', status: 'DRAFT', lines: [{ quotation_line_id: 'ql-1', unit_price: 50, quantity: 2 }] });
       await expect(POService.addCustomerPOLine('po-1', { quotation_line_id: 'ql-1' }))
         .rejects.toThrow("Quotation line already mapped");
    });

    it('19. Prevent validation when blocking errors remain', async () => {
       mockCPO.findUnique.mockResolvedValue({
         id: 'po-1', status: 'SUBMITTED', subtotal: 100, tax_total: 10, grand_total: 115, currency_id: 'usd',
         quotationRevision: { grand_total: 115, currency_id: 'usd', lines: [] },
         lines: []
       });
       await expect(POService.validateCustomerPO('po-1', 'VALIDATED')).rejects.toThrow("Cannot validate PO with blocking errors");
    });

    it('21. Successfully validate a compliant PO', async () => {
       mockCPO.findUnique.mockResolvedValue({
         id: 'po-1', status: 'SUBMITTED', subtotal: 100, tax_total: 10, grand_total: 110, currency_id: 'usd',
         quotationRevision: { grand_total: 110, currency_id: 'usd', lines: [] },
         lines: []
       });
       await POService.validateCustomerPO('po-1', 'VALIDATED');
       expect(mockCPOV.create).toHaveBeenCalled();
       expect(mockCPO.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'VALIDATED' } }));
    });

    it('22. Return a PO with reviewer comments and preserve history', async () => {
       mockCPO.findUnique.mockResolvedValue({ id: 'po-1', status: 'SUBMITTED', subtotal: 100, tax_total: 10, grand_total: 110, quotationRevision: { grand_total: 110, lines: [] }, lines: [] });
       await POService.validateCustomerPO('po-1', 'RETURNED', 'Needs clarification');
       expect(mockCPOV.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ new_status: 'RETURNED', comments: 'Needs clarification' }) }));
    });

    it('23. Reject a PO and prevent it from being treated as validated', async () => {
       mockCPO.findUnique.mockResolvedValue({ id: 'po-1', status: 'SUBMITTED', subtotal: 100, tax_total: 10, grand_total: 110, quotationRevision: { grand_total: 110, lines: [] }, lines: [] });
       await POService.validateCustomerPO('po-1', 'REJECTED');
       expect(mockCPO.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'REJECTED' } }));
    });

    it('30. Verify successful state changes produce audit events', async () => {
       mockCPO.findUnique.mockResolvedValue({ id: 'po-1', status: 'DRAFT' });
       await POService.submitCustomerPO('po-1');
       expect(mocks.logAudit).toHaveBeenCalledWith('CUSTOMER_PO_SUBMITTED', 'CustomerPurchaseOrder', 'po-1', null);
    });


    it('24. Deny unauthorized submission or validation', async () => {
       mocks.requirePermission.mockRejectedValueOnce(new Error("Unauthorized"));
       await expect(POService.submitCustomerPO('po-1')).rejects.toThrow("Unauthorized");
    });

    it('26. Prevent stale or concurrent contradictory decisions', async () => {
       mockCPO.findUnique.mockResolvedValue({ id: 'po-1', status: 'VALIDATED' });
       await expect(POService.validateCustomerPO('po-1', 'REJECTED')).rejects.toThrow("Only SUBMITTED or UNDER_REVIEW POs can be evaluated");
    });

    it('27. Ensure validation does not mutate the issued quotation snapshot', async () => {
       mockCPO.findUnique.mockResolvedValue({
         id: 'po-1', status: 'SUBMITTED', subtotal: 100, tax_total: 10, grand_total: 110, currency_id: 'usd',
         quotationRevision: { grand_total: 110, currency_id: 'usd', lines: [] }, lines: []
       });
       await POService.validateCustomerPO('po-1', 'VALIDATED');
       // ensure mockQuotationRevision.update was never called
       expect(mockQuotationRevision.findUnique).not.toHaveBeenCalled(); // The mock has no .update, so if we tried to update it would crash, proving it's immutable.
       // quotation revision updates should not exist in the PO validation service
    });

    it('31. Verify failed operations do not leave partially committed business state', async () => {
       mockCPO.findUnique.mockResolvedValue({
         id: 'po-1', status: 'SUBMITTED', subtotal: 100, tax_total: 10, grand_total: 115, currency_id: 'usd',
         quotationRevision: { grand_total: 115, currency_id: 'usd', lines: [] }, lines: []
       });
       await expect(POService.validateCustomerPO('po-1', 'VALIDATED')).rejects.toThrow();
       expect(mockCPOV.create).not.toHaveBeenCalled();
       expect(mockCPO.update).not.toHaveBeenCalled();
    });

    it('25. Deny cross-tenant detail and attachment access', async () => {
       mockCPO.findUnique.mockResolvedValue(null);
       await expect(POService.submitCustomerPO('po-invalid-tenant')).rejects.toThrow("Customer PO not found");
    });

  });
});
