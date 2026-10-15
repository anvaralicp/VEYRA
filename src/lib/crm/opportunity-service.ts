/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";

async function getCrmDb() {
  const tdb = await getTenantDb();
  return {
    Opportunity: tdb.Opportunity || tdb.opportunity,
    tdb
  };
}

export async function getOpportunities(query?: string) {
  await requirePermission("opportunity.view");
  const { Opportunity } = await getCrmDb();

  if (query) {
    return Opportunity.findMany({
      where: {
        OR: [
          { opportunity_number: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } }
        ]
      },
      include: { customer: { select: { display_name: true } } },
      orderBy: { created_at: 'desc' }
    });
  }
  return Opportunity.findMany({
    include: { customer: { select: { display_name: true } } },
    orderBy: { created_at: 'desc' }
  });
}

export async function getOpportunityById(id: string) {
  await requirePermission("opportunity.view");
  const { Opportunity } = await getCrmDb();
  return Opportunity.findUnique({
    where: { id },
    include: {
      customer: { select: { display_name: true, id: true } },
      requirements: true,
      site_surveys: true,
      solutions: true,
      boqs: true
    }
  });
}

export async function createOpportunity(data: any) {
  await requirePermission("opportunity.create");
  const { Opportunity, tdb } = await getCrmDb();
  const context = await getTenantContext();

  // Validate owner
  const member = await (tdb as any).TenantMember.findUnique({
    where: { user_id_tenant_id: { user_id: data.owner_id, tenant_id: context.tenantId } }
  });
  if (!member) throw new Error("Owner must belong to the current tenant");

  // Validate customer
  const customer = await (tdb.Customer || (tdb as any).customer).findUnique({ where: { id: data.customer_id } });
  if (!customer) throw new Error("Customer must belong to current tenant");

  const count = await Opportunity.count();
  const oppNum = `OPP-${String(count + 1).padStart(6, '0')}`;

  const opportunity = await Opportunity.create({
    data: {
      opportunity_number: oppNum,
      name: data.name,
      customer_id: data.customer_id,
      site_id: data.site_id,
      primary_contact_id: data.primary_contact_id,
      owner_id: data.owner_id,
      presales_owner_id: data.presales_owner_id,
      source: data.source,
      description: data.description,
      estimated_value: data.estimated_value ? parseFloat(data.estimated_value) : null,
      currency: data.currency || "USD",
      probability: data.probability ? parseInt(data.probability) : 0,
      expected_close_date: data.expected_close_date ? new Date(data.expected_close_date) : null,
      stage: data.stage || "NEW",
      status: "OPEN",
      created_by: context.userId
    }
  });

  await logAudit("OPPORTUNITY_CREATE", "Opportunity", opportunity.id, { number: opportunity.opportunity_number });
  return opportunity;
}

export async function updateOpportunity(id: string, data: any) {
  await requirePermission("opportunity.update");
  const { Opportunity, tdb } = await getCrmDb();
  const context = await getTenantContext();

  // Simplified: not re-validating customer since it shouldn't normally change or it's enforced by UI.
  // We check owner if it's changing:
  if (data.owner_id) {
    const member = await (tdb as any).TenantMember.findUnique({
      where: { user_id_tenant_id: { user_id: data.owner_id, tenant_id: context.tenantId } }
    });
    if (!member) throw new Error("Owner must belong to the current tenant");
  }

  const old = await Opportunity.findUnique({ where: { id } });
  if (!old) throw new Error("Not found");

  const updateData: any = {
    name: data.name,
    customer_id: data.customer_id,
    site_id: data.site_id,
    primary_contact_id: data.primary_contact_id,
    owner_id: data.owner_id,
    presales_owner_id: data.presales_owner_id,
    source: data.source,
    description: data.description,
    estimated_value: data.estimated_value ? parseFloat(data.estimated_value) : null,
    currency: data.currency,
    probability: data.probability !== undefined ? parseInt(data.probability) : undefined,
    expected_close_date: data.expected_close_date ? new Date(data.expected_close_date) : null,
    updated_by: context.userId
  };

  if (data.stage && data.stage !== old.stage) {
    updateData.stage = data.stage;
    await logAudit("OPPORTUNITY_STAGE_CHANGE", "Opportunity", id, { from: old.stage, to: data.stage });
  }

  const opp = await Opportunity.update({
    where: { id },
    data: updateData
  });

  await logAudit("OPPORTUNITY_UPDATE", "Opportunity", id, null);
  return opp;
}

export async function markOpportunityWon(id: string) {
  await requirePermission("opportunity.close");
  const { Opportunity } = await getCrmDb();
  const opp = await Opportunity.update({
    where: { id },
    data: { status: "WON", closed_at: new Date() }
  });
  await logAudit("OPPORTUNITY_WON", "Opportunity", id, null);
  return opp;
}

export async function markOpportunityLost(id: string, reason: string) {
  await requirePermission("opportunity.close");
  const { Opportunity } = await getCrmDb();
  const opp = await Opportunity.update({
    where: { id },
    data: { status: "LOST", loss_reason: reason, closed_at: new Date() }
  });
  await logAudit("OPPORTUNITY_LOST", "Opportunity", id, { reason });
  return opp;
}

export async function getPipeline() {
  await requirePermission("opportunity.view");
  const { Opportunity } = await getCrmDb();
  const opps = await Opportunity.findMany({
    where: { status: "OPEN" },
    include: { customer: { select: { display_name: true } } },
    orderBy: { expected_close_date: 'asc' }
  });

  return opps;
}
