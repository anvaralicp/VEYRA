/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";
import { calculateVendorCost } from "./vendor-price-service";
import Decimal from "decimal.js";

async function getCostingDb() {
  const tdb = await getTenantDb();
  return {
    CostingSettings: (tdb as any).CostingSettings || (tdb as any).costingSettings,
    tdb
  };
}

export async function getCostingSettings() {
  await requirePermission("costing.settings.view");
  const context = await getTenantContext();
  const { CostingSettings } = await getCostingDb();

  const existingSettings = await CostingSettings.findUnique({
    where: { tenant_id: context.tenantId }
  });

  if (existingSettings) {
    return existingSettings;
  }

  return {
    tenant_id: context.tenantId,
    default_pricing_method: "MARGIN",
    default_target_percentage: new Decimal(20),
    min_margin_percentage: null,
    max_markup_percentage: null
  };
}

export async function updateCostingSettings(data: any) {
  await requirePermission("costing.settings.update");
  const context = await getTenantContext();
  const { CostingSettings } = await getCostingDb();

  const default_pricing_method = data.default_pricing_method === "MARKUP" ? "MARKUP" : "MARGIN";

  let default_target_percentage = new Decimal(20);
  if (data.default_target_percentage !== undefined && data.default_target_percentage !== "") {
    default_target_percentage = new Decimal(data.default_target_percentage);
    if (default_target_percentage.lessThan(0)) throw new Error("Default target percentage cannot be negative");
    if (default_pricing_method === "MARGIN" && default_target_percentage.greaterThanOrEqualTo(100)) {
      throw new Error("Margin percentage must be strictly less than 100");
    }
  }

  let min_margin_percentage: Decimal | null = null;
  if (data.min_margin_percentage !== undefined && data.min_margin_percentage !== null && data.min_margin_percentage !== "") {
    min_margin_percentage = new Decimal(data.min_margin_percentage);
    if (min_margin_percentage.lessThan(0)) throw new Error("Minimum margin percentage cannot be negative");
    if (min_margin_percentage.greaterThanOrEqualTo(100)) throw new Error("Minimum margin percentage must be less than 100");
  }

  let max_markup_percentage: Decimal | null = null;
  if (data.max_markup_percentage !== undefined && data.max_markup_percentage !== null && data.max_markup_percentage !== "") {
    max_markup_percentage = new Decimal(data.max_markup_percentage);
    if (max_markup_percentage.lessThan(0)) throw new Error("Maximum markup percentage cannot be negative");
  }

  const updated = await CostingSettings.upsert({
    where: { tenant_id: context.tenantId },
    update: {
      default_pricing_method,
      default_target_percentage,
      min_margin_percentage,
      max_markup_percentage,
      updated_by: context.userId
    },
    create: {
      tenant_id: context.tenantId,
      default_pricing_method,
      default_target_percentage,
      min_margin_percentage,
      max_markup_percentage,
      created_by: context.userId
    }
  });

  await logAudit("COSTING_SETTINGS_UPDATED", "CostingSettings", updated.id, null);
  return updated;
}

export type CostComponent = {
  type: "FREIGHT" | "INSURANCE" | "CUSTOMS" | "HANDLING" | "OTHER";
  description: string;
  method: "FIXED_AMOUNT" | "PERCENTAGE_OF_BASE_COST";
  amount: number | string;
};

export type CostCalculationInput = {
  product_vendor_id: string;
  currency_id: string;
  quantity: number | string;
  effective_date: Date;
  components: CostComponent[];
  pricing_method: "MARGIN" | "MARKUP";
  target_percentage: number | string;
};

