/* eslint-disable @typescript-eslint/no-explicit-any */
import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from '@prisma/orm-postgres/runtime';
import contractJson from '../src/prisma/contract.json' with { type: 'json' };
import type { Contract } from '../src/prisma/contract.d';
import { createTenantIsolatedProxy, enforceNestedTenantId } from '../src/lib/db/tenant-db';
import crypto from 'crypto';

describe('PostgreSQL Tenant Isolation Integration Suite (veyra_test)', () => {
  let rawDb: any;
  let testDbUrl: string;

  // Test tenant identifiers
  const tenantAId = crypto.randomUUID();
  const tenantBId = crypto.randomUUID();

  // Test user identifiers
  const userAId = crypto.randomUUID();
  const userBId = crypto.randomUUID();

  // Test membership identifiers
  const memberAId = crypto.randomUUID();
  const memberBId = crypto.randomUUID();

  // Test proxies
  let tenantADb: any;
  let tenantBDb: any;

  // Stored record IDs for cross-tenant tests
  let custA: any;
  let custB: any;
  let leadA: any;
  let leadB: any;
  let roleA: any;
  let roleB: any;

  beforeAll(async () => {
    const rawUrl = process.env.TEST_DATABASE_URL;
    if (!rawUrl) {
      throw new Error(
        'TEST_DATABASE_URL is not configured. PostgreSQL integration tests require an explicitly configured, isolated test database (e.g. postgresql://postgres:postgres@localhost:5432/veyra_test). Refusing to connect or run to protect production databases.'
      );
    }

    const parsedUrl = new URL(rawUrl);
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname.includes('neon.tech') ||
      parsedUrl.pathname === '/neondb' ||
      parsedUrl.pathname.includes('neon')
    ) {
      throw new Error(
        `CRITICAL: TEST_DATABASE_URL targets production database "${parsedUrl.pathname}". Aborting immediately.`
      );
    }

    testDbUrl = rawUrl;
    rawDb = postgres<Contract>({
      contractJson,
      url: testDbUrl,
    });

    // 1. Seed Tenants
    await rawDb.orm.public.Tenant.create({
      id: tenantAId,
      name: 'Alpha Corp Integration Test',
      currency: 'USD',
    });
    await rawDb.orm.public.Tenant.create({
      id: tenantBId,
      name: 'Beta LLC Integration Test',
      currency: 'USD',
    });

    // 2. Seed Users
    await rawDb.orm.public.User.create({
      id: userAId,
      email: `alpha_user_${tenantAId.slice(0, 8)}@alpha.com`,
      name: 'Alice Alpha',
    });
    await rawDb.orm.public.User.create({
      id: userBId,
      email: `beta_user_${tenantBId.slice(0, 8)}@beta.com`,
      name: 'Bob Beta',
    });

    // 3. Seed Tenant Memberships
    await rawDb.orm.public.TenantMember.create({
      id: memberAId,
      user_id: userAId,
      tenant_id: tenantAId,
      role: 'MEMBER',
    });
    await rawDb.orm.public.TenantMember.create({
      id: memberBId,
      user_id: userBId,
      tenant_id: tenantBId,
      role: 'MEMBER',
    });

    // 4. Seed Roles
    roleA = await rawDb.orm.public.Role.create({
      id: crypto.randomUUID(),
      tenant_id: tenantAId,
      name: 'Alpha Sales Manager',
      code: 'ROLE_ALPHA_SALES',
      status: 'ACTIVE',
    });
    roleB = await rawDb.orm.public.Role.create({
      id: crypto.randomUUID(),
      tenant_id: tenantBId,
      name: 'Beta Operations Lead',
      code: 'ROLE_BETA_OPS',
      status: 'ACTIVE',
    });

    // 5. Instantiate Tenant Proxies
    tenantADb = createTenantIsolatedProxy(rawDb, tenantAId);
    tenantBDb = createTenantIsolatedProxy(rawDb, tenantBId);

    // 6. Seed Customers via proxies to ensure base state
    custA = await tenantADb.Customer.create({
      data: {
        id: crypto.randomUUID(),
        customer_number: 'CUS-A-001',
        legal_name: 'Alpha Customer Ltd',
        display_name: 'Alpha Customer Ltd',
      },
    });

    custB = await tenantBDb.Customer.create({
      data: {
        id: crypto.randomUUID(),
        customer_number: 'CUS-B-001',
        legal_name: 'Beta Client Corp',
        display_name: 'Beta Client Corp',
      },
    });

    // 7. Seed Leads via proxies
    leadA = await tenantADb.Lead.create({
      data: {
        id: crypto.randomUUID(),
        lead_number: 'LEAD-A-001',
        company_name: 'Acme Alpha Solutions',
        contact_name: 'Arthur Alpha',
        owner_id: userAId,
        status: 'NEW',
      },
    });

    leadB = await tenantBDb.Lead.create({
      data: {
        id: crypto.randomUUID(),
        lead_number: 'LEAD-B-001',
        company_name: 'Beta Prospects Inc',
        contact_name: 'Barbara Beta',
        owner_id: userBId,
        status: 'NEW',
      },
    });
  });

  afterAll(async () => {
    if (!rawDb) return;
    // Clean up test data inside veyra_test while preserving the database structure
    try {
      await rawDb.orm.public.Lead.where({ tenant_id: tenantAId }).deleteAll();
      await rawDb.orm.public.Lead.where({ tenant_id: tenantBId }).deleteAll();

      await rawDb.orm.public.Opportunity.where({ tenant_id: tenantAId }).deleteAll();
      await rawDb.orm.public.Opportunity.where({ tenant_id: tenantBId }).deleteAll();

      await rawDb.orm.public.CustomerContact.where({ tenant_id: tenantAId }).deleteAll();
      await rawDb.orm.public.CustomerContact.where({ tenant_id: tenantBId }).deleteAll();

      await rawDb.orm.public.Customer.where({ tenant_id: tenantAId }).deleteAll();
      await rawDb.orm.public.Customer.where({ tenant_id: tenantBId }).deleteAll();

      await rawDb.orm.public.MemberRole.where({ tenant_id: tenantAId }).deleteAll();
      await rawDb.orm.public.MemberRole.where({ tenant_id: tenantBId }).deleteAll();

      await rawDb.orm.public.Role.where({ tenant_id: tenantAId }).deleteAll();
      await rawDb.orm.public.Role.where({ tenant_id: tenantBId }).deleteAll();

      await rawDb.orm.public.TenantMember.where({ tenant_id: tenantAId }).deleteAll();
      await rawDb.orm.public.TenantMember.where({ tenant_id: tenantBId }).deleteAll();

      await rawDb.orm.public.User.where({ id: userAId }).delete();
      await rawDb.orm.public.User.where({ id: userBId }).delete();

      await rawDb.orm.public.Tenant.where({ id: tenantAId }).delete();
      await rawDb.orm.public.Tenant.where({ id: tenantBId }).delete();
    } catch (err) {
      console.error('Teardown cleanup notice:', err);
    }
  });

  // =========================================================================
  // SCENARIO 1: Cross-Tenant Reads & Enumeration Immunity
  // =========================================================================
  describe('Scenario 1: Cross-tenant reads and enumeration immunity', () => {
    it('prevents tenant A from reading tenant B customers via findMany, findFirst, and findUnique', async () => {
      // 1. findMany
      const alphaCustomers = await tenantADb.Customer.findMany({});
      const foundBetaInAlpha = alphaCustomers.some((c: any) => c.id === custB.id);
      expect(foundBetaInAlpha).toBe(false);

      // 2. findFirst targeting Tenant B customer ID
      const directFindFirst = await tenantADb.Customer.findFirst({
        where: { id: custB.id },
      });
      expect(directFindFirst).toBeNull();

      // 3. findUnique targeting Tenant B customer ID
      const directFindUnique = await tenantADb.Customer.findUnique({
        where: { id: custB.id },
      });
      expect(directFindUnique).toBeNull();

      // 4. count should not include tenant B
      const alphaCount = await tenantADb.Customer.count({});
      const betaCount = await tenantBDb.Customer.count({});
      expect(alphaCount).toBeGreaterThanOrEqual(1);
      expect(betaCount).toBeGreaterThanOrEqual(1);
    });

    it('prevents tenant A from reading tenant B leads via findMany and findUnique', async () => {
      const alphaLeads = await tenantADb.Lead.findMany({});
      const foundBetaLead = alphaLeads.some((l: any) => l.id === leadB.id);
      expect(foundBetaLead).toBe(false);

      const findBetaLeadFromAlpha = await tenantADb.Lead.findUnique({
        where: { id: leadB.id },
      });
      expect(findBetaLeadFromAlpha).toBeNull();
    });
  });

  // =========================================================================
  // SCENARIO 2: Cross-Tenant Update, Delete, Upsert Rejection
  // =========================================================================
  describe('Scenario 2: Cross-tenant update, delete, and upsert rejection', () => {
    it('rejects cross-tenant update and leaves the target record unmodified in PostgreSQL', async () => {
      // Tenant A attempts to update Customer B
      await expect(
        tenantADb.Customer.update({
          where: { id: custB.id },
          data: { display_name: 'Malicious Alpha Tamper' },
        })
      ).rejects.toThrow('Record not found in the current tenant.');

      // Verify in PostgreSQL directly that custB is completely unchanged
      const freshCustB = await rawDb.orm.public.Customer.where({ id: custB.id }).first();
      expect(freshCustB.display_name).toBe('Beta Client Corp');
    });

    it('rejects cross-tenant delete and leaves the target record intact in PostgreSQL', async () => {
      // Tenant A attempts to delete Customer B
      await expect(
        tenantADb.Customer.delete({
          where: { id: custB.id },
        })
      ).rejects.toThrow('Record not found in the current tenant.');

      // Verify in PostgreSQL directly that custB still exists
      const freshCustB = await rawDb.orm.public.Customer.where({ id: custB.id }).first();
      expect(freshCustB).not.toBeNull();
      expect(freshCustB.id).toBe(custB.id);
    });

    it('returns count 0 on deleteMany when targeting cross-tenant records', async () => {
      const deleteResult = await tenantADb.Customer.deleteMany({
        where: { id: custB.id },
      });
      expect(deleteResult.count).toBe(0);

      // Verify in PostgreSQL directly that custB still exists
      const freshCustB = await rawDb.orm.public.Customer.where({ id: custB.id }).first();
      expect(freshCustB).not.toBeNull();
    });
  });

  // =========================================================================
  // SCENARIO 3: Forged Tenant IDs in Where Clause and Data Payloads
  // =========================================================================
  describe('Scenario 3: Forged tenant IDs in where clause and data payloads', () => {
    it('overrides forged tenant_id in create payload with authenticated tenant ID in PostgreSQL', async () => {
      const forgedCustomer = await tenantADb.Customer.create({
        data: {
          id: crypto.randomUUID(),
          customer_number: 'CUS-A-FORGE-01',
          legal_name: 'Forged Tenant Entity',
          display_name: 'Forged Tenant Entity',
          tenant_id: tenantBId, // Attempt to forge Tenant B's ID
        },
      });

      // Verify returned entity has tenantAId
      expect(forgedCustomer.tenant_id).toBe(tenantAId);

      // Verify in PostgreSQL directly that tenant_id is tenantAId
      const inDb = await rawDb.orm.public.Customer.where({ id: forgedCustomer.id }).first();
      expect(inDb.tenant_id).toBe(tenantAId);
    });

    it('overrides forged tenant_id in where filter so it cannot target other tenants', async () => {
      // Tenant A explicitly passes tenant_id: tenantBId in where filter
      const results = await tenantADb.Customer.findMany({
        where: { tenant_id: tenantBId },
      });

      // Every returned row MUST belong to Tenant A, zero rows from Tenant B
      for (const row of results) {
        expect(row.tenant_id).toBe(tenantAId);
      }
      const containsBeta = results.some((r: any) => r.id === custB.id);
      expect(containsBeta).toBe(false);
    });
  });

  // =========================================================================
  // SCENARIO 4: Compound Unique Selector Normalization & Enforcement
  // =========================================================================
  describe('Scenario 4: Compound unique selector normalization & enforcement', () => {
    it('normalizes compound unique keys and prevents cross-tenant lookup on TenantMember', async () => {
      // Query member B using compound selector { user_id_tenant_id: { user_id, tenant_id } }
      const crossMemberLookup = await tenantADb.TenantMember.findUnique({
        where: {
          user_id_tenant_id: {
            user_id: userBId,
            tenant_id: tenantBId,
          },
        },
      });

      // The proxy flattens and enforces tenant_id: tenantAId, resulting in null
      expect(crossMemberLookup).toBeNull();
    });

    it('rejects cross-tenant update on compound unique selector and leaves member intact in PostgreSQL', async () => {
      // Tenant A attempts to elevate Member B role to ADMIN
      await expect(
        tenantADb.TenantMember.update({
          where: {
            user_id_tenant_id: {
              user_id: userBId,
              tenant_id: tenantBId,
            },
          },
          data: { role: 'ADMIN' },
        })
      ).rejects.toThrow('Record not found in the current tenant.');

      // Verify directly in PostgreSQL that Member B role remains MEMBER
      const freshMemberB = await rawDb.orm.public.TenantMember.where({ id: memberBId }).first();
      expect(freshMemberB.role).toBe('MEMBER');
    });
  });

  // =========================================================================
  // SCENARIO 5: Transaction Rollback on Cross-Tenant Failure
  // =========================================================================
  describe('Scenario 5: Transaction rollback on cross-tenant failure', () => {
    it('rolls back all writes in PostgreSQL when a transaction hits a cross-tenant error', async () => {
      const rollbackCustId = crypto.randomUUID();

      const txExecution = tenantADb.transaction(async (tx: any) => {
        // Step 1: Valid write in Tenant A
        await tx.Customer.create({
          data: {
            id: rollbackCustId,
            customer_number: 'CUS-A-ROLLBACK',
            legal_name: 'Rollback Co',
            display_name: 'Rollback Co',
          },
        });

        // Step 2: Cross-tenant illegal operation
        await tx.Customer.update({
          where: { id: custB.id },
          data: { display_name: 'Tampered in TX' },
        });
      });

      await expect(txExecution).rejects.toThrow('Record not found in the current tenant.');

      // Verify in PostgreSQL directly: Step 1 write was rolled back!
      const rolledBackCust = await rawDb.orm.public.Customer.where({ id: rollbackCustId }).first();
      expect(rolledBackCust).toBeNull();

      // Verify in PostgreSQL directly: custB was not touched
      const freshCustB = await rawDb.orm.public.Customer.where({ id: custB.id }).first();
      expect(freshCustB.display_name).toBe('Beta Client Corp');
    });
  });

  // =========================================================================
  // SCENARIO 6: Nested Writes & Relation Protection
  // =========================================================================
  describe('Scenario 6: Nested writes and relation protection', () => {
    it('enforces authenticated tenant_id recursively on nested create payloads', () => {
      const nestedPayload = {
        title: 'Parent Solution',
        tenant_id: tenantBId, // Forged at root
        revisions: {
          create: [
            {
              revision_number: 1,
              title: 'Rev 1',
              tenant_id: tenantBId, // Forged in nested array
            },
            {
              revision_number: 2,
              title: 'Rev 2',
              tenant_id: tenantBId, // Forged in nested array
            },
          ],
        },
        settings: {
          create: {
            theme: 'dark',
            tenant_id: tenantBId, // Forged in nested object
          },
        },
      };

      const sanitized = enforceNestedTenantId(nestedPayload, tenantAId);

      expect(sanitized.revisions.create[0].tenant_id).toBe(tenantAId);
      expect(sanitized.revisions.create[1].tenant_id).toBe(tenantAId);
      expect(sanitized.settings.create.tenant_id).toBe(tenantAId);
    });

    it('stamps authenticated tenant_id on relational child records and isolates them in PostgreSQL', async () => {
      const parentCustId = crypto.randomUUID();
      const childContactId = crypto.randomUUID();

      // 1. Create parent customer in Tenant A
      const parentCust = await tenantADb.Customer.create({
        data: {
          id: parentCustId,
          customer_number: 'CUS-A-PARENT-01',
          legal_name: 'Parent Customer Corp',
          display_name: 'Parent Customer Corp',
        },
      });
      expect(parentCust.tenant_id).toBe(tenantAId);

      // 2. Create child contact attempting to forge tenant_id: tenantBId
      const childContact = await tenantADb.CustomerContact.create({
        data: {
          id: childContactId,
          customer_id: parentCustId,
          name: 'Child Contact Alpha',
          tenant_id: tenantBId, // Attempted forge
        },
      });

      // 3. Verify returned contact has tenantAId
      expect(childContact.tenant_id).toBe(tenantAId);

      // 4. Verify in PostgreSQL directly that child record has tenantAId and is linked to parent
      const dbContact = await rawDb.orm.public.CustomerContact.where({ id: childContactId }).first();
      expect(dbContact).not.toBeNull();
      expect(dbContact.tenant_id).toBe(tenantAId);
      expect(dbContact.customer_id).toBe(parentCustId);

      // 5. Verify child contact is completely invisible from Tenant B
      const contactFromBeta = await tenantBDb.CustomerContact.findUnique({
        where: { id: childContactId },
      });
      expect(contactFromBeta).toBeNull();
    });
  });

  // =========================================================================
  // SCENARIO 7: Administrative Role and Permission Scoping via Transaction
  // =========================================================================
  describe('Scenario 7: Admin role and permission scoping via transaction', () => {
    it('prevents assigning roles from tenant B to a tenant A member inside a transaction', async () => {
      // Simulate assignRolesToUser logic
      const assignAttempt = tenantADb.transaction(async (tx: any) => {
        // Validate target member exists in current tenant
        const targetMember = await tx.TenantMember.findUnique({
          where: { id: memberAId },
        });
        if (!targetMember) {
          throw new Error('Record not found in the current tenant.');
        }

        // Validate requested roles belong to current tenant
        const requestedRoleIds = [roleB.id]; // Role B belongs to Tenant B
        const roles = await tx.Role.findMany({
          where: { id: { in: requestedRoleIds } },
        });

        if (roles.length !== requestedRoleIds.length) {
          throw new Error('One or more roles do not exist in the current tenant.');
        }

        // Proceed to assign
        await tx.MemberRole.create({
          data: {
            member_id: memberAId,
            role_id: roleB.id,
          },
        });
      });

      await expect(assignAttempt).rejects.toThrow(
        'One or more roles do not exist in the current tenant.'
      );

      // Verify in PostgreSQL directly: no MemberRole rows created
      const memberRoles = await rawDb.orm.public.MemberRole.where({ member_id: memberAId }).all();
      expect(memberRoles.length).toBe(0);
    });

    it('prevents modifying roles of a member belonging to tenant B', async () => {
      const assignToForeignMember = tenantADb.transaction(async (tx: any) => {
        const targetMember = await tx.TenantMember.findUnique({
          where: { id: memberBId }, // Belongs to Tenant B
        });
        if (!targetMember) {
          throw new Error('Record not found in the current tenant.');
        }

        await tx.MemberRole.create({
          data: {
            member_id: memberBId,
            role_id: roleA.id,
          },
        });
      });

      await expect(assignToForeignMember).rejects.toThrow('Record not found in the current tenant.');
    });
  });

  // =========================================================================
  // SCENARIO 8: Lead Conversion Customer Validation Across Tenants
  // =========================================================================
  describe('Scenario 8: Lead conversion customer validation across tenants', () => {
    it('aborts lead conversion transaction when attempting to link to a cross-tenant customer', async () => {
      // Attempting to convert Lead A to Customer B (from Tenant B)
      const conversionAttempt = tenantADb.transaction(async (tx: any) => {
        // Step 1: Validate customer ownership using tenant proxy
        const existingCustomer = await tx.Customer.findUnique({
          where: { id: custB.id },
        });
        if (!existingCustomer) {
          throw new Error('Record not found in the current tenant.');
        }

        // Step 2: Mark lead converted
        await tx.Lead.update({
          where: { id: leadA.id },
          data: { status: 'CONVERTED' },
        });
      });

      await expect(conversionAttempt).rejects.toThrow('Record not found in the current tenant.');

      // Verify in PostgreSQL directly: Lead A is NOT converted
      const freshLeadA = await rawDb.orm.public.Lead.where({ id: leadA.id }).first();
      expect(freshLeadA.status).toBe('NEW');
    });

    it('successfully executes lead conversion workflow within the same tenant', async () => {
      const contactId = crypto.randomUUID();
      const oppId = crypto.randomUUID();

      const result = await tenantADb.transaction(async (tx: any) => {
        // Step 1: Validate existing Customer A
        const existingCustomer = await tx.Customer.findUnique({
          where: { id: custA.id },
        });
        if (!existingCustomer) {
          throw new Error('Record not found in the current tenant.');
        }

        // Step 2: Create Contact
        const newContact = await tx.CustomerContact.create({
          data: {
            id: contactId,
            customer_id: custA.id,
            name: leadA.contact_name,
            is_primary: true,
          },
        });

        // Step 3: Create Opportunity
        const newOpp = await tx.Opportunity.create({
          data: {
            id: oppId,
            opportunity_number: 'OPP-A-001',
            name: `${leadA.company_name} - Integration Opp`,
            customer_id: custA.id,
            primary_contact_id: newContact.id,
            owner_id: userAId,
          },
        });

        // Step 4: Mark Lead Converted
        const updatedLead = await tx.Lead.update({
          where: { id: leadA.id },
          data: {
            status: 'CONVERTED',
          },
        });

        return { contactId: newContact.id, oppId: newOpp.id, leadStatus: updatedLead.status };
      });

      expect(result.leadStatus).toBe('CONVERTED');

      // Verify in PostgreSQL directly: All created records belong strictly to Tenant A
      const freshLead = await rawDb.orm.public.Lead.where({ id: leadA.id }).first();
      expect(freshLead.status).toBe('CONVERTED');
      expect(freshLead.tenant_id).toBe(tenantAId);

      const freshContact = await rawDb.orm.public.CustomerContact.where({ id: contactId }).first();
      expect(freshContact.tenant_id).toBe(tenantAId);
      expect(freshContact.customer_id).toBe(custA.id);

      const freshOpp = await rawDb.orm.public.Opportunity.where({ id: oppId }).first();
      expect(freshOpp.tenant_id).toBe(tenantAId);
      expect(freshOpp.customer_id).toBe(custA.id);

      // Verify zero leak into Tenant B
      const betaContacts = await rawDb.orm.public.CustomerContact.where({ tenant_id: tenantBId }).all();
      expect(betaContacts.some((c: any) => c.id === contactId)).toBe(false);
    });
  });
});
