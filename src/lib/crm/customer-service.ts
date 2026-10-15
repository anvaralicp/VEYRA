/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";

// Helper to get typed customer tables through tenantDb
async function getCrmDb() {
  const tdb = await getTenantDb();
  const Customer = tdb.Customer || tdb.customer;
  const CustomerContact = tdb.CustomerContact || tdb.customerContact;
  const CustomerSite = tdb.CustomerSite || tdb.customerSite;
  return { Customer, CustomerContact, CustomerSite, tdb };
}

export async function getCustomers(query?: string) {
  await requirePermission("customer.view");
  const { Customer } = await getCrmDb();

  if (query) {
    return Customer.findMany({
      where: {
        OR: [
          { customer_number: { contains: query, mode: "insensitive" } },
          { legal_name: { contains: query, mode: "insensitive" } },
          { display_name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } },
        ],
        deleted_at: null
      },
      orderBy: { created_at: 'desc' }
    });
  }

  return Customer.findMany({
    where: { deleted_at: null },
    orderBy: { created_at: 'desc' }
  });
}

export async function getCustomerById(id: string) {
  await requirePermission("customer.view");
  const { Customer } = await getCrmDb();

  const customer = await Customer.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { created_at: 'asc' } },
      sites: { orderBy: { created_at: 'asc' } },
      _count: {
        select: { requirements: true, opportunities: true }
      }
    }
  });

  if (!customer || customer.deleted_at) return null;
  return customer;
}

export async function createCustomer(data: any) {
  await requirePermission("customer.create");
  const { Customer } = await getCrmDb();
  const context = await getTenantContext();

  // Basic Duplicate Check
  const duplicates = await Customer.findMany({
    where: {
      OR: [
        { legal_name: data.legal_name },
        ...(data.gstin ? [{ gstin: data.gstin }] : []),
        ...(data.pan ? [{ pan: data.pan }] : [])
      ]
    }
  });

  if (duplicates.length > 0) {
    throw new Error("A customer with this Name, GSTIN, or PAN already exists.");
  }

  // Generate Customer Number temporarily until numbering engine is built
  const count = await Customer.count();
  const customerNumber = `CUS-${String(count + 1).padStart(6, '0')}`;

  const customer = await Customer.create({
    data: {
      customer_number: customerNumber,
      legal_name: data.legal_name,
      display_name: data.display_name,
      customer_type: data.customer_type || "COMPANY",
      industry: data.industry,
      registration_number: data.registration_number,
      gstin: data.gstin,
      pan: data.pan,
      website: data.website,
      email: data.email,
      phone: data.phone,
      status: data.status || "ACTIVE",
      account_manager_id: data.account_manager_id,
      created_by: context.userId
    }
  });

  await logAudit("CUSTOMER_CREATE", "Customer", customer.id, { number: customer.customer_number });
  return customer;
}

export async function updateCustomer(id: string, data: any) {
  await requirePermission("customer.update");
  const { Customer } = await getCrmDb();
  const context = await getTenantContext();

  const customer = await Customer.update({
    where: { id },
    data: {
      legal_name: data.legal_name,
      display_name: data.display_name,
      customer_type: data.customer_type,
      industry: data.industry,
      registration_number: data.registration_number,
      gstin: data.gstin,
      pan: data.pan,
      website: data.website,
      email: data.email,
      phone: data.phone,
      status: data.status,
      account_manager_id: data.account_manager_id,
      updated_by: context.userId
    }
  });

  await logAudit("CUSTOMER_UPDATE", "Customer", customer.id, { number: customer.customer_number });
  return customer;
}

export async function deactivateCustomer(id: string) {
  await requirePermission("customer.delete"); // Using delete permission for deactivation/soft-delete
  const { Customer } = await getCrmDb();

  const customer = await Customer.update({
    where: { id },
    data: { status: "INACTIVE" }
  });

  await logAudit("CUSTOMER_DEACTIVATE", "Customer", id, null);
  return customer;
}

// --- CONTACTS ---

export async function createContact(customerId: string, data: any) {
  await requirePermission("contact.create");
  const { CustomerContact } = await getCrmDb();
  const context = await getTenantContext();

  const contact = await CustomerContact.create({
    data: {
      customer_id: customerId,
      site_id: data.site_id || null,
      name: data.name,
      designation: data.designation,
      department: data.department,
      email: data.email,
      phone: data.phone,
      alternate_phone: data.alternate_phone,
      contact_type: data.contact_type || "PRIMARY",
      is_primary: data.is_primary === 'true' || data.is_primary === true,
      status: data.status || "ACTIVE",
      notes: data.notes,
      created_by: context.userId
    }
  });

  await logAudit("CONTACT_CREATE", "CustomerContact", contact.id, { customer_id: customerId });
  return contact;
}

export async function updateContact(id: string, data: any) {
  await requirePermission("contact.update");
  const { CustomerContact } = await getCrmDb();
  const context = await getTenantContext();

  const contact = await CustomerContact.update({
    where: { id },
    data: {
      site_id: data.site_id || null,
      name: data.name,
      designation: data.designation,
      department: data.department,
      email: data.email,
      phone: data.phone,
      alternate_phone: data.alternate_phone,
      contact_type: data.contact_type,
      is_primary: data.is_primary === 'true' || data.is_primary === true,
      status: data.status,
      notes: data.notes,
      updated_by: context.userId
    }
  });

  await logAudit("CONTACT_UPDATE", "CustomerContact", id, null);
  return contact;
}

// --- SITES ---

export async function createSite(customerId: string, data: any) {
  await requirePermission("site.create");
  const { CustomerSite } = await getCrmDb();
  const context = await getTenantContext();

  const count = await CustomerSite.count({ where: { customer_id: customerId } });
  const siteNumber = `STE-${String(count + 1).padStart(4, '0')}`;

  const site = await CustomerSite.create({
    data: {
      customer_id: customerId,
      site_number: siteNumber,
      name: data.name,
      site_type: data.site_type || "HEAD_OFFICE",
      address: data.address,
      city: data.city,
      state: data.state,
      country: data.country,
      postal_code: data.postal_code,
      phone: data.phone,
      email: data.email,
      status: data.status || "ACTIVE",
      created_by: context.userId
    }
  });

  await logAudit("SITE_CREATE", "CustomerSite", site.id, { customer_id: customerId });
  return site;
}

export async function updateSite(id: string, data: any) {
  await requirePermission("site.update");
  const { CustomerSite } = await getCrmDb();
  const context = await getTenantContext();

  const site = await CustomerSite.update({
    where: { id },
    data: {
      name: data.name,
      site_type: data.site_type,
      address: data.address,
      city: data.city,
      state: data.state,
      country: data.country,
      postal_code: data.postal_code,
      phone: data.phone,
      email: data.email,
      status: data.status,
      updated_by: context.userId
    }
  });

  await logAudit("SITE_UPDATE", "CustomerSite", id, null);
  return site;
}
