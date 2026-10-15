/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use server";

export async function createQuotationFromBOQAction(formData: FormData) {
  const QuotationService = await import("../../lib/commercial/quotation-service");
  const boq_id = formData.get("boq_id") as string;
  const boq_revision_id = formData.get("boq_revision_id") as string;
  const currency_id = formData.get("currency_id") as string;
  const q = await QuotationService.createQuotationFromBOQ(boq_id, boq_revision_id, currency_id);
  const { revalidatePath } = await import("next/cache");
  const { redirect } = await import("next/navigation");
  revalidatePath("/commercial/quotations");
  redirect("/commercial/quotations/" + q.id);
}

export async function issueQuotationAction(revisionId: string) {
  const QuotationService = await import("../../lib/commercial/quotation-service");
  await QuotationService.issueQuotation(revisionId);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/commercial/quotations");
}

export async function createQuotationRevisionAction(quotationId: string) {
  const QuotationService = await import("../../lib/commercial/quotation-service");
  await QuotationService.createQuotationRevision(quotationId);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/commercial/quotations");
}

export async function withdrawQuotationAction(revisionId: string) {
  const QuotationService = await import("../../lib/commercial/quotation-service");
  await QuotationService.withdrawQuotation(revisionId);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/commercial/quotations");
}

export async function createVendorAction(formData: FormData) {
  const VendorService = await import("../../lib/commercial/vendor-service");
  const data = Object.fromEntries(formData.entries());
  const v = await VendorService.createVendor(data as any);
  const { revalidatePath } = await import("next/cache");
  const { redirect } = await import("next/navigation");
  revalidatePath("/commercial/vendors");
  redirect("/commercial/vendors/" + v.id);
}

export async function activateVendorAction(id: string) {
  const VendorService = await import("../../lib/commercial/vendor-service");
  await VendorService.updateVendor(id, { is_active: true });
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/commercial/vendors");
}

export async function deactivateVendorAction(id: string) {
  const VendorService = await import("../../lib/commercial/vendor-service");
  await VendorService.updateVendor(id, { is_active: false });
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/commercial/vendors");
}

export async function submitQuotationForApprovalAction(revisionId: string) {
  const QuotationApprovalService = await import("../../lib/commercial/quotation-approval-service");
  await QuotationApprovalService.submitQuotationForApproval(revisionId);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/commercial/quotations");
}

export async function decideQuotationApprovalAction(formData: FormData) {
  const QuotationApprovalService = await import("../../lib/commercial/quotation-approval-service");
  const revisionId = formData.get("revision_id") as string;
  const decision = formData.get("decision") as "APPROVED" | "RETURNED" | "REJECTED";
  const comments = formData.get("comments") as string;
  await QuotationApprovalService.decideQuotationApproval(revisionId, decision, comments);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/commercial/quotations");
  revalidatePath("/commercial/quotations/approvals");
}

export async function updateApprovalSettingsAction(formData: FormData) {
  const QuotationApprovalService = await import("../../lib/commercial/quotation-approval-service");
  const is_approval_enabled = formData.get("is_approval_enabled") === "true";
  const require_separation_of_duties = formData.get("require_separation_of_duties") === "true";

  const val = formData.get("value_threshold") as string;
  const value_threshold = val ? parseFloat(val) : null;

  const cur = formData.get("currency_id") as string;
  const currency_id = cur && cur.trim() !== "" ? cur : null;

  const mgn = formData.get("min_margin_threshold") as string;
  const min_margin_threshold = mgn ? parseFloat(mgn) : null;

  await QuotationApprovalService.updateApprovalSettings({
    is_approval_enabled,
    value_threshold,
    currency_id,
    min_margin_threshold,
    require_separation_of_duties
  });
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/commercial/quotations/approval-settings");
}

import * as FulfilmentService from "../../lib/commercial/fulfilment-service";

export async function createFulfilmentOrder(poId: string) {
  return await FulfilmentService.createFulfilmentOrderFromCustomerPO(poId);
}

export async function updateFulfilmentPlanning(orderId: string, data: any) {
  return await FulfilmentService.updateFulfilmentPlanning(orderId, data);
}

