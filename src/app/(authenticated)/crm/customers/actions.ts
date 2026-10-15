"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as CustomerService from "../../../../lib/crm/customer-service";

export async function createCustomerAction(formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  const customer = await CustomerService.createCustomer(data);
  revalidatePath("/crm/customers");
  redirect(`/crm/customers/${customer.id}`);
}

export async function updateCustomerAction(id: string, formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  await CustomerService.updateCustomer(id, data);
  revalidatePath(`/crm/customers/${id}`);
  revalidatePath("/crm/customers");
}

export async function createContactAction(customerId: string, formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  await CustomerService.createContact(customerId, data);
  revalidatePath(`/crm/customers/${customerId}`);
}

export async function createSiteAction(customerId: string, formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  await CustomerService.createSite(customerId, data);
  revalidatePath(`/crm/customers/${customerId}`);
}
