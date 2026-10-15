/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";

async function getCommercialDb() {
  const tdb = await getTenantDb();
  return {
    Vendor: (tdb as any).Vendor || (tdb as any).vendor,
    tdb
  };
}

export async function getVendors(query?: string) {
  await requirePermission("vendor.view");
  const { Vendor } = await getCommercialDb();

  const where: any = {};
  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { vendor_code: { contains: query, mode: "insensitive" } },
      { city: { contains: query, mode: "insensitive" } },
      { state: { contains: query, mode: "insensitive" } }
    ];
  }

  return Vendor.findMany({
    where,
    orderBy: { created_at: "desc" }
  });
}

export async function getVendorById(id: string) {
  await requirePermission("vendor.view");
  const { Vendor } = await getCommercialDb();

  return Vendor.findUnique({
    where: { id }
  });
}

export async function createVendor(data: any) {
  await requirePermission("vendor.create");
  const { Vendor } = await getCommercialDb();
  const context = await getTenantContext();

  const code = data.vendor_code.toUpperCase();
  const existing = await Vendor.findFirst({
    where: { tenant_id: context.tenantId, vendor_code: code }
  });
  if (existing) {
    throw new Error(`Vendor with code ${code} already exists.`);
  }

  const vendor = await Vendor.create({
    data: {
      tenant_id: context.tenantId,
      vendor_code: code,
      name: data.name,
      vendor_type: data.vendor_type || "DISTRIBUTOR",
      legal_name: data.legal_name || null,
      display_name: data.display_name || null,
      description: data.description || null,
      address_line1: data.address_line1 || null,
      address_line2: data.address_line2 || null,
      city: data.city || null,
      state: data.state || null,
      postal_code: data.postal_code || null,
      country: data.country || null,
      gstin: data.gstin || null,
      pan: data.pan || null,
      website: data.website || null,
      email: data.email || null,
      phone: data.phone || null,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
      created_by: context.userId
    }
  });

  await logAudit("VENDOR_CREATE", "Vendor", vendor.id, { vendor_code: code });
  return vendor;
}

export async function updateVendor(id: string, data: any) {
  await requirePermission("vendor.update");
  const { Vendor } = await getCommercialDb();
  const context = await getTenantContext();

  const vendor = await Vendor.findUnique({ where: { id } });
  if (!vendor) throw new Error("Vendor not found");

  if (data.vendor_code) {
    const code = data.vendor_code.toUpperCase();
    if (code !== vendor.vendor_code) {
      const existing = await Vendor.findFirst({
        where: { tenant_id: context.tenantId, vendor_code: code }
      });
      if (existing) throw new Error(`Vendor with code ${code} already exists.`);
    }
    data.vendor_code = code;
  }

  const updated = await Vendor.update({
    where: { id },
    data: {
      vendor_code: data.vendor_code,
      name: data.name,
      vendor_type: data.vendor_type,
      legal_name: data.legal_name || null,
      display_name: data.display_name || null,
      description: data.description || null,
      address_line1: data.address_line1 || null,
      address_line2: data.address_line2 || null,
      city: data.city || null,
      state: data.state || null,
      postal_code: data.postal_code || null,
      country: data.country || null,
      gstin: data.gstin || null,
      pan: data.pan || null,
      website: data.website || null,
      email: data.email || null,
      phone: data.phone || null,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : vendor.is_active,
      updated_by: context.userId
    }
  });

  await logAudit("VENDOR_UPDATE", "Vendor", updated.id, { vendor_code: updated.vendor_code });
  return updated;
}

export async function deactivateVendor(id: string) {
  await requirePermission("vendor.deactivate");
  const { Vendor } = await getCommercialDb();
  const context = await getTenantContext();

  const updated = await Vendor.update({
    where: { id },
    data: { is_active: false, updated_by: context.userId }
  });

  await logAudit("VENDOR_DEACTIVATE", "Vendor", id, null);
  return updated;
}

export async function activateVendor(id: string) {
  await requirePermission("vendor.activate");
  const { Vendor } = await getCommercialDb();
  const context = await getTenantContext();

  const updated = await Vendor.update({
    where: { id },
    data: { is_active: true, updated_by: context.userId }
  });

  await logAudit("VENDOR_ACTIVATE", "Vendor", id, null);
  return updated;
}
