/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";


async function getCommercialDb() {
  const tdb = await getTenantDb();
  return {
    ProductVendor: (tdb as any).ProductVendor || (tdb as any).productVendor,
    ProductService: (tdb as any).ProductService || (tdb as any).productService,
    Vendor: (tdb as any).Vendor || (tdb as any).vendor,
    tdb
  };
}

export async function listMappingsForProduct(product_id: string) {
  await requirePermission("product_vendor.view");
  const { ProductVendor } = await getCommercialDb();
  return ProductVendor.findMany({
    where: { product_id },
    include: { vendor: true },
    orderBy: { created_at: "desc" }
  });
}

export async function listMappingsForVendor(vendor_id: string) {
  await requirePermission("product_vendor.view");
  const { ProductVendor } = await getCommercialDb();
  return ProductVendor.findMany({
    where: { vendor_id },
    include: { product: { include: { manufacturer: true } } },
    orderBy: { created_at: "desc" }
  });
}

export async function getMappingById(id: string) {
  await requirePermission("product_vendor.view");
  const { ProductVendor } = await getCommercialDb();
  return ProductVendor.findUnique({
    where: { id },
    include: { product: true, vendor: true }
  });
}

export async function createMapping(data: any) {
  await requirePermission("product_vendor.create");
  const { ProductVendor, ProductService, Vendor, tdb } = await getCommercialDb();
  const context = await getTenantContext();

  const product = await ProductService.findUnique({ where: { id: data.product_id } });
  if (!product) throw new Error("Product not found");
  if (!product.is_active) throw new Error("Cannot map an inactive product");

  const vendor = await Vendor.findUnique({ where: { id: data.vendor_id } });
  if (!vendor) throw new Error("Vendor not found");
  if (!vendor.is_active) throw new Error("Cannot map an inactive vendor");

  const existing = await ProductVendor.findFirst({
    where: { tenant_id: context.tenantId, product_id: data.product_id, vendor_id: data.vendor_id }
  });
  if (existing) {
    throw new Error("This vendor is already mapped to this product");
  }

  const isPreferred = Boolean(data.is_preferred);

  const leadTimeDays = data.lead_time_days ? parseInt(data.lead_time_days, 10) : null;
  if (leadTimeDays !== null && leadTimeDays < 0) throw new Error("Lead time cannot be negative");

  const moq = data.minimum_order_quantity ? parseFloat(data.minimum_order_quantity) : null;
  if (moq !== null && moq <= 0) throw new Error("Minimum order quantity must be greater than zero");

  let mapping;

  await (tdb as any).$transaction(async (tx: any) => {
    if (isPreferred) {
      // Clear previous preferred vendor
      await tx.ProductVendor.updateMany({
        where: { tenant_id: context.tenantId, product_id: data.product_id, is_preferred: true },
        data: { is_preferred: false, updated_by: context.userId }
      });
    }

    mapping = await tx.ProductVendor.create({
      data: {
        tenant_id: context.tenantId,
        product_id: data.product_id,
        vendor_id: data.vendor_id,
        vendor_part_number: data.vendor_part_number || null,
        lead_time_days: leadTimeDays,
        minimum_order_quantity: moq,
        is_preferred: isPreferred,
        is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
        notes: data.notes || null,
        created_by: context.userId
      }
    });
  });

  await logAudit("PRODUCT_VENDOR_CREATE", "ProductVendor", (mapping as any).id, { product_id: data.product_id, vendor_id: data.vendor_id });
  return mapping;
}

