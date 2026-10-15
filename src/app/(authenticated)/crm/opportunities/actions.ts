"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as OpportunityService from "../../../../lib/crm/opportunity-service";

export async function createOpportunityAction(formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  const opp = await OpportunityService.createOpportunity(data);
  revalidatePath("/crm/opportunities");
  redirect(`/crm/opportunities/${opp.id}`);
}

export async function updateOpportunityAction(id: string, formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  await OpportunityService.updateOpportunity(id, data);
  revalidatePath(`/crm/opportunities/${id}`);
  revalidatePath("/crm/opportunities");
  revalidatePath("/crm/opportunities/pipeline");
}

export async function markOpportunityWonAction(id: string) {
  await OpportunityService.markOpportunityWon(id);
  revalidatePath(`/crm/opportunities/${id}`);
  revalidatePath("/crm/opportunities");
  revalidatePath("/crm/opportunities/pipeline");
}

export async function markOpportunityLostAction(id: string, formData: FormData) {
  const reason = formData.get("loss_reason") as string || "No reason provided";
  await OpportunityService.markOpportunityLost(id, reason);
  revalidatePath(`/crm/opportunities/${id}`);
  revalidatePath("/crm/opportunities");
  revalidatePath("/crm/opportunities/pipeline");
}
