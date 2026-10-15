/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";

async function getCommercialDb() {
  const tdb = await getTenantDb();
  return {
    ProductCategory: (tdb as any).ProductCategory || (tdb as any).productCategory,
    tdb
  };
}

export async function getCategories(query?: string) {
  await requirePermission("category.view");
  const { ProductCategory } = await getCommercialDb();
  const where: any = {};
  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { code: { contains: query, mode: "insensitive" } }
    ];
  }
  return ProductCategory.findMany({
    where,
    include: { parent: { select: { name: true, code: true } } },
    orderBy: { created_at: "desc" }
  });
}

export async function getCategoryById(id: string) {
  await requirePermission("category.view");
  const { ProductCategory } = await getCommercialDb();
  return ProductCategory.findUnique({
    where: { id },
    include: { parent: { select: { id: true, name: true, code: true } } }
  });
}

export async function createCategory(data: any) {
  await requirePermission("category.create");
  const { ProductCategory } = await getCommercialDb();
  const context = await getTenantContext();

  const code = data.code.toUpperCase();
  const existing = await ProductCategory.findFirst({
    where: { tenant_id: context.tenantId, code }
  });
  if (existing) {
    throw new Error(`Category with code ${code} already exists.`);
  }

  if (data.parent_id) {
    const parent = await ProductCategory.findUnique({ where: { id: data.parent_id } });
    if (!parent) throw new Error("Invalid parent category.");
  }

  const category = await ProductCategory.create({
    data: {
      tenant_id: context.tenantId,
      name: data.name,
      code,
      description: data.description,
      parent_id: data.parent_id || null,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
      created_by: context.userId
    }
  });

  await logAudit("CATEGORY_CREATE", "ProductCategory", category.id, { code });
  return category;
}

export async function updateCategory(id: string, data: any) {
  await requirePermission("category.update");
  const { ProductCategory } = await getCommercialDb();
  const context = await getTenantContext();

  const category = await ProductCategory.findUnique({ where: { id } });
  if (!category) throw new Error("Category not found");

  if (data.code) {
    const code = data.code.toUpperCase();
    if (code !== category.code) {
      const existing = await ProductCategory.findFirst({
        where: { tenant_id: context.tenantId, code }
      });
      if (existing) throw new Error(`Category with code ${code} already exists.`);
    }
    data.code = code;
  }

  if (data.parent_id) {
    if (data.parent_id === id) throw new Error("Category cannot be its own parent.");
    const parent = await ProductCategory.findUnique({ where: { id: data.parent_id } });
    if (!parent) throw new Error("Invalid parent category.");
  }

  const updated = await ProductCategory.update({
    where: { id },
    data: {
      name: data.name,
      code: data.code,
      description: data.description,
      parent_id: data.parent_id || null,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : category.is_active,
      updated_by: context.userId
    }
  });

  await logAudit("CATEGORY_UPDATE", "ProductCategory", updated.id, { code: updated.code });
  return updated;
}

export async function deactivateCategory(id: string) {
  await requirePermission("category.deactivate");
  const { ProductCategory } = await getCommercialDb();
  const context = await getTenantContext();

  const updated = await ProductCategory.update({
    where: { id },
    data: { is_active: false, updated_by: context.userId }
  });

  await logAudit("CATEGORY_DEACTIVATE", "ProductCategory", id, null);
  return updated;
}
