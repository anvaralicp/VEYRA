/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";

async function getCommercialDb() {
  const tdb = await getTenantDb();
  return {
    Manufacturer: (tdb as any).Manufacturer || (tdb as any).manufacturer,
    tdb
  };
}

export async function getManufacturers(query?: string) {
  await requirePermission("manufacturer.view");
  const { Manufacturer } = await getCommercialDb();
  const where: any = {};
  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { code: { contains: query, mode: "insensitive" } }
    ];
  }
  return Manufacturer.findMany({
    where,
    orderBy: { created_at: "desc" }
  });
}

export async function getManufacturerById(id: string) {
  await requirePermission("manufacturer.view");
  const { Manufacturer } = await getCommercialDb();
  return Manufacturer.findUnique({
    where: { id },
    include: {
      _count: {
        select: { products: true }
      }
    }
  });
}

export async function createManufacturer(data: any) {
  await requirePermission("manufacturer.create");
  const { Manufacturer } = await getCommercialDb();
  const context = await getTenantContext();

  const code = data.code ? data.code.toUpperCase() : null;

  if (code) {
    const existing = await Manufacturer.findFirst({
      where: { tenant_id: context.tenantId, code }
    });
    if (existing) {
      throw new Error(`Manufacturer with code ${code} already exists.`);
    }
  }

  const manufacturer = await Manufacturer.create({
    data: {
      tenant_id: context.tenantId,
      name: data.name,
      code,
      website: data.website,
      contact_email: data.contact_email,
      contact_phone: data.contact_phone,
      description: data.description,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
      created_by: context.userId
    }
  });

  await logAudit("MANUFACTURER_CREATE", "Manufacturer", manufacturer.id, { name: manufacturer.name });
  return manufacturer;
}

export async function updateManufacturer(id: string, data: any) {
  await requirePermission("manufacturer.update");
  const { Manufacturer } = await getCommercialDb();
  const context = await getTenantContext();

  const manufacturer = await Manufacturer.findUnique({ where: { id } });
  if (!manufacturer) throw new Error("Manufacturer not found");

  const code = data.code ? data.code.toUpperCase() : null;

  if (code && code !== manufacturer.code) {
    const existing = await Manufacturer.findFirst({
      where: { tenant_id: context.tenantId, code }
    });
    if (existing) throw new Error(`Manufacturer with code ${code} already exists.`);
  }

  const updated = await Manufacturer.update({
    where: { id },
    data: {
      name: data.name,
      code,
      website: data.website,
      contact_email: data.contact_email,
      contact_phone: data.contact_phone,
      description: data.description,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : manufacturer.is_active,
      updated_by: context.userId
    }
  });

  await logAudit("MANUFACTURER_UPDATE", "Manufacturer", updated.id, { name: updated.name });
  return updated;
}

export async function deactivateManufacturer(id: string) {
  await requirePermission("manufacturer.deactivate");
  const { Manufacturer } = await getCommercialDb();
  const context = await getTenantContext();

  const updated = await Manufacturer.update({
    where: { id },
    data: { is_active: false, updated_by: context.userId }
  });

  await logAudit("MANUFACTURER_DEACTIVATE", "Manufacturer", id, null);
  return updated;
}
