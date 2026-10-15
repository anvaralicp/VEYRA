/* eslint-disable @typescript-eslint/no-explicit-any */
import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from '@prisma/orm-postgres/runtime';
import contractJson from '../src/prisma/contract.json' with { type: 'json' };
import type { Contract } from '../src/prisma/contract.d';
import { createTenantIsolatedProxy } from '../src/lib/db/tenant-db';
import crypto from 'crypto';

describe('Real PostgreSQL Integration Suite: Customer PO & Fulfilment Order (veyra_test)', () => {
  let rawDb: any;
  let testDbUrl: string;

  // Tenant IDs
  const tenantAId = crypto.randomUUID();
  const tenantBId = crypto.randomUUID();

  // User IDs
  const userAId = crypto.randomUUID();
  const userBId = crypto.randomUUID();

  // Customer IDs
  const customerAId = crypto.randomUUID();
  const customerBId = crypto.randomUUID();

  // Currency ID
  const currencyId = crypto.randomUUID();

  // Proxies
  let tenantADb: any;
  let tenantBDb: any;

  // Track created entities for thorough cleanup
  const poIds: string[] = [];
  const foIds: string[] = [];

  beforeAll(async () => {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) throw new Error('DATABASE_URL is not set.');

    const parsedUrl = new URL(rawUrl);
    parsedUrl.pathname = '/veyra_test';

    // Strict guard: ensure we are ONLY hitting veyra_test
    if (parsedUrl.pathname !== '/veyra_test') {
      throw new Error(`CRITICAL: Aborting because target is ${parsedUrl.pathname}, not /veyra_test`);
    }

    testDbUrl = parsedUrl.toString();
    rawDb = postgres<Contract>({
      contractJson,
      url: testDbUrl,
    });

    // 1. Seed Tenants
    await rawDb.orm.public.Tenant.create({
      id: tenantAId,
      name: 'PO Tenant A Integration Test',
      currency: 'USD',
    });
    await rawDb.orm.public.Tenant.create({
      id: tenantBId,
      name: 'PO Tenant B Integration Test',
      currency: 'USD',
    });

    // 2. Seed Users
    await rawDb.orm.public.User.create({
      id: userAId,
      email: `po-user-a-${tenantAId}@integration.local`,
      name: 'PO User A',
      password_hash: '$2a$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      status: 'ACTIVE',
    });
    await rawDb.orm.public.User.create({
      id: userBId,
      email: `po-user-b-${tenantBId}@integration.local`,
      name: 'PO User B',
      password_hash: '$2a$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      status: 'ACTIVE',
    });

    // 3. Seed Currency
    await rawDb.orm.public.Currency.create({
      id: currencyId,
      tenant_id: tenantAId,
      code: `USD-${tenantAId.slice(0, 4)}`,
      name: 'US Dollar',
      symbol: '$',
      decimal_places: 2,
    });

    // 4. Seed Customers
    await rawDb.orm.public.Customer.create({
      id: customerAId,
      tenant_id: tenantAId,
      customer_number: `CUST-A-${tenantAId.slice(0, 4)}`,
      legal_name: 'Customer Alpha Corp Legal',
      display_name: 'Customer Alpha Corp',
    });
    await rawDb.orm.public.Customer.create({
      id: customerBId,
      tenant_id: tenantBId,
      customer_number: `CUST-B-${tenantBId.slice(0, 4)}`,
      legal_name: 'Customer Beta Corp Legal',
      display_name: 'Customer Beta Corp',
    });

    // 5. Wrap Proxies
    tenantADb = createTenantIsolatedProxy(rawDb, tenantAId);
    tenantBDb = createTenantIsolatedProxy(rawDb, tenantBId);
  });

  afterAll(async () => {
    // 1. Clean up Fulfilment Orders
    for (const fid of foIds) {
      try {
        await rawDb.orm.public.FulfilmentOrderStatusHistory.where({ fulfilment_order_id: fid }).deleteAll();
        await rawDb.orm.public.FulfilmentOrderLine.where({ fulfilment_order_id: fid }).deleteAll();
        await rawDb.orm.public.FulfilmentOrder.where({ id: fid }).delete();
      } catch {
        // ignore
      }
    }

    // 2. Clean up Customer POs
    for (const pid of poIds) {
      try {
        await rawDb.orm.public.CustomerPurchaseOrderValidation.where({ customer_purchase_order_id: pid }).deleteAll();
        await rawDb.orm.public.CustomerPurchaseOrderLine.where({ customer_purchase_order_id: pid }).deleteAll();
        await rawDb.orm.public.CustomerPurchaseOrder.where({ id: pid }).delete();
      } catch {
        // ignore
      }
    }

    // 3. Clean up Customers & Currency
    try {
      await rawDb.orm.public.Customer.where({ id: customerAId }).delete();
      await rawDb.orm.public.Customer.where({ id: customerBId }).delete();
      await rawDb.orm.public.Currency.where({ id: currencyId }).delete();
    } catch {
      // ignore
    }

    // 4. Clean up Users & Tenants
    try {
      await rawDb.orm.public.User.where({ id: userAId }).delete();
      await rawDb.orm.public.User.where({ id: userBId }).delete();
      await rawDb.orm.public.Tenant.where({ id: tenantAId }).delete();
      await rawDb.orm.public.Tenant.where({ id: tenantBId }).delete();
    } catch {
      // ignore
    }
  });

  describe('1. Customer Purchase Order Creation in PostgreSQL', () => {
    it('creates customer PO with line items transactionally under Tenant A', async () => {
      const poId = crypto.randomUUID();
      poIds.push(poId);

      const po = await tenantADb.CustomerPurchaseOrder.create({
        data: {
          id: poId,
          tenant_id: tenantAId,
          po_number: 'PO-REAL-001',
          customer_id: customerAId,
          currency_id: currencyId,
          po_date: new Date('2026-10-01'),
          received_date: new Date('2026-10-02'),
          subtotal: 1000,
          tax_total: 100,
          grand_total: 1100,
          status: 'DRAFT',
          registered_by: userAId,
          registered_at: new Date(),
        },
      });

      expect(po.id).toBe(poId);
      expect(po.status).toBe('DRAFT');

      // Add line items
      const line1 = await tenantADb.CustomerPurchaseOrderLine.create({
        data: {
          id: crypto.randomUUID(),
          tenant_id: tenantAId,
          customer_purchase_order_id: poId,
          line_number: 1,
          customer_item_code: 'SRV-01',
          customer_item_description: 'Network Installation Service',
          quantity: 10,
          unit_of_measure: 'HR',
          unit_price: 100,
          tax_rate: 10,
          tax_amount: 100,
          line_total: 1100,
        },
      });

      expect(line1.customer_purchase_order_id).toBe(poId);

      // Verify records directly in raw PostgreSQL
      const dbPo = await rawDb.orm.public.CustomerPurchaseOrder.where({ id: poId }).first();
      expect(dbPo).not.toBeNull();
      expect(dbPo.tenant_id).toBe(tenantAId);
      expect(dbPo.po_number).toBe('PO-REAL-001');

      const dbLines = await rawDb.orm.public.CustomerPurchaseOrderLine.where({ customer_purchase_order_id: poId }).all();
      expect(dbLines.length).toBe(1);
      expect(dbLines[0].tenant_id).toBe(tenantAId);
    });

    it('enforces compound unique constraint [tenant_id, customer_id, po_number] in PostgreSQL', async () => {
      // Attempt to create another PO with same PO number for same customer under Tenant A
      const dupPoId = crypto.randomUUID();
      await expect(
        tenantADb.CustomerPurchaseOrder.create({
          data: {
            id: dupPoId,
            tenant_id: tenantAId,
            po_number: 'PO-REAL-001', // duplicate!
            customer_id: customerAId,
            currency_id: currencyId,
            po_date: new Date('2026-10-01'),
            received_date: new Date('2026-10-02'),
            subtotal: 500,
            tax_total: 50,
            grand_total: 550,
            status: 'DRAFT',
          },
        })
      ).rejects.toThrow();

      // But inserting the same po_number under Tenant B for Customer B succeeds!
      const tenantBPoId = crypto.randomUUID();
      poIds.push(tenantBPoId);

      const poB = await tenantBDb.CustomerPurchaseOrder.create({
        data: {
          id: tenantBPoId,
          tenant_id: tenantBId,
          po_number: 'PO-REAL-001', // Same number, different tenant & customer
          customer_id: customerBId,
          currency_id: currencyId,
          po_date: new Date('2026-10-01'),
          received_date: new Date('2026-10-02'),
          subtotal: 500,
          tax_total: 50,
          grand_total: 550,
          status: 'DRAFT',
        },
      });

      expect(poB.id).toBe(tenantBPoId);
    });
  });

  describe('2. PostgreSQL Status Progression & Validation History', () => {
    it('transitions Customer PO from DRAFT to SUBMITTED to VALIDATED with review audit record', async () => {
      const poId = poIds[0];

      // 1. Submit
      await tenantADb.CustomerPurchaseOrder.update({
        where: { id: poId },
        data: { status: 'SUBMITTED', submitted_by: userAId, submitted_at: new Date() },
      });

      const submittedPo = await tenantADb.CustomerPurchaseOrder.findUnique({ where: { id: poId } });
      expect(submittedPo.status).toBe('SUBMITTED');

      // 2. Validate inside a transaction with validation record
      const validRecordId = crypto.randomUUID();
      await tenantADb.$transaction(async (tx: any) => {
        await tx.CustomerPurchaseOrderValidation.create({
          data: {
            id: validRecordId,
            tenant_id: tenantAId,
            customer_purchase_order_id: poId,
            previous_status: 'SUBMITTED',
            new_status: 'VALIDATED',
            comments: 'Staging verification approved',
            findings: [],
            reviewer_id: userAId,
          },
        });

        await tx.CustomerPurchaseOrder.update({
          where: { id: poId },
          data: { status: 'VALIDATED' },
        });
      });

      const validatedPo = await tenantADb.CustomerPurchaseOrder.findUnique({ where: { id: poId } });
      expect(validatedPo.status).toBe('VALIDATED');

      const valRecord = await tenantADb.CustomerPurchaseOrderValidation.findUnique({ where: { id: validRecordId } });
      expect(valRecord.new_status).toBe('VALIDATED');
      expect(valRecord.comments).toBe('Staging verification approved');
    });
  });

  describe('3. PostgreSQL Fulfilment Order Creation & 1-to-1 Enforcement', () => {
    it('creates FulfilmentOrder from validated Customer PO in PostgreSQL', async () => {
      const poId = poIds[0];
      const foId = crypto.randomUUID();
      foIds.push(foId);

      const orderNumber = `FO-TEST-${Date.now()}`;

      await tenantADb.$transaction(async (tx: any) => {
        const order = await tx.FulfilmentOrder.create({
          data: {
            id: foId,
            tenant_id: tenantAId,
            order_number: orderNumber,
            customer_purchase_order_id: poId,
            customer_id: customerAId,
            status: 'OPEN',
            created_by: userAId,
            updated_by: userAId,
          },
        });

        await tx.FulfilmentOrderLine.create({
          data: {
            id: crypto.randomUUID(),
            tenant_id: tenantAId,
            fulfilment_order_id: foId,
            item_code_snapshot: 'SRV-01',
            item_description_snapshot: 'Network Installation Service',
            unit_of_measure: 'HR',
            accepted_quantity: 10,
            planned_quantity: 10,
          },
        });

        await tx.FulfilmentOrderStatusHistory.create({
          data: {
            id: crypto.randomUUID(),
            tenant_id: tenantAId,
            fulfilment_order_id: foId,
            previous_status: 'NONE',
            new_status: 'OPEN',
            actor_id: userAId,
            reason: 'Created from Customer PO',
          },
        });

        return order;
      });

      // Verify FulfilmentOrder exists in PostgreSQL
      const dbFO = await rawDb.orm.public.FulfilmentOrder.where({ id: foId }).first();
      expect(dbFO).not.toBeNull();
      expect(dbFO.customer_purchase_order_id).toBe(poId);
      expect(dbFO.status).toBe('OPEN');

      // Verify FulfilmentOrderLine exists
      const dbFOLines = await rawDb.orm.public.FulfilmentOrderLine.where({ fulfilment_order_id: foId }).all();
      expect(dbFOLines.length).toBe(1);
      expect(Number(dbFOLines[0].accepted_quantity)).toBe(10);
    });

    it('enforces 1-to-1 uniqueness on customer_purchase_order_id in PostgreSQL', async () => {
      const poId = poIds[0];
      const duplicateFoId = crypto.randomUUID();

      // Attempting to create a second FulfilmentOrder referencing the same Customer PO must fail!
      await expect(
        tenantADb.FulfilmentOrder.create({
          data: {
            id: duplicateFoId,
            tenant_id: tenantAId,
            order_number: `FO-DUP-${Date.now()}`,
            customer_purchase_order_id: poId, // duplicate relation!
            customer_id: customerAId,
            status: 'OPEN',
            created_by: userAId,
            updated_by: userAId,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('4. PostgreSQL Cross-Tenant Data Isolation', () => {
    it('prevents Tenant B from viewing or mutating Tenant A Customer PO', async () => {
      const poAId = poIds[0];

      // Tenant B query for Tenant A's PO should return null
      const crossPo = await tenantBDb.CustomerPurchaseOrder.findUnique({ where: { id: poAId } });
      expect(crossPo).toBeNull();

      // Tenant B attempt to update Tenant A's PO must be rejected by tenant-isolation proxy
      await expect(
        tenantBDb.CustomerPurchaseOrder.update({
          where: { id: poAId },
          data: { notes: 'Hacked by Tenant B' },
        })
      ).rejects.toThrow('Record not found in the current tenant.');

      // Verify Tenant A's record remains pristine in PostgreSQL
      const originalPo = await rawDb.orm.public.CustomerPurchaseOrder.where({ id: poAId }).first();
      expect(originalPo.notes).not.toBe('Hacked by Tenant B');
    });

    it('prevents Tenant B from viewing Tenant A Fulfilment Order', async () => {
      const foAId = foIds[0];

      const crossFO = await tenantBDb.FulfilmentOrder.findUnique({ where: { id: foAId } });
      expect(crossFO).toBeNull();
    });
  });
});
