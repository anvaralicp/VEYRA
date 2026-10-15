"use server";
import { createStockCount, addStockCountLine } from "../../../../../lib/inventory/stock-count-service";

export async function submitStockCountDraft(formData: FormData) {
  const locId = formData.get("location_id") as string;
  const notes = formData.get("notes") as string;

  if (!locId) throw new Error("Location is required");

  const count = await createStockCount(locId, notes);

  const prodIds = formData.getAll("product_id") as string[];
  for (const pId of prodIds) {
    const physical = formData.get(`phys_${pId}`) as string;
    if (physical && physical !== "") {
      const reason = formData.get(`reason_${pId}`) as string;
      await addStockCountLine(count.id, pId, Number(physical), reason);
    }
  }

  return count.id;
}