export async function calculateCommercialCost(input: CostCalculationInput) {
  await requirePermission("costing.calculate");
  const context = await getTenantContext(); // Validates tenant boundary via standard hooks implicitly if used

  // Validate vendor price, product vendor, and currency boundaries through existing secure service
  const basePriceCalc = await calculateVendorCost(
    input.product_vendor_id,
    input.quantity,
    input.currency_id,
    input.effective_date
  );

  const baseUnitCost = basePriceCalc.unit_cost;
  const quantity = basePriceCalc.quantity;
  const baseLineTotal = basePriceCalc.subtotal;
  const decimalPlaces = basePriceCalc.currency.decimal_places;

  let totalComponentCost = new Decimal(0);
  const evaluatedComponents: any[] = [];

  for (const comp of input.components || []) {
    const amountVal = new Decimal(comp.amount);
    if (amountVal.lessThan(0)) throw new Error(`Cost component ${comp.type} cannot have a negative amount`);

    let calcAmt = new Decimal(0);
    if (comp.method === "FIXED_AMOUNT") {
      // Fixed amounts are treated as line-level totals
      calcAmt = amountVal;
    } else if (comp.method === "PERCENTAGE_OF_BASE_COST") {
      calcAmt = baseLineTotal.mul(amountVal).div(100);
    } else {
      throw new Error(`Unknown component method: ${comp.method}`);
    }

    totalComponentCost = totalComponentCost.add(calcAmt);
    evaluatedComponents.push({
      ...comp,
      calculated_amount: calcAmt.toDP(decimalPlaces, Decimal.ROUND_HALF_UP).toNumber()
    });
  }

  const landedCostLineTotal = baseLineTotal.add(totalComponentCost);
  const landedUnitCost = landedCostLineTotal.div(quantity);

  const targetPercentage = new Decimal(input.target_percentage);
  if (targetPercentage.lessThan(0)) {
    throw new Error("Target percentage cannot be negative");
  }

  // Load tenant settings to enforce min/max rules securely on backend
  const { CostingSettings } = await getCostingDb();
  const settings = await CostingSettings.findUnique({
    where: { tenant_id: context.tenantId }
  });

  let sellingPriceLineTotal = new Decimal(0);

  if (input.pricing_method === "MARGIN") {
    if (targetPercentage.greaterThanOrEqualTo(100)) {
      throw new Error("Margin percentage must be strictly less than 100");
    }
    if (settings && settings.min_margin_percentage) {
      const minMargin = new Decimal(settings.min_margin_percentage);
      if (targetPercentage.lessThan(minMargin)) {
        throw new Error(`Target margin (${targetPercentage.toString()}%) is below the configured minimum (${minMargin.toString()}%)`);
      }
    }

    if (landedCostLineTotal.equals(0)) {
      sellingPriceLineTotal = new Decimal(0); // If cost is zero, price is zero (business rule fallback)
    } else {
      sellingPriceLineTotal = landedCostLineTotal.div(new Decimal(1).minus(targetPercentage.div(100)));
    }
  } else if (input.pricing_method === "MARKUP") {
    if (settings && settings.max_markup_percentage) {
      const maxMarkup = new Decimal(settings.max_markup_percentage);
      if (targetPercentage.greaterThan(maxMarkup)) {
        throw new Error(`Target markup (${targetPercentage.toString()}%) exceeds the configured maximum (${maxMarkup.toString()}%)`);
      }
    }

    sellingPriceLineTotal = landedCostLineTotal.mul(new Decimal(1).add(targetPercentage.div(100)));
  } else {
    throw new Error(`Unknown pricing method: ${input.pricing_method}`);
  }

  const sellingPriceUnit = sellingPriceLineTotal.div(quantity);

  // Calculate actuals
  let actualMargin = new Decimal(0);
  let actualMarkup = new Decimal(0);

  if (sellingPriceLineTotal.greaterThan(0)) {
    actualMargin = sellingPriceLineTotal.minus(landedCostLineTotal).div(sellingPriceLineTotal).mul(100);
  }

  if (landedCostLineTotal.greaterThan(0)) {
    actualMarkup = sellingPriceLineTotal.minus(landedCostLineTotal).div(landedCostLineTotal).mul(100);
  }

  // Round results at boundaries
  const formatDecimal = (val: Decimal) => val.toDP(decimalPlaces, Decimal.ROUND_HALF_UP);

  return {
    base_price_record_id: basePriceCalc.vendor_price_id,
    currency: basePriceCalc.currency,
    quantity: quantity.toNumber(),
    base_unit_cost: formatDecimal(baseUnitCost).toNumber(),
    base_line_total: formatDecimal(baseLineTotal).toNumber(),
    evaluated_components: evaluatedComponents,
    total_component_cost: formatDecimal(totalComponentCost).toNumber(),
    landed_unit_cost: formatDecimal(landedUnitCost).toNumber(),
    landed_cost_line_total: formatDecimal(landedCostLineTotal).toNumber(),
    pricing_method: input.pricing_method,
    target_percentage: targetPercentage.toNumber(),
    selling_price_unit: formatDecimal(sellingPriceUnit).toNumber(),
    selling_price_line_total: formatDecimal(sellingPriceLineTotal).toNumber(),
    actual_margin_percentage: actualMargin.toDP(2, Decimal.ROUND_HALF_UP).toNumber(),
    actual_markup_percentage: actualMarkup.toDP(2, Decimal.ROUND_HALF_UP).toNumber()
  };
}
