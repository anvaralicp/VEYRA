/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";
import Decimal from "decimal.js";

async function getPricingDb() {
  const tdb = await getTenantDb();
  return {
    VendorPrice: (tdb as any).VendorPrice || (tdb as any).vendorPrice,
    ProductVendor: (tdb as any).ProductVendor || (tdb as any).productVendor,
    Currency: (tdb as any).Currency || (tdb as any).currency,
    tdb
  };
}

export async function listPricesForMapping(product_vendor_id: string) {
  await requirePermission("pricing.view");
  const { VendorPrice } = await getPricingDb();
  return VendorPrice.findMany({
    where: { product_vendor_id },
    include: { currency: true },
    orderBy: [
      { is_active: "desc" },
      { valid_from: "desc" },
      { minimum_quantity: "asc" }
    ]
  });
}

export async function listPricesForProduct(product_id: string) {
  await requirePermission("pricing.view");
  const { VendorPrice } = await getPricingDb();
  return VendorPrice.findMany({
    where: { productVendor: { product_id } },
    include: { currency: true, productVendor: { include: { vendor: true } } },
    orderBy: [
      { is_active: "desc" },
      { valid_from: "desc" }
    ]
  });
}

export async function getVendorPriceById(id: string) {
  await requirePermission("pricing.view");
  const { VendorPrice } = await getPricingDb();
  return VendorPrice.findUnique({
    where: { id },
    include: { currency: true, productVendor: true }
  });
}

function datesOverlap(aStart: Date, aEnd: Date | null, bStart: Date, bEnd: Date | null): boolean {
  if (aEnd !== null && aEnd <= bStart) return false;
  if (bEnd !== null && bEnd <= aStart) return false;
  return true;
}

export async function createVendorPrice(data: any) {
  await requirePermission("pricing.create");
  const { VendorPrice, ProductVendor, Currency } = await getPricingDb();
  const context = await getTenantContext();

  const mapping = await ProductVendor.findUnique({ where: { id: data.product_vendor_id } });
  if (!mapping) throw new Error("Product vendor mapping not found");
  if (!mapping.is_active) throw new Error("Cannot add price to an inactive mapping");

  const currency = await Currency.findUnique({ where: { id: data.currency_id } });
  if (!currency) throw new Error("Currency not found");
  if (!currency.is_active) throw new Error("Cannot use an inactive currency");

  const unitCost = new Decimal(data.unit_cost);
  if (unitCost.lessThan(0)) throw new Error("Unit cost cannot be negative");

  let minimumQuantity: Decimal | null = null;
  if (data.minimum_quantity !== undefined && data.minimum_quantity !== null && data.minimum_quantity !== "") {
    minimumQuantity = new Decimal(data.minimum_quantity);
    if (minimumQuantity.lessThanOrEqualTo(0)) throw new Error("Minimum quantity must be greater than zero");
  }

  const validFrom = new Date(data.valid_from);
  if (isNaN(validFrom.getTime())) throw new Error("Invalid valid_from date");

  let validUntil: Date | null = null;
  if (data.valid_until) {
    validUntil = new Date(data.valid_until);
    if (isNaN(validUntil.getTime())) throw new Error("Invalid valid_until date");
    if (validUntil < validFrom) throw new Error("valid_until cannot be before valid_from");
  }

  const is_active = data.is_active !== undefined ? Boolean(data.is_active) : true;

  if (is_active) {
    const existingActive = await VendorPrice.findMany({
      where: {
        product_vendor_id: data.product_vendor_id,
        currency_id: data.currency_id,
        is_active: true
      }
    });

    for (const record of existingActive) {
      const recMinQty = record.minimum_quantity ? new Decimal(record.minimum_quantity) : null;
      const minQtyMatch = (!recMinQty && !minimumQuantity) ||
                          (recMinQty && minimumQuantity && recMinQty.equals(minimumQuantity));

      if (minQtyMatch) {
        if (datesOverlap(validFrom, validUntil, record.valid_from, record.valid_until)) {
          throw new Error("Cannot create overlapping active price periods for the same context");
        }
      }
    }
  }

  const price = await VendorPrice.create({
    data: {
      tenant_id: context.tenantId,
      product_vendor_id: data.product_vendor_id,
      currency_id: data.currency_id,
      unit_cost: unitCost,
      minimum_quantity: minimumQuantity,
      valid_from: validFrom,
      valid_until: validUntil,
      reference_number: data.reference_number || null,
      notes: data.notes || null,
      is_active,
      created_by: context.userId
    }
  });

  await logAudit("VENDOR_PRICE_CREATE", "VendorPrice", price.id, { product_vendor_id: data.product_vendor_id });
  return price;
}

