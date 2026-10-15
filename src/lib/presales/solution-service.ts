/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";

async function getPresalesDb() {
  const tdb = await getTenantDb();
  return {
    Solution: (tdb as any).Solution || (tdb as any).solution,
    SolutionRevision: (tdb as any).SolutionRevision || (tdb as any).solutionRevision,
    Opportunity: (tdb as any).Opportunity || (tdb as any).opportunity,
    tdb
  };
}

export async function getSolutions(query?: string) {
  await requirePermission("solution.view");
  const { Solution } = await getPresalesDb();
  const where = query ? { name: { contains: query, mode: "insensitive" } } : {};
  return Solution.findMany({
    where,
    include: { opportunity: { select: { name: true } } },
    orderBy: { created_at: "desc" }
  });
}

export async function getSolutionById(id: string) {
  await requirePermission("solution.view");
  const { Solution } = await getPresalesDb();
  return Solution.findUnique({
    where: { id },
    include: {
      opportunity: { select: { name: true, opportunity_number: true } },
      revisions: { orderBy: { revision_number: 'desc' } }
    }
  });
}

export async function createSolution(data: any) {
  await requirePermission("solution.create");
  const { Solution, Opportunity, tdb } = await getPresalesDb();
  const context = await getTenantContext();

  const opp = await Opportunity.findUnique({ where: { id: data.opportunity_id } });
  if (!opp) throw new Error("Opportunity must belong to the current tenant");

  const count = await Solution.count();
  const solNum = `SOL-${String(count + 1).padStart(6, '0')}`;

  const runTransaction = (tdb as any).$transaction || (tdb as any).transaction;
  const sol = await runTransaction(async (tx: any) => {
    const s = await (tx.Solution || tx.solution).create({
      data: {
        solution_number: solNum,
        opportunity_id: data.opportunity_id,
        requirement_id: data.requirement_id || null,
        name: data.name,
        description: data.description,
        architecture_summary: data.architecture_summary,
        assumptions: data.assumptions,
        exclusions: data.exclusions,
        technical_notes: data.technical_notes,
        status: "DRAFT",
        owner_id: data.owner_id,
        created_by: context.userId
      }
    });

    await (tx.SolutionRevision || tx.solutionRevision).create({
      data: {
        solution_id: s.id,
        tenant_id: context.tenantId,
        revision_number: 1,
        title: "Initial Draft",
        description: s.description,
        architecture_summary: s.architecture_summary,
        assumptions: s.assumptions,
        exclusions: s.exclusions,
        technical_notes: s.technical_notes,
        created_by: context.userId
      }
    });
    return s;
  });

  await logAudit("SOLUTION_CREATE", "Solution", sol.id, { number: solNum });
  return sol;
}

export async function createSolutionRevision(id: string, data: any) {
  await requirePermission("solution.update");
  const { Solution, tdb } = await getPresalesDb();
  const context = await getTenantContext();

  const sol = await Solution.findUnique({ where: { id } });
  if (!sol) throw new Error("Not found");

  if (sol.status === "APPROVED") {
    // Actually we can create a new revision even if the solution is approved,
    // it just creates R+1 and might reset the solution status to DRAFT or IN_REVIEW, depending on rules.
    // The prompt says: "New changes create a new revision."
  }

  const runTransaction = (tdb as any).$transaction || (tdb as any).transaction;
  const rev = await runTransaction(async (tx: any) => {
    const revCount = await (tx.SolutionRevision || tx.solutionRevision).count({ where: { solution_id: id } });

    const r = await (tx.SolutionRevision || tx.solutionRevision).create({
      data: {
        solution_id: id,
        tenant_id: context.tenantId,
        revision_number: revCount + 1,
        title: data.title || `Revision ${revCount + 1}`,
        description: data.description,
        architecture_summary: data.architecture_summary,
        assumptions: data.assumptions,
        exclusions: data.exclusions,
        technical_notes: data.technical_notes,
        created_by: context.userId
      }
    });

    // Update main solution metadata
    await (tx.Solution || tx.solution).update({
      where: { id },
      data: {
        description: data.description,
        architecture_summary: data.architecture_summary,
        assumptions: data.assumptions,
        exclusions: data.exclusions,
        technical_notes: data.technical_notes,
        status: "DRAFT",
        updated_by: context.userId
      }
    });

    return r;
  });

  await logAudit("SOLUTION_REVISION_CREATE", "Solution", id, { revision: rev.revision_number });
  return rev;
}

export async function approveSolution(id: string) {
  await requirePermission("solution.approve");
  const { Solution } = await getPresalesDb();

  const sol = await Solution.update({
    where: { id },
    data: { status: "APPROVED" }
  });

  await logAudit("SOLUTION_APPROVE", "Solution", id, null);
  return sol;
}
