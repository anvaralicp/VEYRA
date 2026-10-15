/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";
import Decimal from "decimal.js";
import { randomUUID } from "crypto";

async function getFulfilmentDb() {
  const tdb: any = await getTenantDb();
  return {
    FulfilmentOrder: tdb.tdb.FulfilmentOrder || tdb.tdb.fulfilmentOrder,
    FulfilmentOrderLine: tdb.tdb.FulfilmentOrderLine || tdb.tdb.fulfilmentOrderLine,
    FulfilmentOrderStatusHistory: tdb.tdb.FulfilmentOrderStatusHistory || tdb.tdb.fulfilmentOrderStatusHistory,
    CustomerPurchaseOrder: tdb.tdb.CustomerPurchaseOrder || tdb.tdb.customerPurchaseOrder,
    tdb: tdb.tdb
  };
}

export async function createFulfilmentOrderFromCustomerPO(poId: string) {
  await requirePermission("fulfilment.create");
  const ctx = await getTenantContext();
  const db = await getFulfilmentDb();

  const po = await db.CustomerPurchaseOrder.findUnique({
    where: { id: poId, tenant_id: ctx.tenantId },
    include: { lines: true }
  });

  if (!po) throw new Error("Customer PO not found");
  if (po.status !== "VALIDATED") throw new Error("Only VALIDATED Customer POs can be converted to Fulfilment Orders");

  const existingOrder = await db.FulfilmentOrder.findUnique({
    where: { customer_purchase_order_id: poId }
  });

  if (existingOrder) throw new Error("Fulfilment order already exists for this Customer PO");

  const orderNumber = "FO-" + Math.floor(Math.random() * 1000000); // Simple number generator

  const order = await db.tdb.$transaction(async (tx: any) => {
    const FO = tx.FulfilmentOrder || tx.fulfilmentOrder;
    const FOL = tx.FulfilmentOrderLine || tx.fulfilmentOrderLine;
    const FOSH = tx.FulfilmentOrderStatusHistory || tx.fulfilmentOrderStatusHistory;

    const newOrder = await FO.create({
      data: {
        tenant_id: ctx.tenantId,
        order_number: orderNumber,
        customer_purchase_order_id: poId,
        customer_id: po.customer_id,
        quotation_revision_id: po.quotation_revision_id,
        status: "OPEN",
        created_by: ctx.userId,
        updated_by: ctx.userId
      }
    });

    for (const line of po.lines) {
      await FOL.create({
        data: {
          tenant_id: ctx.tenantId,
          fulfilment_order_id: newOrder.id,
          customer_purchase_order_line_id: line.id,
          quotation_line_id: line.quotation_line_id,
          item_code_snapshot: line.customer_item_code,
          item_description_snapshot: line.customer_item_description || "Unknown item",
          unit_of_measure: line.unit_of_measure,
          accepted_quantity: line.quantity,
          planned_quantity: line.quantity
        }
      });
    }

    await FOSH.create({
      data: {
        tenant_id: ctx.tenantId,
        fulfilment_order_id: newOrder.id,
        previous_status: "NONE",
        new_status: "OPEN",
        actor_id: ctx.userId,
        reason: "Created from Customer PO"
      }
    });

    return newOrder;
  });

  await logAudit("FULFILMENT_ORDER_CREATED", "FulfilmentOrder", order.id, null);
  return order;
}

export async function updateFulfilmentPlanning(orderId: string, data: any) {
  await requirePermission("fulfilment.plan");
  const ctx = await getTenantContext();
  const db = await getFulfilmentDb();

  const order = await db.FulfilmentOrder.findUnique({
    where: { id: orderId, tenant_id: ctx.tenantId }
  });

  if (!order) throw new Error("Fulfilment order not found");
  if (order.status === "CANCELLED") throw new Error("Cannot modify a cancelled order");

  const updated = await db.FulfilmentOrder.update({
    where: { id: orderId },
    data: {
      customer_site_id: data.customer_site_id !== undefined ? data.customer_site_id : order.customer_site_id,
      target_date: data.target_date ? new Date(data.target_date) : order.target_date,
      responsible_user_id: data.responsible_user_id !== undefined ? data.responsible_user_id : order.responsible_user_id,
      notes: data.notes !== undefined ? data.notes : order.notes,
      updated_by: ctx.userId
    }
  });

  await logAudit("FULFILMENT_ORDER_PLANNING_UPDATED", "FulfilmentOrder", orderId, null);
  return updated;
}