export async function updateVendorPrice(id: string, data: any) {
  await requirePermission("pricing.update");
  const { VendorPrice } = await getPricingDb();
  const context = await getTenantContext();

  const price = await VendorPrice.findUnique({ where: { id } });
  if (!price) throw new Error("Price record not found");

  let unitCost = new Decimal(price.unit_cost);
  if (data.unit_cost !== undefined && data.unit_cost !== "") {
    unitCost = new Decimal(data.unit_cost);
    if (unitCost.lessThan(0)) throw new Error("Unit cost cannot be negative");
  }

  let minimumQuantity: Decimal | null = price.minimum_quantity ? new Decimal(price.minimum_quantity) : null;
  if (data.minimum_quantity !== undefined) {
    if (data.minimum_quantity === null || data.minimum_quantity === "") {
      minimumQuantity = null;
    } else {
      minimumQuantity = new Decimal(data.minimum_quantity);
      if (minimumQuantity.lessThanOrEqualTo(0)) throw new Error("Minimum quantity must be greater than zero");
    }
  }

  let validFrom = price.valid_from;
  if (data.valid_from) {
    validFrom = new Date(data.valid_from);
    if (isNaN(validFrom.getTime())) throw new Error("Invalid valid_from date");
  }

  let validUntil = price.valid_until;
  if (data.valid_until !== undefined) {
    if (data.valid_until === null || data.valid_until === "") {
      validUntil = null;
    } else {
      validUntil = new Date(data.valid_until);
      if (isNaN(validUntil.getTime())) throw new Error("Invalid valid_until date");
    }
  }

  if (validUntil !== null && validUntil < validFrom) {
    throw new Error("valid_until cannot be before valid_from");
  }

  if (price.is_active) {
    const existingActive = await VendorPrice.findMany({
      where: {
        product_vendor_id: price.product_vendor_id,
        currency_id: price.currency_id,
        is_active: true,
        id: { not: id }
      }
    });

    for (const record of existingActive) {
      const recMinQty = record.minimum_quantity ? new Decimal(record.minimum_quantity) : null;
      const minQtyMatch = (!recMinQty && !minimumQuantity) ||
                          (recMinQty && minimumQuantity && recMinQty.equals(minimumQuantity));
      if (minQtyMatch) {
        if (datesOverlap(validFrom, validUntil, record.valid_from, record.valid_until)) {
          throw new Error("Cannot update to create overlapping active price periods for the same context");
        }
      }
    }
  }

  const updated = await VendorPrice.update({
    where: { id },
    data: {
      unit_cost: unitCost,
      minimum_quantity: minimumQuantity,
      valid_from: validFrom,
      valid_until: validUntil,
      reference_number: data.reference_number !== undefined ? (data.reference_number || null) : price.reference_number,
      notes: data.notes !== undefined ? (data.notes || null) : price.notes,
      updated_by: context.userId
    }
  });

  await logAudit("VENDOR_PRICE_UPDATE", "VendorPrice", id, null);
  return updated;
}

export async function activateVendorPrice(id: string) {
  await requirePermission("pricing.activate");
  const { VendorPrice } = await getPricingDb();
  const context = await getTenantContext();

  const price = await VendorPrice.findUnique({ where: { id } });
  if (!price) throw new Error("Price record not found");

  const existingActive = await VendorPrice.findMany({
    where: {
      product_vendor_id: price.product_vendor_id,
      currency_id: price.currency_id,
      is_active: true
    }
  });

  const targetMinQty = price.minimum_quantity ? new Decimal(price.minimum_quantity) : null;

  for (const record of existingActive) {
    const recMinQty = record.minimum_quantity ? new Decimal(record.minimum_quantity) : null;
    const minQtyMatch = (!recMinQty && !targetMinQty) ||
                        (recMinQty && targetMinQty && recMinQty.equals(targetMinQty));
    if (minQtyMatch) {
      if (datesOverlap(price.valid_from, price.valid_until, record.valid_from, record.valid_until)) {
        throw new Error("Cannot activate price record because it overlaps with an existing active period");
      }
    }
  }

  const updated = await VendorPrice.update({
    where: { id },
    data: { is_active: true, updated_by: context.userId }
  });

  await logAudit("VENDOR_PRICE_ACTIVATE", "VendorPrice", id, null);
  return updated;
}

export async function deactivateVendorPrice(id: string) {
  await requirePermission("pricing.deactivate");
  const { VendorPrice } = await getPricingDb();
  const context = await getTenantContext();

  const price = await VendorPrice.findUnique({ where: { id } });
  if (!price) throw new Error("Price record not found");

  const updated = await VendorPrice.update({
    where: { id },
    data: { is_active: false, updated_by: context.userId }
  });

  await logAudit("VENDOR_PRICE_DEACTIVATE", "VendorPrice", id, null);
  return updated;
}

export async function calculateVendorCost(
  product_vendor_id: string,
  quantity: number | string | Decimal,
  currency_id: string,
  effective_date: Date
) {
  await requirePermission("pricing.calculate");
  const { VendorPrice, ProductVendor } = await getPricingDb();

  const mapping = await ProductVendor.findUnique({ where: { id: product_vendor_id } });
  if (!mapping) throw new Error("Product vendor mapping not found");

  const reqQty = new Decimal(quantity);
  if (reqQty.lessThanOrEqualTo(0)) throw new Error("Quantity must be greater than zero");

  const activePrices = await VendorPrice.findMany({
    where: {
      product_vendor_id,
      currency_id,
      is_active: true,
      valid_from: { lte: effective_date }
    },
    include: { currency: true }
  });

  const validPrices = activePrices.filter((p: any) => p.valid_until === null || p.valid_until >= effective_date);

  if (validPrices.length === 0) {
    throw new Error("No valid price found for the given criteria");
  }

  const applicablePrices = validPrices.filter((p: any) => {
    if (!p.minimum_quantity) return true;
    const minQ = new Decimal(p.minimum_quantity);
    return minQ.lessThanOrEqualTo(reqQty);
  });

  if (applicablePrices.length === 0) {
    throw new Error("Requested quantity does not meet the minimum quantity of any valid price");
  }

  applicablePrices.sort((a: any, b: any) => {
    const qA = a.minimum_quantity ? new Decimal(a.minimum_quantity).toNumber() : 0;
    const qB = b.minimum_quantity ? new Decimal(b.minimum_quantity).toNumber() : 0;
    return qB - qA;
  });

  const selectedPrice = applicablePrices[0];
  const unitCost = new Decimal(selectedPrice.unit_cost);
  const subtotal = unitCost.mul(reqQty);

  return {
    vendor_price_id: selectedPrice.id,
    unit_cost: unitCost,
    quantity: reqQty,
    subtotal,
    currency: selectedPrice.currency,
    selected_price_record: selectedPrice
  };
}
