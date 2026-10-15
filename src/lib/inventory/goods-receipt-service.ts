/* eslint-disable prefer-const, @typescript-eslint/no-explicit-any */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";
import Decimal from "decimal.js";

async function getInvDb() {
  const tdb: any = await getTenantDb();
  return {
    SPO: tdb.tdb.SupplierPurchaseOrder || tdb.tdb.supplierPurchaseOrder,
    SPOLine: tdb.tdb.SupplierPurchaseOrderLine || tdb.tdb.supplierPurchaseOrderLine,
    GR: tdb.tdb.GoodsReceipt || tdb.tdb.goodsReceipt,
    GRLine: tdb.tdb.GoodsReceiptLine || tdb.tdb.goodsReceiptLine,
    Ledger: tdb.tdb.InventoryLedger || tdb.tdb.inventoryLedger,
    StockLocation: tdb.tdb.StockLocation || tdb.tdb.stockLocation,
    ProductService: tdb.tdb.ProductService || tdb.tdb.productService,
    tdb: tdb.tdb
  };
}

export async function createGoodsReceiptFromSupplierPO(spoId: string, stockLocationId: string, deliveryNote?: string) {
  await requirePermission("goods_receipt.create");
  const ctx = await getTenantContext();
  const db = await getInvDb();

  const spo = await db.SPO.findUnique({
    where: { id: spoId, tenant_id: ctx.tenantId },
    include: { lines: true }
  });

  if (!spo) throw new Error("Supplier PO not found");
  if (spo.status !== 'ISSUED' && spo.status !== 'ACKNOWLEDGED') {
    throw new Error("Only ISSUED or ACKNOWLEDGED supplier POs can receive goods");
  }

  const loc = await db.StockLocation.findUnique({ where: { id: stockLocationId, tenant_id: ctx.tenantId } });
  if (!loc) throw new Error("Stock location not found");
  if (loc.status !== 'ACTIVE') throw new Error("Stock location is inactive");

  const receiptNumber = "GR-" + Math.floor(Math.random() * 1000000);

  const gr = await db.GR.create({
    data: {
      tenant_id: ctx.tenantId,
      receipt_number: receiptNumber,
      supplier_purchase_order_id: spoId,
      vendor_id: spo.vendor_id,
      stock_location_id: stockLocationId,
      delivery_note_reference: deliveryNote || null,
      status: "DRAFT",
      received_by: ctx.userId
    }
  });

  await logAudit("GOODS_RECEIPT_CREATED", "GoodsReceipt", gr.id, null);
  return gr;
}

export async function addGoodsReceiptLine(receiptId: string, spoLineId: string, receivedQty: string | number) {
  await requirePermission("goods_receipt.update");
  const ctx = await getTenantContext();
  const db = await getInvDb();

  const gr = await db.GR.findUnique({ where: { id: receiptId, tenant_id: ctx.tenantId } });
  if (!gr || gr.status !== 'DRAFT') throw new Error("Can only modify DRAFT receipts");

  const spoLine = await db.SPOLine.findUnique({ where: { id: spoLineId, tenant_id: ctx.tenantId } });
  if (!spoLine || spoLine.supplier_purchase_order_id !== gr.supplier_purchase_order_id) {
    throw new Error("SPO Line not found or doesn't belong to the SPO of this receipt");
  }

  const qty = new Decimal(receivedQty);
  if (qty.lessThanOrEqualTo(0)) throw new Error("Received quantity must be greater than zero");

  const line = await db.GRLine.create({
    data: {
      tenant_id: ctx.tenantId,
      goods_receipt_id: receiptId,
      supplier_purchase_order_line_id: spoLineId,
      product_service_id: spoLine.product_service_id,
      item_code_snapshot: spoLine.item_code_snapshot,
      item_description_snapshot: spoLine.item_description_snapshot,
      unit_of_measure_snapshot: spoLine.unit_of_measure,
      ordered_quantity: spoLine.quantity,
      received_quantity: qty,
      accepted_quantity: qty, // Default to accepting all
      rejected_quantity: new Decimal(0)
    }
  });

  await logAudit("GOODS_RECEIPT_UPDATED", "GoodsReceipt", receiptId, null);
  return line;
}