export async function updateFulfilmentOrderLinePlanning(lineId: string, data: any) {
  await requirePermission("fulfilment.plan");
  const ctx = await getTenantContext();
  const db = await getFulfilmentDb();

  const line = await db.FulfilmentOrderLine.findUnique({
    where: { id: lineId, tenant_id: ctx.tenantId },
    include: { fulfilmentOrder: true }
  });

  if (!line) throw new Error("Fulfilment order line not found");
  if (line.fulfilmentOrder.status === "CANCELLED") throw new Error("Cannot modify a cancelled order");

  const updated = await db.FulfilmentOrderLine.update({
    where: { id: lineId },
    data: {
      planned_quantity: data.planned_quantity !== undefined ? data.planned_quantity : line.planned_quantity,
      notes: data.notes !== undefined ? data.notes : line.notes,
    }
  });

  await logAudit("FULFILMENT_ORDER_LINE_PLANNING_UPDATED", "FulfilmentOrderLine", lineId, null);
  return updated;
}

async function changeOrderStatus(orderId: string, newStatus: string, allowedPrevious: string[], permission: string, reason?: string) {
  await requirePermission(permission);
  const ctx = await getTenantContext();
  const db = await getFulfilmentDb();

  const order = await db.FulfilmentOrder.findUnique({
    where: { id: orderId, tenant_id: ctx.tenantId },
    include: { lines: true }
  });

  if (!order) throw new Error("Fulfilment order not found");
  if (!allowedPrevious.includes(order.status)) {
    throw new Error(`Invalid state transition from ${order.status} to ${newStatus}`);
  }

  if (newStatus === "READY") {
    // Readiness checks
    if (!order.responsible_user_id) throw new Error("A responsible user must be assigned before marking ready");
    if (!order.target_date) throw new Error("A target date must be set before marking ready");
    if (order.lines.length === 0) throw new Error("Order must have at least one line to be ready");
    for (const line of order.lines) {
      if (new Decimal(line.planned_quantity).lessThanOrEqualTo(0)) {
        throw new Error("Planned quantities must be greater than zero");
      }
    }
  }

  if (newStatus === "CANCELLED" && !reason) {
    throw new Error("A reason must be provided when cancelling a fulfilment order");
  }

  await db.tdb.$transaction(async (tx: any) => {
    const FO = tx.FulfilmentOrder || tx.fulfilmentOrder;
    const FOSH = tx.FulfilmentOrderStatusHistory || tx.fulfilmentOrderStatusHistory;

    await FO.update({
      where: { id: orderId },
      data: { status: newStatus, updated_by: ctx.userId }
    });

    await FOSH.create({
      data: {
        tenant_id: ctx.tenantId,
        fulfilment_order_id: orderId,
        previous_status: order.status,
        new_status: newStatus,
        actor_id: ctx.userId,
        reason: reason || null
      }
    });
  });

  const eventName = `FULFILMENT_ORDER_${newStatus === 'READY' ? 'MARKED_READY' : (newStatus === 'ON_HOLD' ? 'HELD' : (newStatus === 'OPEN' ? 'RESUMED' : newStatus))}`;
  await logAudit(eventName, "FulfilmentOrder", orderId, null);
}

export async function markFulfilmentPlanning(orderId: string) {
  return changeOrderStatus(orderId, "PLANNING", ["OPEN", "READY", "ON_HOLD"], "fulfilment.plan");
}

export async function markFulfilmentReady(orderId: string) {
  return changeOrderStatus(orderId, "READY", ["OPEN", "PLANNING", "ON_HOLD"], "fulfilment.mark_ready");
}

export async function holdFulfilmentOrder(orderId: string, reason: string) {
  return changeOrderStatus(orderId, "ON_HOLD", ["OPEN", "PLANNING", "READY"], "fulfilment.hold", reason);
}

export async function resumeFulfilmentOrder(orderId: string) {
  return changeOrderStatus(orderId, "OPEN", ["ON_HOLD"], "fulfilment.update");
}

export async function cancelFulfilmentOrder(orderId: string, reason: string) {
  return changeOrderStatus(orderId, "CANCELLED", ["OPEN", "PLANNING", "READY", "ON_HOLD"], "fulfilment.cancel", reason);
}
