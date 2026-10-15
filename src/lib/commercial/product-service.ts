/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";

async function getCommercialDb() {
  const tdb = await getTenantDb();
  return {
    ProductService: (tdb as any).ProductService || (tdb as any).productService,
    ProductCategory: (tdb as any).ProductCategory || (tdb as any).productCategory,
    Manufacturer: (tdb as any).Manufacturer || (tdb as any).manufacturer,
    tdb
  };
}

export async function getProducts(query?: string) {
  await requirePermission("product.view");
  const { ProductService } = await getCommercialDb();
  const where: any = {};
  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { item_code: { contains: query, mode: "insensitive" } }
    ];
  }
  return ProductService.findMany({
    where,
    include: {
      category: { select: { name: true } },
      manufacturer: { select: { name: true } }
    },
    orderBy: { created_at: "desc" }
  });
}

export async function getProductById(id: string) {
  await requirePermission("product.view");
  const { ProductService } = await getCommercialDb();
  return ProductService.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      manufacturer: { select: { id: true, name: true } }
    }
  });
}

export async function createProduct(data: any) {
  await requirePermission("product.create");
  const { ProductService, ProductCategory, Manufacturer } = await getCommercialDb();
  const context = await getTenantContext();

  const itemCode = data.item_code.toUpperCase();
  const existing = await ProductService.findFirst({
    where: { tenant_id: context.tenantId, item_code: itemCode }
  });
  if (existing) {
    throw new Error(`Product/Service with item code ${itemCode} already exists.`);
  }

  if (data.category_id) {
    const category = await ProductCategory.findUnique({ where: { id: data.category_id } });
    if (!category) throw new Error("Category must belong to the current tenant.");
  }

  if (data.manufacturer_id) {
    const mfr = await Manufacturer.findUnique({ where: { id: data.manufacturer_id } });
    if (!mfr) throw new Error("Manufacturer must belong to the current tenant.");
  }

  const product = await ProductService.create({
    data: {
      tenant_id: context.tenantId,
      item_code: itemCode,
      item_type: data.item_type || "PRODUCT",
      name: data.name,
      short_description: data.short_description,
      description: data.description,
      manufacturer_id: data.manufacturer_id || null,
      model_number: data.model_number,
      category_id: data.category_id || null,
      subcategory_id: data.subcategory_id || null,
      unit: data.unit || "EA",
      tax_code: data.tax_code,
      hsn_sac_code: data.hsn_sac_code,
      is_serialized: data.is_serialized === true || data.is_serialized === "true",
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
      created_by: context.userId
    }
  });

  await logAudit("PRODUCT_CREATE", "ProductService", product.id, { item_code: itemCode });
  return product;
}

export async function updateProduct(id: string, data: any) {
  await requirePermission("product.update");
  const { ProductService, ProductCategory, Manufacturer } = await getCommercialDb();
  const context = await getTenantContext();

  const product = await ProductService.findUnique({ where: { id } });
  if (!product) throw new Error("Product/Service not found");

  if (data.item_code) {
    const itemCode = data.item_code.toUpperCase();
    if (itemCode !== product.item_code) {
      const existing = await ProductService.findFirst({
        where: { tenant_id: context.tenantId, item_code: itemCode }
      });
      if (existing) throw new Error(`Product/Service with item code ${itemCode} already exists.`);
    }
    data.item_code = itemCode;
  }

  if (data.category_id && data.category_id !== product.category_id) {
    const category = await ProductCategory.findUnique({ where: { id: data.category_id } });
    if (!category) throw new Error("Category must belong to the current tenant.");
  }

  if (data.manufacturer_id && data.manufacturer_id !== product.manufacturer_id) {
    const mfr = await Manufacturer.findUnique({ where: { id: data.manufacturer_id } });
    if (!mfr) throw new Error("Manufacturer must belong to the current tenant.");
  }

  const updated = await ProductService.update({
    where: { id },
    data: {
      item_code: data.item_code,
      item_type: data.item_type,
      name: data.name,
      short_description: data.short_description,
      description: data.description,
      manufacturer_id: data.manufacturer_id || null,
      model_number: data.model_number,
      category_id: data.category_id || null,
      subcategory_id: data.subcategory_id || null,
      unit: data.unit,
      tax_code: data.tax_code,
      hsn_sac_code: data.hsn_sac_code,
      is_serialized: data.is_serialized !== undefined ? (data.is_serialized === true || data.is_serialized === "true") : product.is_serialized,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : product.is_active,
      updated_by: context.userId
    }
  });

  await logAudit("PRODUCT_UPDATE", "ProductService", updated.id, { item_code: updated.item_code });
  return updated;
}

export async function deactivateProduct(id: string) {
  await requirePermission("product.deactivate");
  const { ProductService } = await getCommercialDb();
  const context = await getTenantContext();

  const updated = await ProductService.update({
    where: { id },
    data: { is_active: false, updated_by: context.userId }
  });

  await logAudit("PRODUCT_DEACTIVATE", "ProductService", id, null);
  return updated;
}
