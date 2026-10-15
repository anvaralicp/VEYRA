"use server";
import {
  updateFulfilmentPlanning,
  updateFulfilmentOrderLinePlanning,
  markFulfilmentReady,
  holdFulfilmentOrder,
  resumeFulfilmentOrder,
  cancelFulfilmentOrder
} from "../../../../../../lib/commercial/fulfilment-service";

export async function updatePlanningActionApi(id: string, formData: FormData) {
  const siteId = formData.get("customer_site_id") as string;
  const targetDate = formData.get("target_date") as string;
  const responsibleUserId = formData.get("responsible_user_id") as string;
  const notes = formData.get("notes") as string;

  await updateFulfilmentPlanning(id, {
    customer_site_id: siteId || null,
    target_date: targetDate || null,
    responsible_user_id: responsibleUserId || null,
    notes
  });

  const lineIds = formData.getAll("line_id") as string[];
  for (const lid of lineIds) {
    const pQty = formData.get(`planned_${lid}`) as string;
    const lNotes = formData.get(`notes_${lid}`) as string;
    await updateFulfilmentOrderLinePlanning(lid, {
      planned_quantity: pQty ? Number(pQty) : undefined,
      notes: lNotes
    });
  }
}

export async function markReadyActionApi(id: string) {
  await markFulfilmentReady(id);
}

export async function holdActionApi(id: string, formData: FormData) {
  const reason = formData.get("reason") as string;
  await holdFulfilmentOrder(id, reason || "Manual hold");
}

export async function resumeActionApi(id: string) {
  await resumeFulfilmentOrder(id);
}

export async function cancelActionApi(id: string, formData: FormData) {
  const reason = formData.get("reason") as string;
  await cancelFulfilmentOrder(id, reason || "Manual cancellation");
}
