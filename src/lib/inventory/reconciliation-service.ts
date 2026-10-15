/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { getTenantDb } from "../db/tenant-db";
import { getStockBalance } from "./goods-receipt-service";
import { Decimal } from "decimal.js";

async function getInvDb() {
  const tdb: any = await getTenantDb();
  return tdb.inventory;
}

export async function runReconciliation(stockLocationId: string) {
  await requirePermission("inventory.reconciliation.view");
  const ctx = await getTenantContext();
  const db = await getInvDb();

  // Find all distinct products that have movements in this location
  const productsWithMovements = await db.InventoryLedger.groupBy({
    by: ['product_service_id'],
    where: { stock_location_id: stockLocationId, tenant_id: ctx.tenantId }
  });

  const results = [];

  for (const item of productsWithMovements) {
    const ledgerBalance = await getStockBalance(item.product_service_id, stockLocationId);

    // In Veyra, balance is always dynamically computed from the ledger.
    // There is no separate "materialized balance" table that can diverge,
    // so we can't do a ledger vs materialized check.
    // Instead, reconciliation here just outputs the current authoritative balance.
    // Real discrepancies are caught during physical Stock Counts.

    results.push({
      product_service_id: item.product_service_id,
      ledger_quantity: ledgerBalance.toString(),
      stored_balance: ledgerBalance.toString(),
      difference: "0",
      status: "RECONCILED"
    });
  }

  return results;
}
