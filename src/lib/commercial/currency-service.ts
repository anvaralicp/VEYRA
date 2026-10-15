/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";

async function getCurrencyDb() {
  const tdb = await getTenantDb();
  return {
    Currency: (tdb as any).Currency || (tdb as any).currency,
    tdb
  };
}

export async function listCurrencies() {
  await requirePermission("organization.view"); // Assuming anyone who can view org can view currencies
  const { Currency } = await getCurrencyDb();
  return Currency.findMany({
    orderBy: { created_at: "desc" }
  });
}

export async function getCurrencyById(id: string) {
  await requirePermission("organization.view");
  const { Currency } = await getCurrencyDb();
  return Currency.findUnique({
    where: { id }
  });
}

export async function createCurrency(data: any) {
  await requirePermission("organization.update"); // Require admin/owner rights basically to add currencies
  const { Currency, tdb } = await getCurrencyDb();
  const context = await getTenantContext();

  const code = (data.code || "").toUpperCase();
  if (!code) throw new Error("Currency code is required");

  const existing = await Currency.findUnique({
    where: { tenant_id_code: { tenant_id: context.tenantId, code } }
  });

  if (existing) {
    throw new Error(`Currency ${code} already exists.`);
  }

  const isDefault = Boolean(data.is_default);

  let currency;

  await (tdb as any).$transaction(async (tx: any) => {
    if (isDefault) {
      await tx.Currency.updateMany({
        where: { tenant_id: context.tenantId, is_default: true },
        data: { is_default: false, updated_by: context.userId }
      });
    }

    currency = await tx.Currency.create({
      data: {
        tenant_id: context.tenantId,
        code,
        name: data.name || code,
        symbol: data.symbol || code,
        decimal_places: data.decimal_places !== undefined ? parseInt(data.decimal_places, 10) : 2,
        is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
        is_default: isDefault,
        created_by: context.userId
      }
    });
  });

  await logAudit("CURRENCY_CREATED", "Currency", (currency as any).id, { code });
  return currency;
}

export async function updateCurrency(id: string, data: any) {
  await requirePermission("organization.update");
  const { Currency } = await getCurrencyDb();
  const context = await getTenantContext();

  const currency = await Currency.findUnique({ where: { id } });
  if (!currency) throw new Error("Currency not found");

  const updated = await Currency.update({
    where: { id },
    data: {
      name: data.name !== undefined ? data.name : currency.name,
      symbol: data.symbol !== undefined ? data.symbol : currency.symbol,
      decimal_places: data.decimal_places !== undefined ? parseInt(data.decimal_places, 10) : currency.decimal_places,
      updated_by: context.userId
    }
  });

  await logAudit("CURRENCY_UPDATED", "Currency", id, null);
  return updated;
}

export async function activateCurrency(id: string) {
  await requirePermission("organization.update");
  const { Currency } = await getCurrencyDb();
  const context = await getTenantContext();

  const currency = await Currency.findUnique({ where: { id } });
  if (!currency) throw new Error("Currency not found");

  const updated = await Currency.update({
    where: { id },
    data: { is_active: true, updated_by: context.userId }
  });

  await logAudit("CURRENCY_ACTIVATED", "Currency", id, null);
  return updated;
}

export async function deactivateCurrency(id: string) {
  await requirePermission("organization.update");
  const { Currency } = await getCurrencyDb();
  const context = await getTenantContext();

  const currency = await Currency.findUnique({ where: { id } });
  if (!currency) throw new Error("Currency not found");
  if (currency.is_default) throw new Error("Cannot deactivate the default currency");

  const updated = await Currency.update({
    where: { id },
    data: { is_active: false, updated_by: context.userId }
  });

  await logAudit("CURRENCY_DEACTIVATED", "Currency", id, null);
  return updated;
}

export async function setDefaultCurrency(id: string) {
  await requirePermission("organization.update");
  const { Currency, tdb } = await getCurrencyDb();
  const context = await getTenantContext();

  const currency = await Currency.findUnique({ where: { id } });
  if (!currency) throw new Error("Currency not found");
  if (!currency.is_active) throw new Error("Cannot set inactive currency as default");

  let updated;
  await (tdb as any).$transaction(async (tx: any) => {
    await tx.Currency.updateMany({
      where: { tenant_id: context.tenantId, is_default: true },
      data: { is_default: false, updated_by: context.userId }
    });

    updated = await tx.Currency.update({
      where: { id },
      data: { is_default: true, updated_by: context.userId }
    });
  });

  await logAudit("CURRENCY_DEFAULT_SET", "Currency", id, null);
  return updated;
}
