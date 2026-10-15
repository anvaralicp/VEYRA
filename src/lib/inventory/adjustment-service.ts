/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { getTenantDb } from "../db/tenant-db";
import { Decimal } from "decimal.js";
import { getStockBalance } from "./goods-receipt-service";
import {  } from "../../prisma/contract";
import {  } from "../../prisma/contract";
import { logAudit as auditLog } from "../audit/logger";

async function getInvDb() {
  const tdb: any = await getTenantDb();
  return tdb.inventory;
}

async function getProdDb() {
  const tdb: any = await getTenantDb();
  return tdb.commercial;
}

export async function createManualAdjustment(data: {
  stock_location_id: string;
  product_service_id: string;
  adjustment_type: string;
  quantity_delta: string | number;
  reason: string;
}) {
  await requirePermission("inventory.adjustment.create");
  const ctx = await getTenantContext();
  const db = await getInvDb();
  const pDb = await getProdDb();

  const product = await pDb.ProductService.findUnique({
    where: { id: data.product_service_id, tenant_id: ctx.tenantId }
  });
  if (!product?.is_stockable) throw new Error("Cannot adjust non-stockable products");

  if (!data.reason) throw new Error("Reason is required for adjustments");

  const adjustment_number = `ADJ-${Date.now()}`;

  return await db.InventoryAdjustment.create({
    data: {
      tenant_id: ctx.tenantId,
      adjustment_number,
      stock_location_id: data.stock_location_id,
      product_service_id: data.product_service_id,
      adjustment_type: data.adjustment_type,
      quantity_delta: new Decimal(data.quantity_delta),
      reason: data.reason,
      status: "DRAFT",
      requested_by: ctx.userId
    }
  });
}

export async function postAdjustment(adjustmentId: string, tx?: any) {
  const db = tx || getInvDb();
  const ctx = await getTenantContext();

  const adjustment = await db.InventoryAdjustment.findUnique({
    where: { id: adjustmentId, tenant_id: ctx.tenantId },
    include: { stockCountLine: true }
  });

  if (!adjustment) throw new Error("Adjustment not found");
  if (adjustment.status === "POSTED") throw new Error("Adjustment is already posted");

  const pDb = await getProdDb();
  const product = await pDb.ProductService.findUnique({
    where: { id: adjustment.product_service_id, tenant_id: ctx.tenantId }
  });
  if (!product?.is_stockable) throw new Error("Cannot adjust non-stockable products");

  // Check staleness if derived from stock count
  if (adjustment.stockCountLine) {
    const expectedThen = new Decimal(adjustment.stockCountLine.expected_quantity);
    const expectedNow = await getStockBalance(adjustment.product_service_id, adjustment.stock_location_id);

    // Determine if ledger changed since count
    // In Veyra, ledger is an append-only log. We can sum movements strictly after the snapshot date.
    const movementsSince = await db.InventoryLedger.aggregate({
      where: {
        tenant_id: ctx.tenantId,
        stock_location_id: adjustment.stock_location_id,
        product_service_id: adjustment.product_service_id,
        created_at: { gt: adjustment.stockCountLine.snapshot_date }
      },
      _sum: { quantity_delta: true }
    });

    const deltaSince = new Decimal(movementsSince._sum.quantity_delta || 0);

    if (!deltaSince.isZero()) {
      throw new Error(`Stale count: Inventory changed by ${deltaSince.toString()} since the snapshot was taken.`);
    }
  }

  // Atomically mark posted and create ledger entry
  const [updated, ledger] = await Promise.all([
    db.InventoryAdjustment.update({
      where: { id: adjustment.id },
      data: {
        status: "POSTED",
        posted_by: ctx.userId,
        posted_at: new Date()
      }
    }),
    db.InventoryLedger.create({
      data: {
        tenant_id: ctx.tenantId,
        stock_location_id: adjustment.stock_location_id,
        product_service_id: adjustment.product_service_id,
        movement_type: "ADJUSTMENT",
        quantity_delta: adjustment.quantity_delta,
        inventory_adjustment_id: adjustment.id,
        actor_id: ctx.userId,
        reason: adjustment.reason,
        movement_date: new Date()
      }
    })
  ]);

  await auditLog("INVENTORY_ADJUSTMENT_POSTED", "inventory_adjustment", adjustment.id, {
    delta: adjustment.quantity_delta.toString()
  });

  return updated;
}

export async function postAdjustmentAtomic(adjustmentId: string) {
  await requirePermission("inventory.adjustment.post");
  const tdb: any = await getTenantDb();
  return await tdb.$transaction(async (tx: any) => {
    return await postAdjustment(adjustmentId, tx);
  });
}

export async function createAndPostAdjustmentsForStockCount(stockCountId: string) {
  await requirePermission("inventory.adjustment.post");
  const ctx = await getTenantContext();
  const db = await getInvDb();

  const count = await db.StockCount.findUnique({
    where: { id: stockCountId, tenant_id: ctx.tenantId },
    include: { lines: true }
  });

  if (!count) throw new Error("Stock count not found");
  if (count.status !== "SUBMITTED") throw new Error("Count must be SUBMITTED to post adjustments");

  const tdb: any = await getTenantDb();
  return await tdb.$transaction(async (tx: any) => {
    const txDb = tx.inventory;

    for (const line of count.lines) {
      const variance = new Decimal(line.variance);
      if (variance.isZero()) continue;

      // Create adjustment
      const adj = await txDb.InventoryAdjustment.create({
        data: {
          tenant_id: ctx.tenantId,
          adjustment_number: `ADJ-CNT-${line.id.substring(0, 8)}`,
          stock_location_id: count.stock_location_id,
          product_service_id: line.product_service_id,
          adjustment_type: "COUNT_VARIANCE",
          quantity_delta: variance,
          reason: line.reason || "Count variance",
          status: "DRAFT",
          stock_count_id: count.id,
          stock_count_line_id: line.id,
          requested_by: count.created_by
        }
      });

      // Post adjustment immediately using transaction
      await postAdjustment(adj.id, txDb);
    }

    // Mark count as POSTED
    await txDb.StockCount.update({
      where: { id: count.id },
      data: {
        status: "POSTED",
        posted_by: ctx.userId,
        posted_at: new Date()
      }
    });

    await auditLog("STOCK_COUNT_POSTED", "inventory_count", count.id, {});
  });
}
