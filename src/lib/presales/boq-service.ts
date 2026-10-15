/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";

async function getPresalesDb() {
  const tdb = await getTenantDb();
  return {
    BOQ: (tdb as any).BOQ || (tdb as any).bOQ,
    BOQRevision: (tdb as any).BOQRevision || (tdb as any).bOQRevision,
    BOQLine: (tdb as any).BOQLine || (tdb as any).bOQLine,
    Opportunity: (tdb as any).Opportunity || (tdb as any).opportunity,
    Solution: (tdb as any).Solution || (tdb as any).solution,
    tdb
  };
}

export async function getBOQs(query?: string) {
  await requirePermission("boq.view");
  const { BOQ } = await getPresalesDb();
  const where = query ? { name: { contains: query, mode: "insensitive" } } : {};
  return BOQ.findMany({
    where,
    include: { opportunity: { select: { name: true } } },
    orderBy: { created_at: "desc" }
  });
}

export async function getBOQById(id: string) {
  await requirePermission("boq.view");
  const { BOQ } = await getPresalesDb();
  return BOQ.findUnique({
    where: { id },
    include: {
      opportunity: { select: { name: true, opportunity_number: true } },
      solution: { select: { name: true, solution_number: true } },
      revisions: {
        orderBy: { revision_number: 'desc' },
        include: { lines: { orderBy: { line_number: 'asc' } } }
      }
    }
  });
}

export async function createBOQ(data: any) {
  await requirePermission("boq.create");
  const { BOQ, Opportunity, Solution, tdb } = await getPresalesDb();
  const context = await getTenantContext();

  const opp = await Opportunity.findUnique({ where: { id: data.opportunity_id } });
  if (!opp) throw new Error("Opportunity must belong to the current tenant");

  if (data.solution_id) {
    const sol = await Solution.findUnique({ where: { id: data.solution_id } });
    if (!sol) throw new Error("Solution must belong to the current tenant");
  }

  const count = await BOQ.count();
  const boqNum = `BOQ-${String(count + 1).padStart(6, '0')}`;

  const runTransaction = (tdb as any).$transaction || (tdb as any).transaction;
  const boq = await runTransaction(async (tx: any) => {
    const b = await (tx.BOQ || tx.bOQ).create({
      data: {
        boq_number: boqNum,
        opportunity_id: data.opportunity_id,
        solution_id: data.solution_id || null,
        name: data.name,
        description: data.description,
        status: "DRAFT",
        created_by: context.userId
      }
    });

    const rev = await (tx.BOQRevision || tx.bOQRevision).create({
      data: {
        boq_id: b.id,
        tenant_id: context.tenantId,
        revision_number: 1,
        status: "DRAFT",
        description: "Initial Draft",
        created_by: context.userId
      }
    });

    await (tx.BOQ || tx.bOQ).update({
      where: { id: b.id },
      data: { current_revision_id: rev.id }
    });

    return b;
  });

  await logAudit("BOQ_CREATE", "BOQ", boq.id, { number: boqNum });
  return boq;
}

export async function addBOQLine(boqId: string, revisionId: string, data: any) {
  await requirePermission("boq.update");
  const { BOQRevision, BOQLine } = await getPresalesDb();
  const context = await getTenantContext();

  const rev = await BOQRevision.findUnique({ where: { id: revisionId } });
  if (!rev) throw new Error("Revision not found");
  if (rev.status !== "DRAFT" && rev.status !== "REJECTED") {
    throw new Error("Cannot add lines to a submitted or approved revision");
  }

  const lineCount = await BOQLine.count({ where: { boq_revision_id: revisionId } });

  const line = await BOQLine.create({
    data: {
      boq_revision_id: revisionId,
      tenant_id: context.tenantId,
      line_number: lineCount + 1,
      item_type: data.item_type || "HARDWARE",
      product_name: data.product_name,
      manufacturer: data.manufacturer,
      model_number: data.model_number,
      description: data.description,
      specification: data.specification,
      quantity: data.quantity ? parseFloat(data.quantity) : 1,
      unit: data.unit || "EA",
      remarks: data.remarks
    }
  });

  await logAudit("BOQ_LINE_CREATE", "BOQ", boqId, { revisionId, lineId: line.id });
  return line;
}

