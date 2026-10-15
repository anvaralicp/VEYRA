/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";

async function getPresalesDb() {
  const tdb = await getTenantDb();
  return {
    Requirement: (tdb as any).Requirement || (tdb as any).requirement,
    Opportunity: (tdb as any).Opportunity || (tdb as any).opportunity,
    tdb
  };
}

export async function getRequirements(query?: string) {
  await requirePermission("requirement.view");
  const { Requirement } = await getPresalesDb();
  const where = query ? { title: { contains: query, mode: "insensitive" } } : {};
  return Requirement.findMany({
    where,
    include: { opportunity: { select: { name: true, opportunity_number: true } } },
    orderBy: { created_at: "desc" }
  });
}

export async function getRequirementById(id: string) {
  await requirePermission("requirement.view");
  const { Requirement } = await getPresalesDb();
  return Requirement.findUnique({
    where: { id },
    include: {
      opportunity: { select: { name: true, opportunity_number: true } },
      customer: { select: { display_name: true } },
      site: { select: { name: true } }
    }
  });
}

export async function createRequirement(data: any) {
  await requirePermission("requirement.create");
  const { Requirement, Opportunity, tdb } = await getPresalesDb();
  const context = await getTenantContext();

  // Validate Owner
  const member = await (tdb as any).TenantMember.findUnique({
    where: { user_id_tenant_id: { user_id: data.owner_id, tenant_id: context.tenantId } }
  });
  if (!member) throw new Error("Owner must belong to the current tenant");

  // Validate Opportunity (also validates customer implicit in the UI/data but let's check opp)
  const opp = await Opportunity.findUnique({ where: { id: data.opportunity_id } });
  if (!opp) throw new Error("Opportunity must belong to the current tenant");

  const count = await Requirement.count();
  const reqNum = `REQ-${String(count + 1).padStart(6, '0')}`;

  const req = await Requirement.create({
    data: {
      requirement_number: reqNum,
      title: data.title,
      opportunity_id: data.opportunity_id,
      customer_id: data.customer_id,
      site_id: data.site_id || null,
      description: data.description,
      business_need: data.business_need,
      technical_need: data.technical_need,
      scope: data.scope,
      priority: data.priority || "MEDIUM",
      status: "OPEN",
      owner_id: data.owner_id,
      created_by: context.userId
    }
  });

  await logAudit("REQUIREMENT_CREATE", "Requirement", req.id, { number: reqNum });
  return req;
}

export async function updateRequirement(id: string, data: any) {
  await requirePermission("requirement.update");
  const { Requirement, tdb } = await getPresalesDb();
  const context = await getTenantContext();

  if (data.owner_id) {
    const member = await (tdb as any).TenantMember.findUnique({
      where: { user_id_tenant_id: { user_id: data.owner_id, tenant_id: context.tenantId } }
    });
    if (!member) throw new Error("Owner must belong to the current tenant");
  }

  const old = await Requirement.findUnique({ where: { id } });
  if (!old) throw new Error("Not found");

  const updateData: any = {
    title: data.title,
    description: data.description,
    business_need: data.business_need,
    technical_need: data.technical_need,
    scope: data.scope,
    priority: data.priority,
    owner_id: data.owner_id,
    updated_by: context.userId
  };

  if (data.status && data.status !== old.status) {
    // some statuses might require specific permission like 'approve'
    if (data.status === "APPROVED") {
      await requirePermission("requirement.approve");
      await logAudit("REQUIREMENT_APPROVE", "Requirement", id, null);
    } else {
      await logAudit("REQUIREMENT_STATUS_CHANGE", "Requirement", id, { from: old.status, to: data.status });
    }
    updateData.status = data.status;
  }

  const req = await Requirement.update({ where: { id }, data: updateData });
  await logAudit("REQUIREMENT_UPDATE", "Requirement", id, null);
  return req;
}