export async function updateFulfilmentOrderLinePlanning(lineId: string, data: any) {
  return await FulfilmentService.updateFulfilmentOrderLinePlanning(lineId, data);
}

export async function markFulfilmentPlanning(orderId: string) {
  return await FulfilmentService.markFulfilmentPlanning(orderId);
}

export async function markFulfilmentReady(orderId: string) {
  return await FulfilmentService.markFulfilmentReady(orderId);
}

export async function holdFulfilmentOrder(orderId: string, reason: string) {
  return await FulfilmentService.holdFulfilmentOrder(orderId, reason);
}

export async function resumeFulfilmentOrder(orderId: string) {
  return await FulfilmentService.resumeFulfilmentOrder(orderId);
}

export async function cancelFulfilmentOrder(orderId: string, reason: string) {
  return await FulfilmentService.cancelFulfilmentOrder(orderId, reason);
}

import * as ProcService from "../../lib/commercial/procurement-service";

export async function createSupplierPurchaseOrder(data: { vendor_id: string, currency_id: string, expected_date?: string, delivery_destination?: string }) {
  return await ProcService.createSupplierPurchaseOrder(data);
}

export async function addSupplierPurchaseOrderLine(spoId: string, data: any) {
  return await ProcService.addSupplierPurchaseOrderLine(spoId, data);
}

export async function submitSupplierPOForApproval(spoId: string) {
  return await ProcService.submitSupplierPOForApproval(spoId);
}

export async function approveSupplierPO(spoId: string) {
  return await ProcService.approveSupplierPO(spoId);
}

export async function issueSupplierPO(spoId: string) {
  return await ProcService.issueSupplierPO(spoId);
}

export async function acknowledgeSupplierPO(spoId: string) {
  return await ProcService.acknowledgeSupplierPO(spoId);
}

export async function cancelSupplierPO(spoId: string, reason: string) {
  return await ProcService.cancelSupplierPO(spoId, reason);
}

import * as LocService from "../../lib/inventory/location-service";
import * as GRService from "../../lib/inventory/goods-receipt-service";

export async function createStockLocation(data: { code: string, name: string, branch_id?: string }) {
  return await LocService.createStockLocation(data);
}

export async function updateStockLocation(id: string, data: { name?: string, status?: string }) {
  return await LocService.updateStockLocation(id, data);
}

export async function createGoodsReceiptFromSupplierPO(spoId: string, stockLocationId: string, deliveryNote?: string) {
  return await GRService.createGoodsReceiptFromSupplierPO(spoId, stockLocationId, deliveryNote);
}

export async function addGoodsReceiptLine(receiptId: string, spoLineId: string, receivedQty: string | number) {
  return await GRService.addGoodsReceiptLine(receiptId, spoLineId, receivedQty);
}

export async function updateGoodsReceiptLine(lineId: string, data: any) {
  return await GRService.updateGoodsReceiptLine(lineId, data);
}

export async function postGoodsReceipt(receiptId: string) {
  return await GRService.postGoodsReceipt(receiptId);
}

export async function getStockBalance(productId: string, stockLocationId?: string) {
  return await GRService.getStockBalance(productId, stockLocationId);
}

// DUMMY ACTIONS FOR SCAFFOLDING
export async function deactivateCategoryAction(...args: any[]) { throw new Error('Not implemented'); }

