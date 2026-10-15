/* eslint-disable prefer-const, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";
import Decimal from "decimal.js";
import { calculateCommercialCost, CostComponent } from "./costing-service";
import { evaluateAndSetApprovalStatus } from "./quotation-approval-service";
import { randomUUID as uuidv4 } from "crypto";

// Note: Ensure @prisma/client / orm-postgres is accessed securely
async function getQDb() {
  const tdb: any = await getTenantDb();
  return {
    Quotation: tdb.tdb.Quotation || tdb.tdb.quotation,
    QuotationRevision: tdb.tdb.QuotationRevision || tdb.tdb.quotationRevision,
    QuotationLine: tdb.tdb.QuotationLine || tdb.tdb.quotationLine,
    Opportunity: tdb.tdb.Opportunity || tdb.tdb.opportunity,
    BOQ: tdb.tdb.BOQ || tdb.tdb.bOQ,
    BOQRevision: tdb.tdb.BOQRevision || tdb.tdb.bOQRevision,
    Customer: tdb.tdb.Customer || tdb.tdb.customer,
    CustomerContact: tdb.tdb.CustomerContact || tdb.tdb.customerContact,
    Currency: tdb.tdb.Currency || tdb.tdb.currency,
    ProductService: tdb.tdb.ProductService || tdb.tdb.productService,
    Vendor: tdb.tdb.Vendor || tdb.tdb.vendor,
    tdb
  };
}

export async function createQuotationFromOpportunity(opportunity_id: string, currency_id: string) {
  await requirePermission("quotation.create");
  const ctx = await getTenantContext();
  const db = await getQDb();

  const opp = await db.tdb.Opportunity.findUnique({
    where: { id: opportunity_id, tenant_id: ctx.tenantId },
    include: { customer: true }
  });

  if (!opp) throw new Error("Opportunity not found or access denied");

  const curr = await db.tdb.Currency.findUnique({
    where: { id: currency_id } // Global master data
  });
  if (!curr) throw new Error("Currency not found");

  // Numbering
  const count = await db.tdb.Quotation.count({ where: { tenant_id: ctx.tenantId }});
  const quotation_number = `QT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

  const quotation = await db.tdb.Quotation.create({
    data: {
      tenant_id: ctx.tenantId,
      quotation_number,
      opportunity_id: opp.id,
      customer_id: opp.customer_id,
      customer_contact_id: opp.primary_contact_id,
      customer_site_id: opp.site_id,
      title: `Quote for ${opp.name}`,
      created_by: ctx.userId,
      updated_by: ctx.userId,
      revisions: {
        create: {
          tenant_id: ctx.tenantId,
          revision_number: 1,
          status: "DRAFT",
          title: `Quote for ${opp.name}`,
          customer_name_snapshot: opp.customer.name,
          customer_address_snapshot: opp.customer.billing_address,
          customer_gstin_snapshot: opp.customer.tax_id,
          currency_id: curr.id,
          currency_code_snapshot: curr.code,
          currency_name_snapshot: curr.name,
          currency_symbol_snapshot: curr.symbol,
          currency_decimal_places_snapshot: curr.decimal_places,
          subtotal: 0,
          total_cost: 0,
          total_selling_price: 0,
          total_tax: 0,
          grand_total: 0,
          created_by: ctx.userId
        }
      }
    },
    include: { revisions: true }
  });

  await db.tdb.Quotation.update({
    where: { id: quotation.id },
    data: { current_revision_id: quotation.revisions[0].id }
  });

  await logAudit("QUOTATION_CREATED", "Quotation", quotation.id, null);
  return await getQuotation(quotation.id);
}

export async function createQuotationFromBOQ(boq_id: string, boq_revision_id: string, currency_id: string) {
  await requirePermission("quotation.create");
  const ctx = await getTenantContext();
  const db = await getQDb();

  const boq = await db.tdb.BOQ.findUnique({
    where: { id: boq_id, tenant_id: ctx.tenantId }
  });
  if (!boq) throw new Error("BOQ not found");

  const rev = await db.tdb.BOQRevision.findUnique({
    where: { id: boq_revision_id, tenant_id: ctx.tenantId, boq_id: boq.id },
    include: { lines: { orderBy: { line_number: 'asc' } } }
  });

  if (!rev) throw new Error("BOQ Revision not found");
  if (rev.status !== "APPROVED") throw new Error("Only an APPROVED BOQ revision can be converted");

  const q = await createQuotationFromOpportunity(boq.opportunity_id, currency_id);
  const qRevId = q.revisions[0].id;

  // Insert empty freeform lines for the BOQ
  const qLines = rev.lines.map((l: any, idx: number) => ({
    id: uuidv4(),
    tenant_id: ctx.tenantId,
    quotation_revision_id: qRevId,
    line_number: idx + 1,
    source_boq_line_id: l.id,
    item_type: "FREEFORM",
    product_name_snapshot: l.product_name,
    manufacturer_name_snapshot: l.manufacturer,
    model_number_snapshot: l.model_number,
    description_snapshot: l.description || l.product_name,
    specification_snapshot: l.specification,
    unit_snapshot: l.unit,
    quantity: new Decimal(l.quantity).toNumber(),
    currency_id: currency_id,
    currency_code_snapshot: q.revisions[0].currency_code_snapshot,
    unit_vendor_cost: 0,
    unit_landed_cost: 0,
    total_landed_cost: 0,
    unit_selling_price: 0,
    subtotal: 0,
    tax_rate: 0,
    tax_amount: 0,
    line_total: 0
  }));

  if (qLines.length > 0) {
    await db.tdb.QuotationLine.createMany({ data: qLines });
  }

  await logAudit("QUOTATION_CREATED_FROM_BOQ", "Quotation", q.id, null);
  return await getQuotation(q.id);
}

export async function addQuotationLine(revision_id: string, data: any) {
  await requirePermission("quotation.update");
  const ctx = await getTenantContext();
  const db = await getQDb();

  const rev = await db.tdb.QuotationRevision.findUnique({
    where: { id: revision_id, tenant_id: ctx.tenantId },
    include: { lines: true }
  });
  if (!rev) throw new Error("Revision not found");
  if (rev.status !== "DRAFT") throw new Error("Cannot modify an issued or superseded revision");
  if (rev.approval_status === "PENDING") throw new Error("Cannot modify a revision pending approval.");

  let lineData: any = await buildLineData(data, ctx.tenantId, db, rev);
  lineData.line_number = rev.lines.length + 1;
  lineData.quotation_revision_id = rev.id;
  lineData.tenant_id = ctx.tenantId;

  await db.tdb.QuotationLine.create({ data: lineData });
  await recalculateQuotationTotals(rev.id);
  await evaluateAndSetApprovalStatus(db.tdb.tdb, rev.id, true);
  await logAudit("QUOTATION_LINE_ADDED", "QuotationRevision", rev.id, null);
}

export async function updateQuotationLine(line_id: string, data: any) {
  await requirePermission("quotation.update");
  const ctx = await getTenantContext();
  const db = await getQDb();

  const line = await db.tdb.QuotationLine.findUnique({
    where: { id: line_id, tenant_id: ctx.tenantId },
    include: { quotationRevision: true }
  });
  if (!line) throw new Error("Line not found");
  if (line.quotationRevision.status !== "DRAFT") throw new Error("Cannot modify an issued revision");

  const updatedData: any = await buildLineData(data, ctx.tenantId, db, line.quotationRevision, line);

  await db.tdb.QuotationLine.update({
    where: { id: line.id },
    data: updatedData
  });

  await recalculateQuotationTotals(line.quotation_revision_id);
  await evaluateAndSetApprovalStatus(db.tdb.tdb, line.quotation_revision_id, true);
  await logAudit("QUOTATION_LINE_UPDATED", "QuotationLine", line.id, null);
}

export async function removeQuotationLine(line_id: string) {
  await requirePermission("quotation.update");
  const ctx = await getTenantContext();
  const db = await getQDb();

  const line = await db.tdb.QuotationLine.findUnique({
    where: { id: line_id, tenant_id: ctx.tenantId },
    include: { quotationRevision: true }
  });
  if (!line) throw new Error("Line not found");
  if (line.quotationRevision.status !== "DRAFT") throw new Error("Cannot modify an issued revision");

  await db.tdb.QuotationLine.delete({ where: { id: line.id } });

  // Re-number lines
  const lines = await db.tdb.QuotationLine.findMany({
    where: { quotation_revision_id: line.quotation_revision_id },
    orderBy: { line_number: 'asc' }
  });
  for (let i=0; i<lines.length; i++) {
    await db.tdb.QuotationLine.update({
      where: { id: lines[i].id },
      data: { line_number: i + 1 }
    });
  }

  await recalculateQuotationTotals(line.quotation_revision_id);
  await evaluateAndSetApprovalStatus(db.tdb.tdb, line.quotation_revision_id, true);
  await logAudit("QUOTATION_LINE_REMOVED", "QuotationRevision", line.quotation_revision_id, null);
}

async function buildLineData(data: any, tenantId: string, db: any, rev: any, existingLine?: any) {
  const quantity = new Decimal(data.quantity || existingLine?.quantity || 1);
  const taxRate = new Decimal(data.tax_rate || existingLine?.tax_rate || 0);

  let pName = data.product_name_snapshot || existingLine?.product_name_snapshot || "Item";
  let desc = data.description_snapshot || existingLine?.description_snapshot || "";
  let unit = data.unit_snapshot || existingLine?.unit_snapshot || "EA";

  let unit_vendor_cost = new Decimal(0);
  let total_landed_cost = new Decimal(0);
  let unit_landed_cost = new Decimal(0);
  let unit_selling_price = new Decimal(0);
  let subtotal = new Decimal(0);
  let vendorPriceId = existingLine?.vendor_price_id;
  let componentsSnapshot = existingLine?.allocated_cost_components || [];

  if (data.product_vendor_id) {
    const pv = await db.tdb.ProductVendor.findUnique({
      where: { id: data.product_vendor_id, tenant_id: tenantId },
      include: { productService: true }
    });
    if (!pv || (pv.tenant_id && pv.tenant_id !== tenantId)) throw new Error("Invalid product vendor");
    pName = pv.product?.name || "Item";

    let pServiceId = pv.product_id;
    let vId = pv.vendor_id;


    // Attempt cost calculation
    const compInput = data.components || componentsSnapshot;
    const calc = await calculateCommercialCost({
      product_vendor_id: data.product_vendor_id,
      currency_id: rev.currency_id,
      quantity: quantity.toNumber(),
      effective_date: new Date(),
      components: compInput,
      pricing_method: data.pricing_method || "MARGIN",
      target_percentage: data.target_percentage || 20
    });
    unit_vendor_cost = new Decimal(calc.base_unit_cost);
    unit_landed_cost = new Decimal(calc.landed_unit_cost);
    total_landed_cost = new Decimal(calc.landed_cost_line_total);
    unit_selling_price = new Decimal(calc.selling_price_unit);
    subtotal = new Decimal(calc.selling_price_line_total);
    vendorPriceId = calc.base_price_record_id;
    componentsSnapshot = calc.evaluated_components;

    return {
      product_service_id: pServiceId,
      vendor_id: vId,
      product_vendor_id: data.product_vendor_id,
      vendor_price_id: vendorPriceId,
      allocated_cost_components: componentsSnapshot,
      item_type: data.product_vendor_id ? "CATALOG" : "FREEFORM",
      product_name_snapshot: pName,
      description_snapshot: desc,
      unit_snapshot: unit,
      quantity: quantity.toNumber(),
      currency_id: rev.currency_id,
      currency_code_snapshot: rev.currency_code_snapshot,
      unit_vendor_cost: unit_vendor_cost.toNumber(),
      unit_landed_cost: unit_landed_cost.toNumber(),
      total_landed_cost: total_landed_cost.toNumber(),
      unit_selling_price: unit_selling_price.toNumber(),
      subtotal: subtotal.toNumber(),
      tax_rate: taxRate.toNumber(),
      tax_amount: subtotal.mul(taxRate).div(100).toDecimalPlaces(2).toNumber(),
      line_total: subtotal.mul(new Decimal(1).plus(taxRate.div(100))).toDecimalPlaces(2).toNumber(),
      notes: data.notes
    };
  } else if (existingLine) {
     // fallback if just updating quantities without product vendor mapping, assuming we can only update manual lines
     if (data.manual_unit_price !== undefined) {
         unit_selling_price = new Decimal(data.manual_unit_price);
         subtotal = unit_selling_price.mul(quantity);
     } else {
         unit_selling_price = new Decimal(existingLine.unit_selling_price);
         subtotal = unit_selling_price.mul(quantity);
         total_landed_cost = new Decimal(existingLine.total_landed_cost);
         unit_landed_cost = new Decimal(existingLine.unit_landed_cost);
         unit_vendor_cost = new Decimal(existingLine.unit_vendor_cost);
     }
  } else {
     if (data.manual_unit_price !== undefined) {
       unit_selling_price = new Decimal(data.manual_unit_price);
       subtotal = unit_selling_price.mul(quantity);
     }
  }

  // rounding to currency places
  const dp = rev.currency_decimal_places_snapshot;
  subtotal = subtotal.toDP(dp, Decimal.ROUND_HALF_UP);
  const tax_amount = subtotal.mul(taxRate).div(100).toDP(dp, Decimal.ROUND_HALF_UP);
  const line_total = subtotal.add(tax_amount);

  return {
    item_type: data.item_type || existingLine?.item_type || "FREEFORM",
    product_name_snapshot: pName,
    description_snapshot: desc,
    unit_snapshot: unit,
    quantity: quantity.toNumber(),
    currency_id: rev.currency_id,
    currency_code_snapshot: rev.currency_code_snapshot,
    vendor_price_id: vendorPriceId,
    unit_vendor_cost: unit_vendor_cost.toNumber(),
    allocated_cost_components: componentsSnapshot,
    unit_landed_cost: unit_landed_cost.toNumber(),
    total_landed_cost: total_landed_cost.toNumber(),
    unit_selling_price: unit_selling_price.toNumber(),
    subtotal: subtotal.toNumber(),
    tax_rate: taxRate.toNumber(),
    tax_amount: tax_amount.toNumber(),
    line_total: line_total.toNumber(),
    notes: data.notes || existingLine?.notes
  };
}

async function recalculateQuotationTotals(revision_id: string) {
  const db = await getQDb();
  const rev = await db.tdb.QuotationRevision.findUnique({
    where: { id: revision_id },
    include: { lines: true }
  });
  if (!rev) return;

  const dp = rev.currency_decimal_places_snapshot;

  let rSubtotal = new Decimal(0);
  let rCost = new Decimal(0);
  let rTax = new Decimal(0);

  for (const l of rev.lines) {
    rSubtotal = rSubtotal.add(l.subtotal);
    rCost = rCost.add(l.total_landed_cost);
    rTax = rTax.add(l.tax_amount);
  }

  rSubtotal = rSubtotal.toDP(dp, Decimal.ROUND_HALF_UP);
  rCost = rCost.toDP(dp, Decimal.ROUND_HALF_UP);
  rTax = rTax.toDP(dp, Decimal.ROUND_HALF_UP);
  const rGrand = rSubtotal.add(rTax);

  await db.tdb.QuotationRevision.update({
    where: { id: revision_id },
    data: {
      subtotal: rSubtotal.toNumber(),
      total_cost: rCost.toNumber(),
      total_selling_price: rSubtotal.toNumber(),
      total_tax: rTax.toNumber(),
      grand_total: rGrand.toNumber()
    }
  });
}

export async function issueQuotation(revision_id: string) {
  await requirePermission("quotation.issue");
  const ctx = await getTenantContext();
  const db = await getQDb();

  const rev = await db.tdb.QuotationRevision.findUnique({
    where: { id: revision_id, tenant_id: ctx.tenantId },
    include: { quotation: true }
  });
  if (!rev) throw new Error("Revision not found");
  if (rev.status !== "DRAFT") throw new Error("Only draft revisions can be issued");

  const settingsModel = db.tdb.QuotationApprovalSettings || db.tdb.quotationApprovalSettings;
  if (settingsModel) {
    const settings = await settingsModel.findUnique({ where: { tenant_id: ctx.tenantId } });
    if (settings && settings.is_approval_enabled) {
      if (rev.approval_status === "PENDING" || rev.approval_status === "RETURNED" || rev.approval_status === "REJECTED" || rev.approval_status === "REQUIRED") {
        throw new Error(`Cannot issue quotation. Approval status is ${rev.approval_status}`);
      }
    }
  }

  await db.tdb.$transaction(async (tx: any) => {
    const qRev = tx.QuotationRevision || tx.quotationRevision;
    const q = tx.Quotation || tx.quotation;

    await qRev.update({
      where: { id: revision_id },
      data: {
        status: "ISSUED",
        issue_date: new Date(),
        issued_by: ctx.userId,
        issued_at: new Date()
      }
    });

    await q.update({
      where: { id: rev.quotation_id },
      data: { status: "ISSUED", updated_by: ctx.userId }
    });
  });

  await logAudit("QUOTATION_ISSUED", "QuotationRevision", revision_id, null);
}

export async function createQuotationRevision(quotation_id: string) {
  await requirePermission("quotation.revise");
  const ctx = await getTenantContext();
  const db = await getQDb();

  const quote = await db.tdb.Quotation.findUnique({
    where: { id: quotation_id, tenant_id: ctx.tenantId },
    include: { revisions: { orderBy: { revision_number: 'desc' } } }
  });

  if (!quote) throw new Error("Quotation not found");
  if (!quote.current_revision_id) throw new Error("No current revision");

  const currentRev = quote.revisions.find((r: any) => r.id === quote.current_revision_id);
  if (!currentRev) throw new Error("Current revision missing");

  if (currentRev.status === "DRAFT") throw new Error("Cannot create a new revision while a draft revision exists");

  const newRevNum = quote.revisions[0].revision_number + 1;

  const lines = await db.tdb.QuotationLine.findMany({
    where: { quotation_revision_id: currentRev.id }
  });

  const newRev = await db.tdb.$transaction(async (tx: any) => {
    const qRev = tx.QuotationRevision || tx.quotationRevision;
    const qLine = tx.QuotationLine || tx.quotationLine;
    const q = tx.Quotation || tx.quotation;

    if (currentRev.status === "ISSUED") {
      await qRev.update({
        where: { id: currentRev.id },
        data: { status: "SUPERSEDED" }
      });
    }

    const created = await qRev.create({
      data: {
        tenant_id: ctx.tenantId,
        quotation_id: quote.id,
        revision_number: newRevNum,
        status: "DRAFT",
        title: currentRev.title,
        customer_name_snapshot: currentRev.customer_name_snapshot,
        customer_address_snapshot: currentRev.customer_address_snapshot,
        customer_gstin_snapshot: currentRev.customer_gstin_snapshot,
        contact_name_snapshot: currentRev.contact_name_snapshot,
        contact_email_snapshot: currentRev.contact_email_snapshot,
        currency_id: currentRev.currency_id,
        currency_code_snapshot: currentRev.currency_code_snapshot,
        currency_name_snapshot: currentRev.currency_name_snapshot,
        currency_symbol_snapshot: currentRev.currency_symbol_snapshot,
        currency_decimal_places_snapshot: currentRev.currency_decimal_places_snapshot,
        valid_until: currentRev.valid_until,
        payment_terms: currentRev.payment_terms,
        delivery_terms: currentRev.delivery_terms,
        warranty_terms: currentRev.warranty_terms,
        general_terms: currentRev.general_terms,
        notes: currentRev.notes,
        subtotal: currentRev.subtotal,
        total_cost: currentRev.total_cost,
        total_selling_price: currentRev.total_selling_price,
        total_tax: currentRev.total_tax,
        grand_total: currentRev.grand_total,
        created_by: ctx.userId
      }
    });

    const newLines = lines.map((l: any) => ({
      ...l,
      id: uuidv4(),
      quotation_revision_id: created.id
    }));

    if (newLines.length > 0) {
      await qLine.createMany({ data: newLines });
    }

    await q.update({
      where: { id: quote.id },
      data: {
        current_revision_id: created.id,
        status: "DRAFT",
        updated_by: ctx.userId
      }
    });

    return created;
  });

  await logAudit("QUOTATION_REVISED", "Quotation", quote.id, `New revision ${newRevNum}`);
  return newRev;
}

export async function withdrawQuotation(revision_id: string) {
  await requirePermission("quotation.withdraw");
  const ctx = await getTenantContext();
  const db = await getQDb();

  const rev = await db.tdb.QuotationRevision.findUnique({
    where: { id: revision_id, tenant_id: ctx.tenantId },
    include: { quotation: true }
  });
  if (!rev) throw new Error("Revision not found");
  if (rev.status !== "ISSUED") throw new Error("Only issued revisions can be withdrawn");

  await db.tdb.$transaction(async (tx: any) => {
    const qRev = tx.QuotationRevision || tx.quotationRevision;
    const q = tx.Quotation || tx.quotation;

    await qRev.update({
      where: { id: revision_id },
      data: { status: "WITHDRAWN" }
    });

    await q.update({
      where: { id: rev.quotation_id },
      data: { status: "WITHDRAWN", updated_by: ctx.userId }
    });
  });

  await logAudit("QUOTATION_WITHDRAWN", "Quotation", rev.quotation_id, null);
}

export async function getQuotation(id: string) {
  await requirePermission("quotation.view");
  const ctx = await getTenantContext();
  const db = await getQDb();

  return await db.tdb.Quotation.findUnique({
    where: { id, tenant_id: ctx.tenantId },
    include: {
      customer: true,
      opportunity: true,
      currentRevision: { include: { lines: { orderBy: { line_number: 'asc' } } } },
      revisions: { orderBy: { revision_number: 'desc' } }
    }
  });
}

export async function getQuotationRevision(id: string) {
  await requirePermission("quotation.view");
  const ctx = await getTenantContext();
  const db = await getQDb();

  return await db.tdb.QuotationRevision.findUnique({
    where: { id, tenant_id: ctx.tenantId },
    include: {
      quotation: { include: { customer: true, opportunity: true } },
      lines: { orderBy: { line_number: 'asc' } }
    }
  });
}

export async function listQuotations() {
  await requirePermission("quotation.view");
  const ctx = await getTenantContext();
  const db = await getQDb();

  return await db.tdb.Quotation.findMany({
    where: { tenant_id: ctx.tenantId },
    include: {
      customer: true,
      opportunity: true,
      currentRevision: true
    },
    orderBy: { created_at: 'desc' }
  });
}
