"use server";
import { createGoodsReceiptFromSupplierPO, addGoodsReceiptLine, updateGoodsReceiptLine } from "../../../../../lib/inventory/goods-receipt-service";

export async function submitGoodsReceiptDraft(formData: FormData) {
  const spoId = formData.get("spo_id") as string;
  const locationId = formData.get("location_id") as string;
  const deliveryNote = formData.get("delivery_note") as string;

  if (!spoId || !locationId) {
    throw new Error("SPO and Location are required");
  }

  const gr = await createGoodsReceiptFromSupplierPO(spoId, locationId, deliveryNote);

  const lineIds = formData.getAll("line_id") as string[];
  for (const spoLineId of lineIds) {
    const recv = Number(formData.get(`recv_${spoLineId}`) || 0);
    const acc = Number(formData.get(`acc_${spoLineId}`) || 0);
    const rej = Number(formData.get(`rej_${spoLineId}`) || 0);
    const reason = formData.get(`reason_${spoLineId}`) as string;

    if (recv > 0) {
      const grLine = await addGoodsReceiptLine(gr.id, spoLineId, recv);
      if (rej > 0 || acc !== recv) {
        await updateGoodsReceiptLine(grLine.id, {
          accepted_quantity: acc,
          rejected_quantity: rej,
          rejection_reason: reason
        });
      }
    }
  }

  return gr.id;
}