// SCAFFOLD ACTIONS
export async function createCategoryAction(...args: any[]) { throw new Error('Not implemented'); }
export async function updateCostingSettingsAction(...args: any[]) { throw new Error('Not implemented'); }
export async function createCurrencyAction(...args: any[]) { throw new Error('Not implemented'); }
export async function deactivateCurrencyAction(...args: any[]) { throw new Error('Not implemented'); }
export async function activateCurrencyAction(...args: any[]) { throw new Error('Not implemented'); }
export async function setDefaultCurrencyAction(...args: any[]) { throw new Error('Not implemented'); }
export async function deactivateManufacturerAction(...args: any[]) { throw new Error('Not implemented'); }
export async function createManufacturerAction(...args: any[]) { throw new Error('Not implemented'); }
export async function deactivateProductAction(...args: any[]) { throw new Error('Not implemented'); }
export async function deactivateProductVendorAction(...args: any[]) { throw new Error('Not implemented'); }
export async function activateProductVendorAction(...args: any[]) { throw new Error('Not implemented'); }
export async function setPreferredVendorAction(...args: any[]) { throw new Error('Not implemented'); }
export async function clearPreferredVendorAction(...args: any[]) { throw new Error('Not implemented'); }
export async function deactivateVendorPriceAction(...args: any[]) { throw new Error('Not implemented'); }
export async function activateVendorPriceAction(...args: any[]) { throw new Error('Not implemented'); }
export async function createVendorPriceAction(...args: any[]) { throw new Error('Not implemented'); }
export async function createProductVendorAction(...args: any[]) { throw new Error('Not implemented'); }
export async function createProductAction(...args: any[]) { throw new Error('Not implemented'); }
export async function updateCustomerAction(id: string, formData: FormData) {
  const CustomerService = await import("../../lib/crm/customer-service");
  const data = Object.fromEntries(formData.entries());
  await CustomerService.updateCustomer(id, data as any);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/crm/customers");
  revalidatePath("/crm/customers/" + id);
}

export async function createContactAction(customerId: string, formData: FormData) {
  const CustomerService = await import("../../lib/crm/customer-service");
  const data = Object.fromEntries(formData.entries());
  await CustomerService.createContact(customerId, data as any);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/crm/customers/" + customerId);
}

export async function createSiteAction(customerId: string, formData: FormData) {
  const CustomerService = await import("../../lib/crm/customer-service");
  const data = Object.fromEntries(formData.entries());
  await CustomerService.createSite(customerId, data as any);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/crm/customers/" + customerId);
}

export async function createCustomerAction(formData: FormData) {
  const CustomerService = await import("../../lib/crm/customer-service");
  const data = Object.fromEntries(formData.entries());
  const customer = await CustomerService.createCustomer(data as any);
  const { revalidatePath } = await import("next/cache");
  const { redirect } = await import("next/navigation");
  revalidatePath("/crm/customers");
  redirect("/crm/customers/" + customer.id);
}

export async function convertLeadAction(leadId: string, formData: FormData) {
  const LeadService = await import("../../lib/crm/lead-service");
  const create_customer = formData.get("create_customer") === "true";
  const customer_id = (formData.get("customer_id") as string) || undefined;
  const opportunity_name = (formData.get("opportunity_name") as string) || undefined;
  const estimated_value_raw = formData.get("estimated_value") as string;
  const estimated_value = estimated_value_raw && !isNaN(parseFloat(estimated_value_raw)) ? parseFloat(estimated_value_raw) : undefined;
  const expected_close_date = (formData.get("expected_close_date") as string) || undefined;

  const result = await LeadService.convertLead(leadId, {
    create_customer,
    customer_id,
    ...(opportunity_name ? { opportunity_name } : {}),
    ...(estimated_value !== undefined ? { estimated_value } : {}),
    ...(expected_close_date ? { expected_close_date } : {}),
  });
  const { revalidatePath } = await import("next/cache");
  const { redirect } = await import("next/navigation");
  revalidatePath("/crm/leads");
  revalidatePath("/crm/leads/" + leadId);
  revalidatePath("/crm/opportunities");
  revalidatePath("/crm/customers");
  redirect("/crm/opportunities/" + result.opportunityId);
}

export async function createLeadAction(formData: FormData) {
  const LeadService = await import("../../lib/crm/lead-service");
  const data = Object.fromEntries(formData.entries());
  const lead = await LeadService.createLead(data as any);
  const { revalidatePath } = await import("next/cache");
  const { redirect } = await import("next/navigation");
  revalidatePath("/crm/leads");
  redirect("/crm/leads/" + lead.id);
}

export async function markOpportunityWonAction(id: string) {
  const OpportunityService = await import("../../lib/crm/opportunity-service");
  await OpportunityService.markOpportunityWon(id);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/crm/opportunities");
  revalidatePath("/crm/opportunities/" + id);
}

