/* eslint-disable prefer-const, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";
import Decimal from "decimal.js";
import { randomUUID as uuidv4 } from "crypto";

async function getPODb() {
  const tdb: any = await getTenantDb();
  const root = tdb.tdb || tdb;
  return {
    CustomerPurchaseOrder: root.CustomerPurchaseOrder || root.customerPurchaseOrder,
    CustomerPurchaseOrderLine: root.CustomerPurchaseOrderLine || root.customerPurchaseOrderLine,
    CustomerPurchaseOrderValidation: root.CustomerPurchaseOrderValidation || root.customerPurchaseOrderValidation,
    QuotationRevision: root.QuotationRevision || root.quotationRevision,
    Customer: root.Customer || root.customer,
    Quotation: root.Quotation || root.quotation,
    Currency: root.Currency || root.currency,
    tdb: root
  };
}

export async function createCustomerPO(data: any) {
  await requirePermission("customer_po.create");
  const ctx = await getTenantContext();
  const db = await getPODb();

  let rev: any = null;
  if (data.quotation_revision_id) {
    rev = await db.QuotationRevision.findUnique({
      where: { id: data.quotation_revision_id, tenant_id: ctx.tenantId },
      include: { quotation: true, lines: true }
    });
    if (!rev) throw new Error("Quotation revision not found");
    if (rev.status !== "ISSUED") throw new Error("Only issued quotation revisions can be referenced");
    if (rev.quotation?.customer_id && rev.quotation.customer_id !== data.customer_id) {
      throw new Error("Quotation customer does not match PO customer");
    }
  }

  const existing = await db.CustomerPurchaseOrder.findUnique({
    where: {
      tenant_id_customer_id_po_number: {
        tenant_id: ctx.tenantId,
        customer_id: data.customer_id,
        po_number: data.po_number
      }
    }
  });
  if (existing) throw new Error("PO number already exists for this customer");

  const po = await db.CustomerPurchaseOrder.create({
    data: {
      tenant_id: ctx.tenantId,
      po_number: data.po_number,
      customer_id: data.customer_id,
      opportunity_id: data.opportunity_id || (rev?.quotation?.opportunity_id || null),
      quotation_id: data.quotation_id || (rev?.quotation?.id || null),
      quotation_revision_id: data.quotation_revision_id || null,
      po_date: new Date(data.po_date),
      received_date: new Date(data.received_date),
      valid_until: data.valid_until ? new Date(data.valid_until) : null,
      currency_id: data.currency_id,
      subtotal: data.subtotal,
      tax_total: data.tax_total,
      grand_total: data.grand_total,
      status: "DRAFT",
      notes: data.notes || null,
      registered_by: ctx.userId,
      registered_at: new Date()
    }
  });

  if (data.lines && Array.isArray(data.lines) && data.lines.length > 0) {
    for (let i = 0; i < data.lines.length; i++) {
      const l = data.lines[i];
      await db.CustomerPurchaseOrderLine.create({
        data: {
          tenant_id: ctx.tenantId,
          customer_purchase_order_id: po.id,
          line_number: i + 1,
          customer_item_code: l.customer_item_code || null,
          customer_item_description: l.customer_item_description || "Line item",
          quotation_line_id: l.quotation_line_id || null,
          quantity: l.quantity,
          unit_of_measure: l.unit_of_measure || "EA",
          unit_price: l.unit_price,
          tax_rate: l.tax_rate !== undefined ? l.tax_rate : null,
          tax_amount: l.tax_amount || 0,
          line_total: l.line_total,
          notes: l.notes || null
        }
      });
    }
  } else if (data.import_quotation_lines && rev?.lines?.length) {
    for (let i = 0; i < rev.lines.length; i++) {
      const ql = rev.lines[i];
      await db.CustomerPurchaseOrderLine.create({
        data: {
          tenant_id: ctx.tenantId,
          customer_purchase_order_id: po.id,
          line_number: i + 1,
          customer_item_code: ql.item_code_snapshot || null,
          customer_item_description: ql.item_description_snapshot || ql.item_name || "Line item",
          quotation_line_id: ql.id,
          quantity: ql.quantity,
          unit_of_measure: ql.unit_of_measure || "EA",
          unit_price: ql.unit_selling_price,
          tax_rate: ql.tax_rate !== undefined ? ql.tax_rate : null,
          tax_amount: ql.tax_amount || 0,
          line_total: ql.line_total || new Decimal(ql.unit_selling_price).times(ql.quantity).toNumber(),
          notes: ql.notes || null
        }
      });
    }
  }

  await logAudit("CUSTOMER_PO_CREATED", "CustomerPurchaseOrder", po.id, null);
  return po;
}

export async function submitCustomerPO(po_id: string) {
  await requirePermission("customer_po.submit");
  const ctx = await getTenantContext();
  const db = await getPODb();

  const po = await db.CustomerPurchaseOrder.findUnique({
    where: { id: po_id, tenant_id: ctx.tenantId }
  });
  if (!po) throw new Error("Customer PO not found");
  if (po.status !== "DRAFT" && po.status !== "RETURNED") throw new Error("Only DRAFT or RETURNED POs can be submitted");

  await db.CustomerPurchaseOrder.update({
    where: { id: po_id },
    data: {
      status: "SUBMITTED",
      submitted_by: ctx.userId,
      submitted_at: new Date()
    }
  });

  await logAudit("CUSTOMER_PO_SUBMITTED", "CustomerPurchaseOrder", po_id, null);
}

export async function generatePOValidationFindings(po_id: string) {
  const ctx = await getTenantContext();
  const db = await getPODb();

  const po = await db.CustomerPurchaseOrder.findUnique({
    where: { id: po_id, tenant_id: ctx.tenantId },
    include: { lines: true, quotationRevision: { include: { lines: true } } }
  });
  if (!po) throw new Error("PO not found");

  const findings: any[] = [];

  if (po.quotationRevision) {
    const rev = po.quotationRevision;

    // Header Totals Check
    const poGrand = new Decimal(po.grand_total);
    const revGrand = new Decimal(rev.grand_total);

    if (!poGrand.equals(revGrand)) {
      findings.push({
        type: "TOTAL_MISMATCH",
        severity: "WARNING",
        message: `PO Grand Total (${poGrand}) does not match Quotation Total (${revGrand})`
      });
    }

    if (po.currency_id !== rev.currency_id) {
      findings.push({
        type: "CURRENCY_MISMATCH",
        severity: "ERROR",
        message: `PO Currency does not match Quotation Currency`
      });
    }

    // Line matching
    for (const poLine of po.lines) {
      if (poLine.quotation_line_id) {
        const qLine = rev.lines.find((l: any) => l.id === poLine.quotation_line_id);
        if (!qLine) {
          findings.push({
            type: "INVALID_LINE_REFERENCE",
            severity: "ERROR",
            message: `PO Line ${poLine.line_number} references a quotation line that does not exist in this revision`
          });
        } else {
           const poUnitPrice = new Decimal(poLine.unit_price);
           const qUnitPrice = new Decimal(qLine.unit_selling_price);
           if (!poUnitPrice.equals(qUnitPrice)) {
             findings.push({
               type: "UNIT_PRICE_MISMATCH",
               severity: "WARNING",
               message: `PO Line ${poLine.line_number} unit price (${poUnitPrice}) differs from quotation (${qUnitPrice})`
             });
           }

           const poQty = new Decimal(poLine.quantity);
           const qQty = new Decimal(qLine.quantity);
           if (!poQty.equals(qQty)) {
             findings.push({
               type: "QUANTITY_MISMATCH",
               severity: "WARNING",
               message: `PO Line ${poLine.line_number} quantity (${poQty}) differs from quotation (${qQty})`
             });
           }
        }
      } else {
        findings.push({
          type: "UNMATCHED_LINE",
          severity: "INFO",
          message: `PO Line ${poLine.line_number} is not matched to any quotation line`
        });
      }
    }

    // Check for missing quotation lines
    const matchedQLineIds = po.lines.map((l: any) => l.quotation_line_id).filter(Boolean);
    for (const qLine of rev.lines) {
      if (!matchedQLineIds.includes(qLine.id)) {
        findings.push({
          type: "MISSING_QUOTATION_LINE",
          severity: "WARNING",
          message: `Quotation Line ${qLine.line_number} is missing from the PO`
        });
      }
    }
  }

  // Arithmetic Checks
  const subtotal = new Decimal(po.subtotal);
  const tax = new Decimal(po.tax_total);
  const expectedGrand = subtotal.plus(tax);
  if (!expectedGrand.equals(new Decimal(po.grand_total))) {
    findings.push({
      type: "ARITHMETIC_ERROR",
      severity: "ERROR",
      message: `PO Subtotal + Tax (${expectedGrand}) does not equal Grand Total (${po.grand_total})`
    });
  }

  return findings;
}

export async function validateCustomerPO(po_id: string, decision: string, comments?: string) {
  await requirePermission("customer_po.validate");
  const ctx = await getTenantContext();
  const db = await getPODb();

  const po = await db.CustomerPurchaseOrder.findUnique({
    where: { id: po_id, tenant_id: ctx.tenantId }
  });
  if (!po) throw new Error("Customer PO not found");
  if (po.status !== "SUBMITTED" && po.status !== "UNDER_REVIEW") throw new Error("Only SUBMITTED or UNDER_REVIEW POs can be evaluated");
  if (decision !== "VALIDATED" && decision !== "RETURNED" && decision !== "REJECTED") throw new Error("Invalid decision");

  let findings = await generatePOValidationFindings(po_id);
  if (decision === "VALIDATED") {
     const hasBlockingErrors = findings.some((f: any) => f.severity === "ERROR");
     if (hasBlockingErrors) throw new Error("Cannot validate PO with blocking errors");
  }

  await db.tdb.$transaction(async (tx: any) => {
    const CPOV = tx.CustomerPurchaseOrderValidation || tx.customerPurchaseOrderValidation;
    const CPO = tx.CustomerPurchaseOrder || tx.customerPurchaseOrder;

    await CPOV.create({
      data: {
        tenant_id: ctx.tenantId,
        customer_purchase_order_id: po_id,
        previous_status: po.status,
        new_status: decision,
        comments: comments || "",
        findings,
        reviewer_id: ctx.userId
      }
    });

    await CPO.update({
      where: { id: po_id },
      data: { status: decision }
    });
  });

  await logAudit(`CUSTOMER_PO_${decision}`, "CustomerPurchaseOrder", po_id, null);
}

export async function addCustomerPOLine(po_id: string, data: any) {
  await requirePermission("customer_po.update");
  const ctx = await getTenantContext();
  const db = await getPODb();

  const po = await db.CustomerPurchaseOrder.findUnique({
    where: { id: po_id, tenant_id: ctx.tenantId },
    include: { lines: true }
  });
  if (!po) throw new Error("PO not found");
  if (po.status !== "DRAFT" && po.status !== "RETURNED") throw new Error("Cannot modify PO in current state");

  if (data.quotation_line_id) {
    // Check for duplicate mappings
    const exists = po.lines.find((l: any) => l.quotation_line_id === data.quotation_line_id);
    if (exists) throw new Error("Quotation line already mapped");
  }

  await db.CustomerPurchaseOrderLine.create({
    data: {
      tenant_id: ctx.tenantId,
      customer_purchase_order_id: po_id,
      line_number: po.lines.length + 1,
      customer_item_code: data.customer_item_code,
      customer_item_description: data.customer_item_description,
      quotation_line_id: data.quotation_line_id,
      quantity: data.quantity,
      unit_of_measure: data.unit_of_measure || "EA",
      unit_price: data.unit_price,
      tax_rate: data.tax_rate,
      tax_amount: data.tax_amount,
      line_total: data.line_total,
      notes: data.notes
    }
  });

  await logAudit("CUSTOMER_PO_UPDATED", "CustomerPurchaseOrder", po_id, null);
}

export async function listCustomerPOs(options?: {
  search?: string;
  status?: string;
  customer_id?: string;
  page?: number;
  limit?: number;
}) {
  await requirePermission("customer_po.view");
  const ctx = await getTenantContext();
  const db = await getPODb();

  const page = options?.page || 1;
  const limit = options?.limit || 50;
  const skip = (page - 1) * limit;

  const where: any = {
    tenant_id: ctx.tenantId,
  };

  if (options?.status) {
    where.status = options.status;
  }
  if (options?.customer_id) {
    where.customer_id = options.customer_id;
  }
  if (options?.search) {
    where.OR = [
      { po_number: { contains: options.search, mode: "insensitive" } },
      { customer: { name: { contains: options.search, mode: "insensitive" } } },
      { notes: { contains: options.search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    db.CustomerPurchaseOrder.findMany({
      where,
      include: {
        customer: true,
        quotation: true,
        quotationRevision: true,
        currency: true,
        fulfilmentOrder: true,
      },
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    }),
    db.CustomerPurchaseOrder.count ? db.CustomerPurchaseOrder.count({ where }) : Promise.resolve(0),
  ]);

  return {
    items: items || [],
    total: total !== undefined ? total : (items ? items.length : 0),
    page,
    limit,
    totalPages: Math.ceil((total || 0) / limit) || 1,
  };
}

export async function getCustomerPO(id: string) {
  await requirePermission("customer_po.view");
  const ctx = await getTenantContext();
  const db = await getPODb();

  return await db.CustomerPurchaseOrder.findUnique({
    where: { id, tenant_id: ctx.tenantId },
    include: {
      customer: true,
      opportunity: true,
      quotation: true,
      quotationRevision: {
        include: {
          lines: { orderBy: { line_number: "asc" } },
        },
      },
      currency: true,
      lines: {
        orderBy: { line_number: "asc" },
        include: {
          quotationLine: true,
        },
      },
      validations: {
        orderBy: { created_at: "desc" },
      },
      fulfilmentOrder: {
        include: {
          lines: true,
          statusHistory: { orderBy: { created_at: "desc" } },
        },
      },
    },
  });
}

export async function deleteCustomerPO(po_id: string) {
  await requirePermission("customer_po.delete");
  const ctx = await getTenantContext();
  const db = await getPODb();

  const po = await db.CustomerPurchaseOrder.findUnique({
    where: { id: po_id, tenant_id: ctx.tenantId }
  });
  if (!po) throw new Error("Customer PO not found");
  if (po.status !== "DRAFT") throw new Error("Only DRAFT Customer POs can be deleted");

  await db.CustomerPurchaseOrder.delete({
    where: { id: po_id, tenant_id: ctx.tenantId }
  });

  await logAudit("CUSTOMER_PO_DELETED", "CustomerPurchaseOrder", po_id, null);
}
