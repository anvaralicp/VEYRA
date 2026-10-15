/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */


import { getTenantDb } from "../db/tenant-db";
import { requireTenantContext } from "../auth/boundary";
import { logAudit } from "../audit/logger";
import Decimal from "decimal.js";
import { randomUUID } from "crypto";

export async function getApprovalSettings() {
  const { tenantId } = await requireTenantContext();
  const db: any = await getTenantDb();

  const settingsModel = db.QuotationApprovalSettings || db.quotationApprovalSettings;
  let settings = await settingsModel.findUnique({
    where: { tenant_id: tenantId }
  });

  if (!settings) {
    settings = {
      tenant_id: tenantId,
      is_approval_enabled: false,
      value_threshold: null,
      currency_id: null,
      min_margin_threshold: null,
      require_separation_of_duties: true
    };
  }
  return settings;
}

export async function updateApprovalSettings(data: {
  is_approval_enabled: boolean;
  value_threshold?: number | null;
  currency_id?: string | null;
  min_margin_threshold?: number | null;
  require_separation_of_duties: boolean;
}) {
  const { tenantId, userId } = await requireTenantContext();
  const db: any = await getTenantDb();

  const settingsModel = db.QuotationApprovalSettings || db.quotationApprovalSettings;

  if (data.is_approval_enabled && data.value_threshold && !data.currency_id) {
    throw new Error("Currency must be specified when value threshold is set.");
  }
  if (data.min_margin_threshold !== undefined && data.min_margin_threshold !== null) {
    if (data.min_margin_threshold < 0 || data.min_margin_threshold >= 100) {
      throw new Error("Margin threshold must be between 0 and 99.99%.");
    }
  }

  const upserted = await settingsModel.upsert({
    where: { tenant_id: tenantId },
    update: {
      is_approval_enabled: data.is_approval_enabled,
      value_threshold: data.value_threshold !== undefined ? data.value_threshold : null,
      currency_id: data.currency_id !== undefined ? data.currency_id : null,
      min_margin_threshold: data.min_margin_threshold !== undefined ? data.min_margin_threshold : null,
      require_separation_of_duties: data.require_separation_of_duties
    },
    create: {
      id: randomUUID(),
      tenant_id: tenantId,
      is_approval_enabled: data.is_approval_enabled,
      value_threshold: data.value_threshold !== undefined ? data.value_threshold : null,
      currency_id: data.currency_id !== undefined ? data.currency_id : null,
      min_margin_threshold: data.min_margin_threshold !== undefined ? data.min_margin_threshold : null,
      require_separation_of_duties: data.require_separation_of_duties
    }
  });

  await logAudit("QUOTATION_APPROVAL_SETTINGS_UPDATED", "QuotationApprovalSettings", upserted.id, data);

  return upserted;
}

export async function evaluateQuotationPolicy(revision: any) {
  const settings = await getApprovalSettings();

  if (!settings.is_approval_enabled) {
    return { requiresApproval: false, reason: "Approval is disabled globally for this tenant." };
  }

  const reasons: string[] = [];

  // Margin check
  if (settings.min_margin_threshold !== null) {
    const rev = new Decimal(revision.total_selling_price || 0);
    const cost = new Decimal(revision.total_cost || 0);

    let actualMargin = new Decimal(0);
    if (rev.greaterThan(0)) {
      actualMargin = rev.sub(cost).div(rev).mul(100);
    } else if (cost.greaterThan(0)) {
       actualMargin = new Decimal(-100); // 0 revenue but >0 cost
    }

    if (actualMargin.lessThan(settings.min_margin_threshold)) {
      reasons.push(`Actual margin (${actualMargin.toDP(2).toNumber()}%) is below the required threshold (${settings.min_margin_threshold}%).`);
    }
  }

  // Value threshold check
  if (settings.value_threshold !== null && settings.currency_id !== null) {
    if (revision.currency_id !== settings.currency_id) {
       reasons.push(`Quotation currency does not match the approval value threshold currency, requiring explicit review.`);
    } else {
       const grandTotal = new Decimal(revision.grand_total || 0);
       if (grandTotal.greaterThanOrEqualTo(settings.value_threshold)) {
          reasons.push(`Quotation value (${grandTotal.toNumber()}) meets or exceeds the threshold of ${settings.value_threshold}.`);
       }
    }
  }

  if (reasons.length > 0) {
    return { requiresApproval: true, reason: reasons.join(" ") };
  }

  return { requiresApproval: false, reason: "No approval thresholds exceeded." };
}

export async function evaluateAndSetApprovalStatus(db: any, revisionId: string, forceUpdateStatus: boolean = false) {
    const revModel = db.QuotationRevision || db.quotationRevision;
    const revision = await revModel.findUnique({ where: { id: revisionId } });
    if (!revision) return;

    if (revision.status === "ISSUED" || revision.status === "SUPERSEDED" || revision.status === "WITHDRAWN") {
        return { revision, policy: { requiresApproval: false, reason: "Immutable" } };
    }

    const policy = await evaluateQuotationPolicy(revision);

    let newStatus = revision.approval_status;
    if (!policy.requiresApproval) {
        newStatus = "NOT_REQUIRED";
    } else {
        if (revision.approval_status === "NOT_REQUIRED") {
            newStatus = "NOT_SUBMITTED";
        }
    }

    if (newStatus !== revision.approval_status || forceUpdateStatus) {
         await revModel.update({
             where: { id: revisionId },
             data: { approval_status: newStatus }
         });
         revision.approval_status = newStatus;
    }
    return { revision, policy };
}