export async function markOpportunityLostAction(id: string, reasonOrFormData?: string | FormData) {
  const OpportunityService = await import("../../lib/crm/opportunity-service");
  let reason = "Lost";
  if (typeof reasonOrFormData === "string") {
    reason = reasonOrFormData;
  } else if (reasonOrFormData && typeof (reasonOrFormData as FormData).get === "function") {
    reason = ((reasonOrFormData as FormData).get("loss_reason") as string) || "Lost";
  }
  await OpportunityService.markOpportunityLost(id, reason);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/crm/opportunities");
  revalidatePath("/crm/opportunities/" + id);
}

export async function createOpportunityAction(formData: FormData) {
  const OpportunityService = await import("../../lib/crm/opportunity-service");
  const data = Object.fromEntries(formData.entries());
  const opp = await OpportunityService.createOpportunity(data as any);
  const { revalidatePath } = await import("next/cache");
  const { redirect } = await import("next/navigation");
  revalidatePath("/crm/opportunities");
  redirect("/crm/opportunities/" + opp.id);
}

export async function addBOQLineAction(boqId: string, revisionId: string, formData: FormData) {
  const BOQService = await import("../../lib/presales/boq-service");
  const data = Object.fromEntries(formData.entries());
  await BOQService.addBOQLine(boqId, revisionId, data as any);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/presales/boqs/" + boqId);
}

export async function submitBOQRevisionAction(boqId: string, revisionId: string) {
  const BOQService = await import("../../lib/presales/boq-service");
  await BOQService.submitBOQRevision(boqId, revisionId);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/presales/boqs/" + boqId);
}

export async function approveBOQRevisionAction(boqId: string, revisionId: string) {
  const BOQService = await import("../../lib/presales/boq-service");
  await BOQService.approveBOQRevision(boqId, revisionId);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/presales/boqs/" + boqId);
}

export async function rejectBOQRevisionAction(boqId: string, revisionId: string) {
  const BOQService = await import("../../lib/presales/boq-service");
  await BOQService.rejectBOQRevision(boqId, revisionId);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/presales/boqs/" + boqId);
}

export async function newBOQRevisionAction(boqId: string) {
  const BOQService = await import("../../lib/presales/boq-service");
  await BOQService.createBOQRevision(boqId);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/presales/boqs/" + boqId);
}

export async function createBOQAction(formData: FormData) {
  const BOQService = await import("../../lib/presales/boq-service");
  const data = Object.fromEntries(formData.entries());
  const boq = await BOQService.createBOQ(data as any);
  const { revalidatePath } = await import("next/cache");
  const { redirect } = await import("next/navigation");
  revalidatePath("/presales/boqs");
  redirect("/presales/boqs/" + boq.id);
}

export async function createRequirementAction(formData: FormData) {
  const RequirementService = await import("../../lib/presales/requirement-service");
  const data = Object.fromEntries(formData.entries());
  const req = await RequirementService.createRequirement(data as any);
  const { revalidatePath } = await import("next/cache");
  const { redirect } = await import("next/navigation");
  revalidatePath("/presales/requirements");
  redirect("/presales/requirements/" + req.id);
}

export async function createSiteSurveyAction(formData: FormData) {
  const SiteSurveyService = await import("../../lib/presales/site-survey-service");
  const data = Object.fromEntries(formData.entries());
  const survey = await SiteSurveyService.createSiteSurvey(data as any);
  const { revalidatePath } = await import("next/cache");
  const { redirect } = await import("next/navigation");
  revalidatePath("/presales/site-surveys");
  redirect("/presales/site-surveys/" + survey.id);
}

export async function newSolutionRevisionAction(solutionId: string, formData: FormData) {
  const SolutionService = await import("../../lib/presales/solution-service");
  const title = (formData.get("title") as string) || undefined;
  const description = (formData.get("description") as string) || undefined;
  await SolutionService.createSolutionRevision(solutionId, { title, description });
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/presales/solutions/" + solutionId);
}

export async function createSolutionAction(formData: FormData) {
  const SolutionService = await import("../../lib/presales/solution-service");
  const data = Object.fromEntries(formData.entries());
  const sol = await SolutionService.createSolution(data as any);
  const { revalidatePath } = await import("next/cache");
  const { redirect } = await import("next/navigation");
  revalidatePath("/presales/solutions");
  redirect("/presales/solutions/" + sol.id);
}
