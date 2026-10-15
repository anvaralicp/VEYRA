"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as LeadService from "../../../../lib/crm/lead-service";

export async function createLeadAction(formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  const lead = await LeadService.createLead(data);
  revalidatePath("/crm/leads");
  redirect(`/crm/leads/${lead.id}`);
}

export async function updateLeadAction(id: string, formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  await LeadService.updateLead(id, data);
  revalidatePath(`/crm/leads/${id}`);
  revalidatePath("/crm/leads");
}

export async function convertLeadAction(id: string, formData: FormData) {
  const createCustomer = formData.get("create_customer") === "true";
  const customerId = (formData.get("customer_id") as string) || undefined;
  const opportunityName = (formData.get("opportunity_name") as string) || undefined;
  const estimatedValueRaw = formData.get("estimated_value") as string;
  const estimatedValue = estimatedValueRaw && !isNaN(parseFloat(estimatedValueRaw)) ? parseFloat(estimatedValueRaw) : undefined;
  const expectedCloseDate = (formData.get("expected_close_date") as string) || undefined;

  const result = await LeadService.convertLead(id, {
    create_customer: createCustomer,
    customer_id: customerId,
    ...(opportunityName ? { opportunity_name: opportunityName } : {}),
    ...(estimatedValue !== undefined ? { estimated_value: estimatedValue } : {}),
    ...(expectedCloseDate ? { expected_close_date: expectedCloseDate } : {}),
  });

  revalidatePath(`/crm/leads/${id}`);
  revalidatePath("/crm/leads");
  revalidatePath("/crm/opportunities");
  revalidatePath("/crm/customers");

  redirect(`/crm/opportunities/${result.opportunityId}`);
}