export async function submitBOQRevision(boqId: string, revisionId: string) {
  await requirePermission("boq.submit");
  const { BOQRevision, tdb } = await getPresalesDb();

  const rev = await BOQRevision.findUnique({ where: { id: revisionId } });
  if (!rev || (rev.status !== "DRAFT" && rev.status !== "REJECTED")) {
    throw new Error("Only DRAFT or REJECTED revisions can be submitted");
  }

  const runTransaction = (tdb as any).$transaction || (tdb as any).transaction;
  await runTransaction(async (tx: any) => {
    await (tx.BOQRevision || tx.bOQRevision).update({
      where: { id: revisionId },
      data: { status: "SUBMITTED" }
    });
    await (tx.BOQ || tx.bOQ).update({
      where: { id: boqId },
      data: { status: "IN_REVIEW" }
    });
  });

  await logAudit("BOQ_SUBMIT", "BOQ", boqId, { revisionId });
}

export async function approveBOQRevision(boqId: string, revisionId: string) {
  await requirePermission("boq.approve");
  const { BOQRevision, tdb } = await getPresalesDb();
  const context = await getTenantContext();

  const rev = await BOQRevision.findUnique({ where: { id: revisionId } });
  if (!rev || rev.status !== "SUBMITTED") {
    throw new Error("Only SUBMITTED revisions can be approved");
  }

  const runTransaction = (tdb as any).$transaction || (tdb as any).transaction;
  await runTransaction(async (tx: any) => {
    // Supersede previously approved revisions
    await (tx.BOQRevision || tx.bOQRevision).updateMany({
      where: { boq_id: boqId, status: "APPROVED" },
      data: { status: "SUPERSEDED" }
    });

    await (tx.BOQRevision || tx.bOQRevision).update({
      where: { id: revisionId },
      data: { status: "APPROVED", approved_by: context.userId, approved_at: new Date() }
    });

    await (tx.BOQ || tx.bOQ).update({
      where: { id: boqId },
      data: { status: "APPROVED", current_revision_id: revisionId }
    });
  });

  await logAudit("BOQ_APPROVE", "BOQ", boqId, { revisionId });
}

export async function rejectBOQRevision(boqId: string, revisionId: string) {
  await requirePermission("boq.reject");
  const { BOQRevision, tdb } = await getPresalesDb();

  const rev = await BOQRevision.findUnique({ where: { id: revisionId } });
  if (!rev || rev.status !== "SUBMITTED") {
    throw new Error("Only SUBMITTED revisions can be rejected");
  }

  const runTransaction = (tdb as any).$transaction || (tdb as any).transaction;
  await runTransaction(async (tx: any) => {
    await (tx.BOQRevision || tx.bOQRevision).update({
      where: { id: revisionId },
      data: { status: "REJECTED" }
    });

    await (tx.BOQ || tx.bOQ).update({
      where: { id: boqId },
      data: { status: "REJECTED" }
    });
  });

  await logAudit("BOQ_REJECT", "BOQ", boqId, { revisionId });
}

export async function createBOQRevision(boqId: string) {
  await requirePermission("boq.create");
  const { BOQ, tdb } = await getPresalesDb();
  const context = await getTenantContext();

  const boq = await BOQ.findUnique({ where: { id: boqId }, include: { revisions: { orderBy: { revision_number: 'desc' } } } });
  if (!boq) throw new Error("BOQ not found");

  const latestRev = boq.revisions[0];
  const newRevNum = latestRev ? latestRev.revision_number + 1 : 1;

  const runTransaction = (tdb as any).$transaction || (tdb as any).transaction;
  const newRev = await runTransaction(async (tx: any) => {
    const rev = await (tx.BOQRevision || tx.bOQRevision).create({
      data: {
        boq_id: boqId,
        tenant_id: context.tenantId,
        revision_number: newRevNum,
        status: "DRAFT",
        description: `Revision ${newRevNum}`,
        created_by: context.userId
      }
    });

    if (latestRev) {
      // Copy lines
      const oldLines = await (tx.BOQLine || tx.bOQLine).findMany({ where: { boq_revision_id: latestRev.id } });
      for (const ol of oldLines) {
        await (tx.BOQLine || tx.bOQLine).create({
          data: {
            boq_revision_id: rev.id,
            tenant_id: context.tenantId,
            line_number: ol.line_number,
            item_type: ol.item_type,
            product_name: ol.product_name,
            manufacturer: ol.manufacturer,
            model_number: ol.model_number,
            description: ol.description,
            specification: ol.specification,
            quantity: ol.quantity,
            unit: ol.unit,
            remarks: ol.remarks
          }
        });
      }
    }

    await (tx.BOQ || tx.bOQ).update({
      where: { id: boqId },
      data: { current_revision_id: rev.id, status: "DRAFT" }
    });

    return rev;
  });

  await logAudit("BOQ_REVISION_CREATE", "BOQ", boqId, { revisionId: newRev.id });
  return newRev;
}