export async function updateGoodsReceiptLine(lineId: string, data: { received_quantity?: string | number, accepted_quantity?: string | number, rejected_quantity?: string | number, rejection_reason?: string }) {
  await requirePermission("goods_receipt.update");
  const ctx = await getTenantContext();
  const db = await getInvDb();

  const line = await db.GRLine.findUnique({ where: { id: lineId, tenant_id: ctx.tenantId }, include: { goodsReceipt: true } });
  if (!line || line.goodsReceipt.status !== 'DRAFT') throw new Error("Can only modify lines on DRAFT receipts");

  let received = new Decimal(data.received_quantity !== undefined ? data.received_quantity : line.received_quantity);
  let accepted = new Decimal(data.accepted_quantity !== undefined ? data.accepted_quantity : line.accepted_quantity);
  let rejected = new Decimal(data.rejected_quantity !== undefined ? data.rejected_quantity : line.rejected_quantity);

  if (received.lessThanOrEqualTo(0)) throw new Error("Received quantity must be greater than zero");
  if (accepted.lessThan(0)) throw new Error("Accepted quantity cannot be negative");
  if (rejected.lessThan(0)) throw new Error("Rejected quantity cannot be negative");

  if (!accepted.plus(rejected).equals(received)) {
    throw new Error("Accepted plus rejected quantities must equal received quantity");
  }

  const updatedLine = await db.GRLine.update({
    where: { id: lineId },
    data: {
      received_quantity: received,
      accepted_quantity: accepted,
      rejected_quantity: rejected,
      rejection_reason: data.rejection_reason !== undefined ? data.rejection_reason : line.rejection_reason
    }
  });

  await logAudit("GOODS_RECEIPT_UPDATED", "GoodsReceipt", line.goods_receipt_id, null);
  return updatedLine;
}

export async function postGoodsReceipt(receiptId: string) {
  await requirePermission("goods_receipt.post");
  const ctx = await getTenantContext();
  const db = await getInvDb();

  const res = await db.tdb.$transaction(async (tx: any) => {
    const GR = tx.GoodsReceipt || tx.goodsReceipt;
    const GRLine = tx.GoodsReceiptLine || tx.goodsReceiptLine;
    const Ledger = tx.InventoryLedger || tx.inventoryLedger;
    const ProductService = tx.ProductService || tx.productService;

    const gr = await GR.findUnique({
      where: { id: receiptId, tenant_id: ctx.tenantId },
      include: { lines: true }
    });

    if (!gr || gr.status !== 'DRAFT') throw new Error("Receipt not found or not DRAFT");

    // Recalculate cumulative quantities to prevent over-receipt
    for (const line of gr.lines) {
      const allLinesForSPO = await GRLine.findMany({
        where: {
          supplier_purchase_order_line_id: line.supplier_purchase_order_line_id,
          goodsReceipt: { status: 'POSTED' }
        }
      });

      const cumulativeReceived = allLinesForSPO.reduce((acc: any, curr: any) => acc.plus(new Decimal(curr.received_quantity)), new Decimal(0));
      const projectedTotal = cumulativeReceived.plus(new Decimal(line.received_quantity));

      if (projectedTotal.greaterThan(new Decimal(line.ordered_quantity))) {
        throw new Error(`Over-receipt prevented. Cumulative received ${projectedTotal} exceeds ordered ${line.ordered_quantity}`);
      }

      if (new Decimal(line.accepted_quantity).greaterThan(0) && line.product_service_id) {
        const prod = await ProductService.findUnique({ where: { id: line.product_service_id } });
        if (prod && prod.is_stockable) {
          // Create ledger entry
          await Ledger.create({
            data: {
              tenant_id: ctx.tenantId,
              stock_location_id: gr.stock_location_id,
              product_service_id: line.product_service_id,
              movement_type: "RECEIPT",
              quantity_delta: new Decimal(line.accepted_quantity),
              goods_receipt_id: gr.id,
              goods_receipt_line_id: line.id,
              actor_id: ctx.userId,
              reason: "Goods Receipt Posting"
            }
          });
        }
      }
    }

    const updated = await GR.update({
      where: { id: receiptId },
      data: {
        status: 'POSTED',
        posted_by: ctx.userId,
        posted_at: new Date()
      }
    });

    return updated;
  });

  await logAudit("GOODS_RECEIPT_POSTED", "GoodsReceipt", receiptId, null);
  return res;
}

export async function getStockBalance(productId: string, stockLocationId?: string) {
  await requirePermission("inventory.view");
  const ctx = await getTenantContext();
  const db = await getInvDb();

  const where: any = { product_service_id: productId, tenant_id: ctx.tenantId };
  if (stockLocationId) where.stock_location_id = stockLocationId;

  const entries = await db.Ledger.findMany({ where });
  let balance = new Decimal(0);

  for (const entry of entries) {
    balance = balance.plus(new Decimal(entry.quantity_delta));
  }

  return balance;
}
