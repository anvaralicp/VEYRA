/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";

async function getCrmDb() {
  const tdb = await getTenantDb();
  return {
    Lead: tdb.Lead || tdb.lead,
    Customer: tdb.Customer || tdb.customer,
    CustomerContact: tdb.CustomerContact || tdb.customerContact,
    Opportunity: tdb.Opportunity || tdb.opportunity,
    tdb
  };
}

export async function getLeads(query?: string) {
  await requirePermission("lead.view");
  const { Lead } = await getCrmDb();

  if (query) {
    return Lead.findMany({
      where: {
        OR: [
          { lead_number: { contains: query, mode: "insensitive" } },
          { company_name: { contains: query, mode: "insensitive" } },
          { contact_name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } }
        ]
      },
      orderBy: { created_at: 'desc' }
    });
  }
  return Lead.findMany({ orderBy: { created_at: 'desc' } });
}

export async function getLeadById(id: string) {
  await requirePermission("lead.view");
  const { Lead } = await getCrmDb();
  return Lead.findUnique({ where: { id } });
}

export async function createLead(data: any) {
  await requirePermission("lead.create");
  const { Lead, tdb } = await getCrmDb();
  const context = await getTenantContext();

  // Validate owner belongs to tenant
  const member = await (tdb as any).TenantMember.findUnique({
    where: { user_id_tenant_id: { user_id: data.owner_id, tenant_id: context.tenantId } }
  });
  if (!member) throw new Error("Owner must belong to the current tenant");

  const count = await Lead.count();
  const leadNumber = `LEAD-${String(count + 1).padStart(6, '0')}`;

  const lead = await Lead.create({
    data: {
      lead_number: leadNumber,
      company_name: data.company_name,
      contact_name: data.contact_name,
      email: data.email,
      phone: data.phone,
      website: data.website,
      source: data.source || "OTHER",
      industry: data.industry,
      requirement: data.requirement,
      estimated_value: data.estimated_value ? parseFloat(data.estimated_value) : null,
      currency: data.currency || "USD",
      owner_id: data.owner_id,
      status: data.status || "NEW",
      expected_close_date: data.expected_close_date ? new Date(data.expected_close_date) : null,
      notes: data.notes,
      created_by: context.userId
    }
  });

  await logAudit("LEAD_CREATE", "Lead", lead.id, { number: lead.lead_number });
  return lead;
}

export async function updateLead(id: string, data: any) {
  await requirePermission("lead.update");
  const { Lead, tdb } = await getCrmDb();
  const context = await getTenantContext();

  if (data.owner_id) {
    const member = await (tdb as any).TenantMember.findUnique({
      where: { user_id_tenant_id: { user_id: data.owner_id, tenant_id: context.tenantId } }
    });
    if (!member) throw new Error("Owner must belong to the current tenant");
  }

  const lead = await Lead.update({
    where: { id },
    data: {
      company_name: data.company_name,
      contact_name: data.contact_name,
      email: data.email,
      phone: data.phone,
      website: data.website,
      source: data.source,
      industry: data.industry,
      requirement: data.requirement,
      estimated_value: data.estimated_value ? parseFloat(data.estimated_value) : null,
      currency: data.currency,
      owner_id: data.owner_id,
      status: data.status,
      qualification: data.qualification,
      expected_close_date: data.expected_close_date ? new Date(data.expected_close_date) : null,
      notes: data.notes,
      updated_by: context.userId
    }
  });

  await logAudit("LEAD_UPDATE", "Lead", id, null);
  return lead;
}

export async function convertLead(
  id: string,
  options: {
    create_customer: boolean;
    customer_id?: string;
    opportunity_name?: string;
    estimated_value?: number;
    expected_close_date?: Date | string | null;
  }
) {
  await requirePermission("lead.convert");
  const context = await getTenantContext();
  const { Lead } = await getCrmDb();

  const lead = await Lead.findUnique({ where: { id } });
  if (!lead) throw new Error("Lead not found");
  if (lead.status === "CONVERTED") throw new Error("Lead is already converted");

  // Tenant-scoped transaction
  const tenantDb = await getTenantDb();
  const result = await tenantDb.transaction(async (tx: any) => {
    // 1. Resolve or Create Customer
    let customerId = options.customer_id;
    let customerNum = "";
    if (options.create_customer) {
      const cCount = await (tx.Customer || tx.customer).count();
      customerNum = `CUS-${String(cCount + 1).padStart(6, '0')}`;
      const newCustomer = await (tx.Customer || tx.customer).create({
        data: {
          customer_number: customerNum,
          legal_name: lead.company_name,
          display_name: lead.company_name,
          email: lead.email,
          phone: lead.phone,
          website: lead.website,
          industry: lead.industry,
          account_manager_id: lead.owner_id,
          created_by: context.userId
        }
      });
      customerId = newCustomer.id;
    } else if (customerId) {
      // Validate customer ownership using the authenticated tenant context
      const existingCustomer = await (tx.Customer || tx.customer).findUnique({
        where: { id: customerId }
      });
      if (!existingCustomer) {
        throw new Error("Record not found in the current tenant.");
      }
    } else {
      throw new Error("Must provide customer_id or create_customer=true");
    }

    // 2. Create Contact
    const newContact = await (tx.CustomerContact || tx.customerContact).create({
      data: {
        customer_id: customerId,
        name: lead.contact_name,
        email: lead.email,
        phone: lead.phone,
        is_primary: true,
        created_by: context.userId
      }
    });

    // 3. Create Opportunity
    const oCount = await (tx.Opportunity || tx.opportunity).count();
    const oppNum = `OPP-${String(oCount + 1).padStart(6, '0')}`;
    const oppName = options.opportunity_name?.trim() || `${lead.company_name} - ${lead.requirement || 'New Opportunity'}`;
    const oppValue = options.estimated_value !== undefined ? options.estimated_value : lead.estimated_value;
    const oppCloseDate = options.expected_close_date !== undefined
      ? (options.expected_close_date ? new Date(options.expected_close_date) : null)
      : lead.expected_close_date;

    const newOpportunity = await (tx.Opportunity || tx.opportunity).create({
      data: {
        opportunity_number: oppNum,
        name: oppName,
        customer_id: customerId,
        primary_contact_id: newContact.id,
        owner_id: lead.owner_id,
        source: lead.source,
        description: lead.notes,
        estimated_value: oppValue,
        currency: lead.currency,
        expected_close_date: oppCloseDate,
        created_by: context.userId
      }
    });

    // 4. Mark Lead Converted
    await (tx.Lead || tx.lead).update({
      where: { id },
      data: {
        status: "CONVERTED",
        converted_at: new Date(),
        converted_by: context.userId
      }
    });

    return { customerId, opportunityId: newOpportunity.id };
  });

  await logAudit("LEAD_CONVERT", "Lead", id, { opportunity_id: result.opportunityId });
  return result;
}
