"use server";

import * as CustomerPOService from "../../../../lib/commercial/customer-po-service";
import * as FulfilmentService from "../../../../lib/commercial/fulfilment-service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createCustomerPOAction(formData: FormData) {
  const po_number = (formData.get("po_number") as string)?.trim();
  const customer_id = formData.get("customer_id") as string;
  const quotation_revision_id = (formData.get("quotation_revision_id") as string)?.trim() || undefined;
  const opportunity_id = (formData.get("opportunity_id") as string)?.trim() || undefined;
  const quotation_id = (formData.get("quotation_id") as string)?.trim() || undefined;
  const currency_id = formData.get("currency_id") as string;
  const po_date = formData.get("po_date") as string;
  const received_date = formData.get("received_date") as string;
  const valid_until = (formData.get("valid_until") as string)?.trim() || undefined;
  const subtotal = parseFloat(formData.get("subtotal") as string || "0");
  const tax_total = parseFloat(formData.get("tax_total") as string || "0");
  const grand_total = parseFloat(formData.get("grand_total") as string || "0");
  const notes = (formData.get("notes") as string)?.trim() || undefined;
  const import_quotation_lines = formData.get("import_quotation_lines") === "true";

  if (!po_number || !customer_id || !currency_id || !po_date || !received_date) {
    throw new Error("Missing required PO fields (PO number, customer, currency, PO date, received date)");
  }

  const po = await CustomerPOService.createCustomerPO({
    po_number,
    customer_id,
    quotation_revision_id,
    opportunity_id,
    quotation_id,
    currency_id,
    po_date,
    received_date,
    valid_until,
    subtotal,
    tax_total,
    grand_total,
    notes,
    import_quotation_lines
  });

  revalidatePath("/commercial/customer-pos");
  redirect(`/commercial/customer-pos/${po.id}`);
}

export async function submitCustomerPOAction(poId: string) {
  await CustomerPOService.submitCustomerPO(poId);
  revalidatePath(`/commercial/customer-pos/${poId}`);
  revalidatePath("/commercial/customer-pos");
}

export async function validateCustomerPOAction(formData: FormData) {
  const poId = formData.get("po_id") as string;
  const decision = formData.get("decision") as string;
  const comments = (formData.get("comments") as string)?.trim() || undefined;

  if (!poId || !decision) {
    throw new Error("Missing required fields for PO validation");
  }

  await CustomerPOService.validateCustomerPO(poId, decision, comments);
  revalidatePath(`/commercial/customer-pos/${poId}`);
  revalidatePath("/commercial/customer-pos");
}

export async function addCustomerPOLineAction(formData: FormData) {
  const poId = formData.get("po_id") as string;
  const customer_item_code = (formData.get("customer_item_code") as string)?.trim() || undefined;
  const customer_item_description = (formData.get("customer_item_description") as string)?.trim() || "Item";
  const quotation_line_id = (formData.get("quotation_line_id") as string)?.trim() || undefined;
  const quantity = parseFloat(formData.get("quantity") as string || "1");
  const unit_of_measure = (formData.get("unit_of_measure") as string)?.trim() || "EA";
  const unit_price = parseFloat(formData.get("unit_price") as string || "0");
  const tax_rate = formData.get("tax_rate") ? parseFloat(formData.get("tax_rate") as string) : undefined;
  const tax_amount = parseFloat(formData.get("tax_amount") as string || "0");
  const line_total = parseFloat(formData.get("line_total") as string || "0");
  const notes = (formData.get("notes") as string)?.trim() || undefined;

  await CustomerPOService.addCustomerPOLine(poId, {
    customer_item_code,
    customer_item_description,
    quotation_line_id,
    quantity,
    unit_of_measure,
    unit_price,
    tax_rate,
    tax_amount,
    line_total,
    notes
  });

  revalidatePath(`/commercial/customer-pos/${poId}`);
}

export async function createFulfilmentOrderAction(poId: string) {
  const fo = await FulfilmentService.createFulfilmentOrderFromCustomerPO(poId);
  revalidatePath(`/commercial/customer-pos/${poId}`);
  revalidatePath("/commercial/customer-pos");
  return fo;
}

export async function deleteCustomerPOAction(poId: string) {
  await CustomerPOService.deleteCustomerPO(poId);
  revalidatePath("/commercial/customer-pos");
  redirect("/commercial/customer-pos");
}
