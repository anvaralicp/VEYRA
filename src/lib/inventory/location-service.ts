/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";

async function getLocDb() {
  const tdb: any = await getTenantDb();
  return {
    StockLocation: tdb.tdb.StockLocation || tdb.tdb.stockLocation,
    tdb: tdb.tdb
  };
}

export async function createStockLocation(data: { code: string, name: string, branch_id?: string }) {
  await requirePermission("inventory.location.create");
  const ctx = await getTenantContext();
  const db = await getLocDb();

  const loc = await db.StockLocation.create({
    data: {
      tenant_id: ctx.tenantId,
      code: data.code,
      name: data.name,
      branch_id: data.branch_id || null,
      status: 'ACTIVE'
    }
  });

  await logAudit("STOCK_LOCATION_CREATED", "StockLocation", loc.id, null);
  return loc;
}

export async function updateStockLocation(id: string, data: { name?: string, status?: string }) {
  await requirePermission("inventory.location.update");
  const ctx = await getTenantContext();
  const db = await getLocDb();

  const existing = await db.StockLocation.findUnique({ where: { id, tenant_id: ctx.tenantId } });
  if (!existing) throw new Error("Stock location not found");

  const loc = await db.StockLocation.update({
    where: { id },
    data: {
      name: data.name !== undefined ? data.name : existing.name,
      status: data.status !== undefined ? data.status : existing.status
    }
  });

  if (data.status === 'INACTIVE' && existing.status === 'ACTIVE') {
    await logAudit("STOCK_LOCATION_DEACTIVATED", "StockLocation", loc.id, null);
  } else {
    await logAudit("STOCK_LOCATION_UPDATED", "StockLocation", loc.id, null);
  }

  return loc;
}