export async function updateMapping(id: string, data: any) {
  await requirePermission("product_vendor.update");
  const { ProductVendor } = await getCommercialDb();
  const context = await getTenantContext();

  const mapping = await ProductVendor.findUnique({ where: { id } });
  if (!mapping) throw new Error("Mapping not found");

  const leadTimeDays = data.lead_time_days !== undefined && data.lead_time_days !== "" && data.lead_time_days !== null ? parseInt(data.lead_time_days, 10) : null;
  if (leadTimeDays !== null && leadTimeDays < 0) throw new Error("Lead time cannot be negative");

  const moq = data.minimum_order_quantity !== undefined && data.minimum_order_quantity !== "" && data.minimum_order_quantity !== null ? parseFloat(data.minimum_order_quantity) : null;
  if (moq !== null && moq <= 0) throw new Error("Minimum order quantity must be greater than zero");

  const updated = await ProductVendor.update({
    where: { id },
    data: {
      vendor_part_number: data.vendor_part_number !== undefined ? (data.vendor_part_number || null) : mapping.vendor_part_number,
      lead_time_days: data.lead_time_days !== undefined ? leadTimeDays : mapping.lead_time_days,
      minimum_order_quantity: data.minimum_order_quantity !== undefined ? moq : mapping.minimum_order_quantity,
      notes: data.notes !== undefined ? (data.notes || null) : mapping.notes,
      updated_by: context.userId
    }
  });

  await logAudit("PRODUCT_VENDOR_UPDATE", "ProductVendor", id, null);
  return updated;
}

export async function deactivateMapping(id: string) {
  await requirePermission("product_vendor.deactivate");
  const { ProductVendor, tdb } = await getCommercialDb();
  const context = await getTenantContext();

  const mapping = await ProductVendor.findUnique({ where: { id } });
  if (!mapping) throw new Error("Mapping not found");

  let updated;
  await (tdb as any).$transaction(async (tx: any) => {
    updated = await tx.ProductVendor.update({
      where: { id },
      data: { is_active: false, is_preferred: false, updated_by: context.userId }
    });
  });

  await logAudit("PRODUCT_VENDOR_DEACTIVATE", "ProductVendor", id, null);
  return updated;
}

export async function activateMapping(id: string) {
  await requirePermission("product_vendor.activate");
  const { ProductVendor } = await getCommercialDb();
  const context = await getTenantContext();

  const mapping = await ProductVendor.findUnique({ where: { id } });
  if (!mapping) throw new Error("Mapping not found");

  const updated = await ProductVendor.update({
    where: { id },
    data: { is_active: true, updated_by: context.userId }
  });

  await logAudit("PRODUCT_VENDOR_ACTIVATE", "ProductVendor", id, null);
  return updated;
}

export async function setPreferredVendor(id: string) {
  await requirePermission("product_vendor.set_preferred");
  const { ProductVendor, tdb } = await getCommercialDb();
  const context = await getTenantContext();

  const mapping = await ProductVendor.findUnique({ where: { id } });
  if (!mapping) throw new Error("Mapping not found");
  if (!mapping.is_active) throw new Error("Cannot set an inactive mapping as preferred");

  let updated;
  await (tdb as any).$transaction(async (tx: any) => {
    // Clear others
    await tx.ProductVendor.updateMany({
      where: { tenant_id: context.tenantId, product_id: mapping.product_id, is_preferred: true },
      data: { is_preferred: false, updated_by: context.userId }
    });

    updated = await tx.ProductVendor.update({
      where: { id },
      data: { is_preferred: true, updated_by: context.userId }
    });
  });

  await logAudit("PRODUCT_VENDOR_PREFERRED_SET", "ProductVendor", id, null);
  return updated;
}

export async function clearPreferredVendor(id: string) {
  await requirePermission("product_vendor.set_preferred");
  const { ProductVendor } = await getCommercialDb();
  const context = await getTenantContext();

  const mapping = await ProductVendor.findUnique({ where: { id } });
  if (!mapping) throw new Error("Mapping not found");

  const updated = await ProductVendor.update({
    where: { id },
    data: { is_preferred: false, updated_by: context.userId }
  });

  await logAudit("PRODUCT_VENDOR_PREFERRED_CLEARED", "ProductVendor", id, null);
  return updated;
}
