/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";
import Decimal from "decimal.js";

async function getProcDb() {
  const tdb: any = await getTenantDb();
  return {
    SPO: tdb.tdb.SupplierPurchaseOrder || tdb.tdb.supplierPurchaseOrder,
    SPOLine: tdb.tdb.SupplierPurchaseOrderLine || tdb.tdb.supplierPurchaseOrderLine,
    Alloc: tdb.tdb.FulfilmentAllocation || tdb.tdb.fulfilmentAllocation,
    Hist: tdb.tdb.SupplierOrderStatusHistory || tdb.tdb.supplierOrderStatusHistory,
    Vendor: tdb.tdb.Vendor || tdb.tdb.vendor,
    FO: tdb.tdb.FulfilmentOrder || tdb.tdb.fulfilmentOrder,
    FOLine: tdb.tdb.FulfilmentOrderLine || tdb.tdb.fulfilmentOrderLine,
    VendorPrice: tdb.tdb.VendorPrice || tdb.tdb.vendorPrice,
    tdb: tdb.tdb
  };
}

function calculatePOHeaderTotals(lines: any[]) {
  let subtotal = new Decimal(0);
  let taxTotal = new Decimal(0);
  let grandTotal = new Decimal(0);

  for (const line of lines) {
    const lQty = new Decimal(line.quantity || 0);
    const lPrice = new Decimal(line.unit_price || 0);
    const lTaxRate = new Decimal(line.tax_rate || 0);

    const lSub = lQty.mul(lPrice).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const lTax = lSub.mul(lTaxRate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const lTot = lSub.plus(lTax);

    subtotal = subtotal.plus(lSub);
    taxTotal = taxTotal.plus(lTax);
    grandTotal = grandTotal.plus(lTot);
  }

  return { subtotal, taxTotal, grandTotal };
}

export async function createSupplierPurchaseOrder(data: { vendor_id: string, currency_id: string, expected_date?: string, delivery_destination?: string }) {
  await requirePermission("procurement.create");
  const ctx = await getTenantContext();
  const db = await getProcDb();

  const vendor = await db.Vendor.findUnique({ where: { id: data.vendor_id, tenant_id: ctx.tenantId } });
  if (!vendor || vendor.status !== 'ACTIVE') throw new Error("Vendor is not active or not found");

  const poNumber = "SPO-" + Math.floor(Math.random() * 1000000);

  const spo = await db.SPO.create({
    data: {
      tenant_id: ctx.tenantId,
      po_number: poNumber,
      vendor_id: data.vendor_id,
      currency_id: data.currency_id,
      expected_date: data.expected_date ? new Date(data.expected_date) : null,
      delivery_destination: data.delivery_destination,
      status: "DRAFT",
      created_by: ctx.userId,
      updated_by: ctx.userId
    }
  });

  await logAudit("SUPPLIER_PO_CREATED", "SupplierPurchaseOrder", spo.id, null);
  return spo;
}

export async function addSupplierPurchaseOrderLine(spoId: string, data: {
  product_service_id?: string,
  vendor_price_id?: string,
  item_description_snapshot: string,
  unit_of_measure: string,
  quantity: number | string,
  unit_price: number | string,
  tax_rate: number | string,
  vendor_part_number_snapshot?: string,
  fulfilment_order_line_id?: string
}) {
  await requirePermission("procurement.update");
  const ctx = await getTenantContext();
  const db = await getProcDb();

  const spo = await db.SPO.findUnique({ where: { id: spoId, tenant_id: ctx.tenantId }, include: { lines: true } });
  if (!spo) throw new Error("Supplier PO not found");
  if (spo.status !== "DRAFT") throw new Error("Can only modify DRAFT supplier POs");

  const qty = new Decimal(data.quantity);
  const price = new Decimal(data.unit_price);
  const taxRate = new Decimal(data.tax_rate || 0);

  if (qty.lessThanOrEqualTo(0)) throw new Error("Quantity must be greater than zero");
  if (price.lessThan(0)) throw new Error("Unit price cannot be negative");

  // Vendor pricing validation
  if (data.vendor_price_id) {
    const vp = await db.VendorPrice.findUnique({ where: { id: data.vendor_price_id, tenant_id: ctx.tenantId }, include: { productVendor: true } });
    if (!vp) throw new Error("Vendor price not found");
    if (vp.productVendor.vendor_id !== spo.vendor_id) throw new Error("Vendor price belongs to a different vendor");
    if (vp.currency_id !== spo.currency_id) throw new Error("Vendor price currency does not match PO currency");

    // Check quantity breaks
    if (vp.min_quantity && qty.lessThan(vp.min_quantity)) throw new Error("Quantity does not meet minimum for this price");

    // Check expiry
    const now = new Date();
    if (vp.valid_to && new Date(vp.valid_to) < now) throw new Error("Vendor price is expired");
  }

  const lineSubtotal = qty.mul(price).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const lineTaxAmount = lineSubtotal.mul(taxRate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const lineTotal = lineSubtotal.plus(lineTaxAmount);

  const res = await db.tdb.$transaction(async (tx: any) => {
    const SPOL = tx.SupplierPurchaseOrderLine || tx.supplierPurchaseOrderLine;
    const SPOHeader = tx.SupplierPurchaseOrder || tx.supplierPurchaseOrder;
    const Alloc = tx.FulfilmentAllocation || tx.fulfilmentAllocation;
    const FOLine = tx.FulfilmentOrderLine || tx.fulfilmentOrderLine;
    const FOHeader = tx.FulfilmentOrder || tx.fulfilmentOrder;

    let foLineData = null;
    if (data.fulfilment_order_line_id) {
      foLineData = await FOLine.findUnique({
        where: { id: data.fulfilment_order_line_id, tenant_id: ctx.tenantId },
        include: { fulfilmentOrder: true }
      });
      if (!foLineData) throw new Error("Fulfilment line not found");

      // Calculate existing allocations
      const existingAllocs = await Alloc.findMany({ where: { fulfilment_order_line_id: data.fulfilment_order_line_id } });
      const currentAllocated = existingAllocs.reduce((acc: any, a: any) => acc.plus(new Decimal(a.allocated_quantity)), new Decimal(0));
      const remaining = new Decimal(foLineData.planned_quantity).minus(currentAllocated);

      if (qty.greaterThan(remaining)) {
        throw new Error(`Allocated quantity ${qty} exceeds remaining planned quantity ${remaining}`);
      }
    }

    const newLine = await SPOL.create({
      data: {
        tenant_id: ctx.tenantId,
        supplier_purchase_order_id: spoId,
        product_service_id: data.product_service_id || null,
        vendor_price_id: data.vendor_price_id || null,
        item_description_snapshot: data.item_description_snapshot,
        vendor_part_number_snapshot: data.vendor_part_number_snapshot || null,
        unit_of_measure: data.unit_of_measure,
        quantity: qty,
        unit_price: price,
        tax_rate: taxRate,
        tax_amount: lineTaxAmount,
        line_total: lineTotal
      }
    });

    if (foLineData) {
      await Alloc.create({
        data: {
          tenant_id: ctx.tenantId,
          fulfilment_order_id: foLineData.fulfilment_order_id,
          fulfilment_order_line_id: data.fulfilment_order_line_id,
          supplier_purchase_order_line_id: newLine.id,
          allocated_quantity: qty
        }
      });
    }

    const allLines = [...spo.lines, newLine];
    const { subtotal, taxTotal, grandTotal } = calculatePOHeaderTotals(allLines);

    await SPOHeader.update({
      where: { id: spoId },
      data: {
        subtotal: subtotal,
        tax_total: taxTotal,
        grand_total: grandTotal,
        updated_by: ctx.userId
      }
    });

    return newLine;
  });

  await logAudit("SUPPLIER_PO_UPDATED", "SupplierPurchaseOrder", spoId, null);
  return res;
}

async function changeSPOStatus(spoId: string, newStatus: string, allowedPrevious: string[], permission: string, requireApprover: boolean = false) {
  await requirePermission(permission);
  const ctx = await getTenantContext();
  const db = await getProcDb();

  const spo = await db.SPO.findUnique({
    where: { id: spoId, tenant_id: ctx.tenantId }
  });

  if (!spo) throw new Error("Supplier PO not found");
  if (!allowedPrevious.includes(spo.status)) {
    throw new Error(`Invalid state transition from ${spo.status} to ${newStatus}`);
  }

  if (requireApprover && spo.created_by === ctx.userId) {
    throw new Error("Creator cannot approve their own Supplier PO (separation of duties)");
  }

  const updateData: any = { status: newStatus, updated_by: ctx.userId };
  if (newStatus === 'PENDING_APPROVAL') updateData.submitted_at = new Date();
  if (newStatus === 'APPROVED') updateData.approved_at = new Date();
  if (newStatus === 'ISSUED') updateData.issued_at = new Date();
  if (newStatus === 'ACKNOWLEDGED') updateData.acknowledged_at = new Date();

  await db.tdb.$transaction(async (tx: any) => {
    const SPOHeader = tx.SupplierPurchaseOrder || tx.supplierPurchaseOrder;
    const Hist = tx.SupplierOrderStatusHistory || tx.supplierOrderStatusHistory;

    await SPOHeader.update({
      where: { id: spoId },
      data: updateData
    });

    await Hist.create({
      data: {
        tenant_id: ctx.tenantId,
        supplier_purchase_order_id: spoId,
        previous_status: spo.status,
        new_status: newStatus,
        actor_id: ctx.userId
      }
    });
  });

  const eventMap: Record<string, string> = {
    'PENDING_APPROVAL': 'SUPPLIER_PO_SUBMITTED_FOR_APPROVAL',
    'APPROVED': 'SUPPLIER_PO_APPROVED',
    'ISSUED': 'SUPPLIER_PO_ISSUED',
    'ACKNOWLEDGED': 'SUPPLIER_PO_ACKNOWLEDGED',
    'ON_HOLD': 'SUPPLIER_PO_HELD',
    'CANCELLED': 'SUPPLIER_PO_CANCELLED',
    'CLOSED': 'SUPPLIER_PO_CLOSED',
    'DRAFT': 'SUPPLIER_PO_RESUMED' // If returned to draft or resumed from hold
  };

  await logAudit(eventMap[newStatus] || "SUPPLIER_PO_UPDATED", "SupplierPurchaseOrder", spoId, null);
}

export async function submitSupplierPOForApproval(spoId: string) {
  return changeSPOStatus(spoId, "PENDING_APPROVAL", ["DRAFT", "ON_HOLD"], "procurement.submit");
}

export async function approveSupplierPO(spoId: string) {
  return changeSPOStatus(spoId, "APPROVED", ["PENDING_APPROVAL"], "procurement.approve", true);
}

export async function issueSupplierPO(spoId: string) {
  return changeSPOStatus(spoId, "ISSUED", ["APPROVED", "DRAFT"], "procurement.issue"); // Allow DRAFT -> ISSUED if approval not mandatory
}

export async function acknowledgeSupplierPO(spoId: string) {
  return changeSPOStatus(spoId, "ACKNOWLEDGED", ["ISSUED"], "procurement.acknowledge");
}

export async function cancelSupplierPO(spoId: string, reason: string) {
  if (!reason) throw new Error("A reason must be provided when cancelling");
  return changeSPOStatus(spoId, "CANCELLED", ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ON_HOLD"], "procurement.cancel");
}

export async function getPrintableSupplierPO(spoId: string) {
  await requirePermission("procurement.view");
  const ctx = await getTenantContext();
  const db = await getProcDb();

  const spo = await db.SPO.findUnique({
    where: { id: spoId, tenant_id: ctx.tenantId },
    include: {
      vendor: true,
      currency: true,
      lines: true
    }
  });

  if (!spo) throw new Error("Supplier PO not found");

  // Return a filtered subset for printing that excludes internal notes
  return {
    po_number: spo.po_number,
    status: spo.status,
    order_date: spo.order_date,
    expected_date: spo.expected_date,
    delivery_destination: spo.delivery_destination,
    payment_terms: spo.payment_terms,
    delivery_terms: spo.delivery_terms,
    vendor_notes: spo.vendor_notes,
    subtotal: spo.subtotal,
    tax_total: spo.tax_total,
    grand_total: spo.grand_total,
    vendor: spo.vendor,
    currency: spo.currency,
    lines: spo.lines.map((l: any) => ({
      item_code: l.item_code_snapshot,
      vendor_part_number: l.vendor_part_number_snapshot,
      description: l.item_description_snapshot,
      uom: l.unit_of_measure,
      quantity: l.quantity,
      unit_price: l.unit_price,
      tax_rate: l.tax_rate,
      tax_amount: l.tax_amount,
      line_total: l.line_total,
      vendor_line_notes: l.vendor_line_notes
    }))
  };
}