export async function submitQuotationForApproval(revisionId: string) {
  const { tenantId, userId } = await requireTenantContext();
  const rawDb: any = await getTenantDb();
  const db = rawDb.tdb || rawDb;
  const reqModel = rawDb.tdb ? rawDb.tdb.QuotationApprovalRequest || rawDb.tdb.quotationApprovalRequest : rawDb.QuotationApprovalRequest || rawDb.quotationApprovalRequest;

  return await db.$transaction(async (tx: any) => {
    const revModel = tx.QuotationRevision || tx.quotationRevision;
    const reqModel = tx.QuotationApprovalRequest || tx.quotationApprovalRequest;
    const recModel = tx.QuotationApprovalRecord || tx.quotationApprovalRecord;

    const revision = await revModel.findUnique({ where: { id: revisionId, tenant_id: tenantId } });
    if (!revision) throw new Error("Revision not found.");
    if (revision.status !== "DRAFT") throw new Error("Only DRAFT revisions can be submitted.");
    if (revision.approval_status === "REJECTED") throw new Error("Rejected revisions cannot be resubmitted. Please create a new revision.");

    const policy = await evaluateQuotationPolicy(revision);
    if (!policy.requiresApproval) {
       await revModel.update({ where: { id: revisionId }, data: { approval_status: "NOT_REQUIRED" }});
       return { success: true, message: "Approval not required." };
    }

    if (revision.approval_status === "PENDING" || revision.approval_status === "APPROVED") {
        throw new Error("Revision is already pending or approved.");
    }

    const settings = await getApprovalSettings();

    const request = await reqModel.create({
      data: {
        id: randomUUID(),
        tenant_id: tenantId,
        quotation_revision_id: revisionId,
        status: "PENDING",
        requester_id: userId,
        policy_snapshot: { reason: policy.reason, settings }
      }
    });

    await recModel.create({
      data: {
        id: randomUUID(),
        tenant_id: tenantId,
        request_id: request.id,
        actor_id: userId,
        decision: "SUBMITTED",
        comments: policy.reason
      }
    });

    await revModel.update({
      where: { id: revisionId },
      data: { approval_status: "PENDING" }
    });

    await logAudit("QUOTATION_APPROVAL_SUBMITTED", "QuotationRevision", revisionId);

    return request;
  });
}

export async function decideQuotationApproval(revisionId: string, decision: "APPROVED" | "RETURNED" | "REJECTED", comments: string) {
  const { tenantId, userId } = await requireTenantContext();
  const rawDb: any = await getTenantDb();
  const db = rawDb.tdb || rawDb;
  const reqModel = rawDb.tdb ? rawDb.tdb.QuotationApprovalRequest || rawDb.tdb.quotationApprovalRequest : rawDb.QuotationApprovalRequest || rawDb.quotationApprovalRequest;

  return await db.$transaction(async (tx: any) => {
    const revModel = tx.QuotationRevision || tx.quotationRevision;
    const reqModel = tx.QuotationApprovalRequest || tx.quotationApprovalRequest;
    const recModel = tx.QuotationApprovalRecord || tx.quotationApprovalRecord;

    const revision = await revModel.findUnique({ where: { id: revisionId, tenant_id: tenantId } });
    if (!revision) throw new Error("Revision not found.");

    if (revision.approval_status !== "PENDING") {
       throw new Error("Revision is not pending approval.");
    }

    const request = await reqModel.findFirst({
        where: { quotation_revision_id: revisionId, status: "PENDING" },
        orderBy: { created_at: "desc" }
    });

    if (!request) throw new Error("No active pending request found.");

    const settings = await getApprovalSettings();
    if (settings.require_separation_of_duties && request.requester_id === userId) {
        throw new Error("Separation of duties is enabled. You cannot approve your own request.");
    }

    if ((decision === "RETURNED" || decision === "REJECTED") && (!comments || comments.trim() === "")) {
        throw new Error("Comments are required when returning or rejecting a quotation.");
    }

    await recModel.create({
      data: {
        id: randomUUID(),
        tenant_id: tenantId,
        request_id: request.id,
        actor_id: userId,
        decision: decision,
        comments: comments || ""
      }
    });

    await reqModel.update({
        where: { id: request.id },
        data: { status: decision }
    });

    await revModel.update({
        where: { id: revisionId },
        data: { approval_status: decision }
    });

    await logAudit("QUOTATION_" + decision, "QuotationRevision", revisionId, { comments });

    return { success: true };
  });
}

export async function listPendingApprovals() {
  const { tenantId } = await requireTenantContext();
  const db: any = await getTenantDb();
  const reqModel = db.QuotationApprovalRequest || db.quotationApprovalRequest;

  return await reqModel.findMany({
    where: { tenant_id: tenantId, status: "PENDING" },
    include: {
      quotationRevision: {
        include: {
          quotation: {
            include: { customer: true }
          }
        }
      }
    },
    orderBy: { created_at: "desc" }
  });
}
