/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { getTenantDb } from "../db/tenant-db";
import { Decimal } from "decimal.js";
import { getStockBalance } from "./goods-receipt-service";

async function getInvDb() {
  const tdb: any = await getTenantDb();
  return tdb.inventory;
}

async function getProdDb() {
  const tdb: any = await getTenantDb();
  return tdb.commercial;
}

export async function createStockCount(stockLocationId: string, notes?: string) {
  await requirePermission("inventory.count.create");
  const ctx = await getTenantContext();
  const db = await getInvDb();

  // Validate location
  const location = await db.StockLocation.findUnique({
    where: { id: stockLocationId, tenant_id: ctx.tenantId }
  });

  if (!location) throw new Error("Stock location not found");
  if (!location.is_active) throw new Error("Cannot create count in inactive location");

  // Generate unique count number
  const count_number = `CNT-${Date.now()}`;

  return await db.StockCount.create({
    data: {
      tenant_id: ctx.tenantId,
      stock_location_id: stockLocationId,
      count_number,
      notes,
      created_by: ctx.userId,
      status: "DRAFT"
    }
  });
}

export async function addStockCountLine(stockCountId: string, productId: string, countedQty: string | number, reason?: string) {
  await requirePermission("inventory.count.update");
  const ctx = await getTenantContext();
  const db = await getInvDb();
  const pDb = await getProdDb();

  const count = await db.StockCount.findUnique({
    where: { id: stockCountId, tenant_id: ctx.tenantId }
  });

  if (!count) throw new Error("Stock count not found");
  if (count.status !== "DRAFT") throw new Error("Can only modify DRAFT counts");

  const product = await pDb.ProductService.findUnique({
    where: { id: productId, tenant_id: ctx.tenantId }
  });

  if (!product) throw new Error("Product not found");
  if (!product.is_stockable) throw new Error("Cannot count non-stockable products");

  const qty = new Decimal(countedQty);
  if (qty.isNegative()) throw new Error("Physical count cannot be negative");

  // Get current authoritative balance
  const expectedQty = await getStockBalance(productId, count.stock_location_id);
  const variance = qty.minus(expectedQty);

  // Check if line already exists
  const existingLine = await db.StockCountLine.findUnique({
    where: {
      tenant_id_stock_count_id_product_service_id: {
        tenant_id: ctx.tenantId,
        stock_count_id: stockCountId,
        product_service_id: productId
      }
    }
  });

  if (existingLine) {
    return await db.StockCountLine.update({
      where: { id: existingLine.id },
      data: {
        expected_quantity: expectedQty,
        counted_quantity: qty,
        variance,
        reason,
        snapshot_date: new Date()
      }
    });
  }

  return await db.StockCountLine.create({
    data: {
      tenant_id: ctx.tenantId,
      stock_count_id: stockCountId,
      product_service_id: productId,
      expected_quantity: expectedQty,
      counted_quantity: qty,
      variance,
      reason,
      snapshot_date: new Date()
    }
  });
}

export async function submitStockCount(stockCountId: string) {
  await requirePermission("inventory.count.submit");
  const ctx = await getTenantContext();
  const db = await getInvDb();

  const count = await db.StockCount.findUnique({
    where: { id: stockCountId, tenant_id: ctx.tenantId }
  });

  if (!count) throw new Error("Stock count not found");
  if (count.status !== "DRAFT") throw new Error("Count is not in DRAFT status");

  return await db.StockCount.update({
    where: { id: stockCountId },
    data: { status: "SUBMITTED" }
  });
}

export async function cancelStockCount(stockCountId: string) {
  await requirePermission("inventory.count.update");
  const ctx = await getTenantContext();
  const db = await getInvDb();

  const count = await db.StockCount.findUnique({
    where: { id: stockCountId, tenant_id: ctx.tenantId }
  });

  if (!count) throw new Error("Stock count not found");
  if (count.status === "POSTED") throw new Error("Cannot cancel a posted count");

  return await db.StockCount.update({
    where: { id: stockCountId },
    data: { status: "CANCELLED" }
  });
}
