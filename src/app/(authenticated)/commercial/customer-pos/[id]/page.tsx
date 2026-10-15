/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { requirePermission, checkPermissionForUI } from "../../../../../lib/auth/boundary";
import { getCustomerPO, generatePOValidationFindings } from "../../../../../lib/commercial/customer-po-service";
import {
  submitCustomerPOAction,
  validateCustomerPOAction,
  createFulfilmentOrderAction,
  deleteCustomerPOAction,
  addCustomerPOLineAction
} from "../actions";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  PackageCheck,
  Undo2,
  Trash2,
  PlusCircle,
  ExternalLink,
  ShieldAlert,
  Info
} from "lucide-react";

export const instant = false;

export default async function CustomerPODetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}) {
  await requirePermission("customer_po.view");

  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);

  const po = await getCustomerPO(resolvedParams.id);
  if (!po) notFound();

  let findings: any[] = [];
  try {
    findings = await generatePOValidationFindings(resolvedParams.id);
  } catch {
    findings = [];
  }

  const canUpdate = await checkPermissionForUI("customer_po.update");
  const canSubmit = await checkPermissionForUI("customer_po.submit");
  const canValidate = await checkPermissionForUI("customer_po.validate");
  const canDelete = await checkPermissionForUI("customer_po.delete");
  const canCreateFulfilment = await checkPermissionForUI("fulfilment.create");

  const activeTab = resolvedSearchParams?.tab || "overview";

  const hasBlockingErrors = findings.some((f: any) => f.severity === "ERROR");

  const tabs = [
    { id: "overview", label: "Overview", href: `/commercial/customer-pos/${po.id}?tab=overview` },
    { id: "lines", label: `Lines (${po.lines?.length || 0})`, href: `/commercial/customer-pos/${po.id}?tab=lines` },
    { id: "validation", label: `Validation & Review (${po.validations?.length || 0})`, href: `/commercial/customer-pos/${po.id}?tab=validation` },
    { id: "fulfilment", label: po.fulfilmentOrder ? `Fulfilment (${po.fulfilmentOrder.order_number})` : "Fulfilment", href: `/commercial/customer-pos/${po.id}?tab=fulfilment` },
  ];

  return (
    <RecordPage
      title={po.po_number}
      recordNumber={po.customer?.name}
      breadcrumbs={[
        { label: "Commercial", href: "/commercial/quotations" },
        { label: "Customer POs", href: "/commercial/customer-pos" },
        { label: po.po_number, href: `/commercial/customer-pos/${po.id}` },
      ]}
      status={
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
            po.status === "VALIDATED"
              ? "bg-green-100 text-green-800"
              : po.status === "SUBMITTED"
              ? "bg-amber-100 text-amber-800"
              : po.status === "UNDER_REVIEW"
              ? "bg-purple-100 text-purple-800"
              : po.status === "RETURNED"
              ? "bg-orange-100 text-orange-800"
              : po.status === "REJECTED"
              ? "bg-red-100 text-red-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {po.status}
        </span>
      }
      actions={
        <div className="flex items-center gap-2">
          {/* Submit Action */}
          {(po.status === "DRAFT" || po.status === "RETURNED") && canSubmit && (
            <form
              action={async () => {
                "use server";
                await submitCustomerPOAction(po.id);
              }}
            >
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 shadow-sm inline-flex items-center gap-1.5"
              >
                <Clock className="w-4 h-4" />
                Submit for Validation
              </button>
            </form>
          )}

          {/* Fulfilment Action */}
          {po.status === "VALIDATED" && !po.fulfilmentOrder && canCreateFulfilment && (
            <form
              action={async () => {
                "use server";
                await createFulfilmentOrderAction(po.id);
              }}
            >
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 shadow-sm inline-flex items-center gap-1.5"
              >
                <PackageCheck className="w-4 h-4" />
                Generate Fulfilment Order
              </button>
            </form>
          )}

          {/* Delete Draft */}
          {po.status === "DRAFT" && canDelete && (
            <form
              action={async () => {
                "use server";
                await deleteCustomerPOAction(po.id);
              }}
            >
              <button
                type="submit"
                className="px-3 py-2 bg-white border border-red-300 text-red-600 rounded-md text-sm font-medium hover:bg-red-50 inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Delete Draft
              </button>
            </form>
          )}
        </div>
      }
      activeTab={activeTab}
      tabs={tabs}
    >
      <div className="p-6 space-y-6">
        {/* Discrepancy Findings Alert Banner */}
        {findings.length > 0 && (
          <div
            className={`p-4 rounded-lg border ${
              hasBlockingErrors
                ? "bg-red-50 border-red-200 text-red-900"
                : "bg-amber-50 border-amber-200 text-amber-900"
            }`}
          >
            <div className="flex items-start gap-3">
              {hasBlockingErrors ? (
                <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h4 className="text-sm font-semibold">
                  {hasBlockingErrors
                    ? "Discrepancy Validation: Blocking Errors Detected"
                    : "Discrepancy Validation: Discrepancy Warnings"}
                </h4>
                <p className="text-xs mt-1">
                  {hasBlockingErrors
                    ? "The purchase order contains blocking errors compared to the linked quotation revision and cannot be validated until resolved."
                    : "The purchase order has non-blocking differences against the quotation that should be reviewed prior to acceptance."}
                </p>
                <ul className="mt-3 space-y-1.5 text-xs">
                  {findings.map((f: any, idx: number) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          f.severity === "ERROR"
                            ? "bg-red-200 text-red-800"
                            : f.severity === "WARNING"
                            ? "bg-amber-200 text-amber-800"
                            : "bg-blue-200 text-blue-800"
                        }`}
                      >
                        {f.severity}
                      </span>
                      <span className="font-mono font-medium">{f.type}:</span>
                      <span>{f.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Evaluation & Decision Card (Visible for SUBMITTED / UNDER_REVIEW) */}
        {(po.status === "SUBMITTED" || po.status === "UNDER_REVIEW") && canValidate && (
          <div className="bg-white p-5 rounded-lg border border-purple-200 shadow-sm">
            <h3 className="text-sm font-semibold text-purple-900 flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-purple-600" />
              Commercial PO Review & Validation Gate
            </h3>
            <p className="text-xs text-gray-600 mb-4">
              Review discrepancy findings, commercial terms, and line allocations before accepting this PO.
            </p>

            <form action={validateCustomerPOAction} className="space-y-4">
              <input type="hidden" name="po_id" value={po.id} />

              <div>
                <label className="block text-xs font-medium text-gray-700">Review Comments</label>
                <textarea
                  name="comments"
                  rows={2}
                  placeholder="Enter validation notes, reason for return, or rejection rationale..."
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm p-2 border bg-white focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  name="decision"
                  value="VALIDATED"
                  disabled={hasBlockingErrors}
                  className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Accept & Validate PO
                </button>

                <button
                  type="submit"
                  name="decision"
                  value="RETURNED"
                  className="px-4 py-2 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700 shadow-sm inline-flex items-center gap-1.5"
                >
                  <Undo2 className="w-4 h-4" />
                  Return for Clarification
                </button>

                <button
                  type="submit"
                  name="decision"
                  value="REJECTED"
                  className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 shadow-sm inline-flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  Reject Customer PO
                </button>
              </div>
              {hasBlockingErrors && (
                <p className="text-xs text-red-600 mt-1">
                  * PO cannot be validated while blocking errors remain. Please return for correction or reject.
                </p>
              )}
            </form>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Header Details */}
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b">
                  PO Header Information
                </h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-gray-500">Customer</dt>
                    <dd className="font-medium text-gray-900 mt-0.5">{po.customer?.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Customer PO Number</dt>
                    <dd className="font-medium text-gray-900 mt-0.5">{po.po_number}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">PO Issue Date</dt>
                    <dd className="text-gray-700 mt-0.5">{new Date(po.po_date).toLocaleDateString()}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">PO Received Date</dt>
                    <dd className="text-gray-700 mt-0.5">{new Date(po.received_date).toLocaleDateString()}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Valid Until</dt>
                    <dd className="text-gray-700 mt-0.5">
                      {po.valid_until ? new Date(po.valid_until).toLocaleDateString() : "Not specified"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Currency</dt>
                    <dd className="text-gray-700 mt-0.5">
                      {po.currency?.code} ({po.currency?.symbol})
                    </dd>
                  </div>
                  {po.notes && (
                    <div className="col-span-2 pt-2 border-t mt-1">
                      <dt className="text-xs text-gray-500">Notes & Terms</dt>
                      <dd className="text-gray-700 mt-0.5 whitespace-pre-wrap">{po.notes}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Linked Quotation Card */}
              <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b flex items-center justify-between">
                  <span>Linked Quotation Revision</span>
                  {po.quotation && (
                    <Link
                      href={`/commercial/quotations/${po.quotation.id}`}
                      className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-normal"
                    >
                      View Quotation <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </h3>
                {po.quotationRevision ? (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <dt className="text-xs text-gray-500">Quotation Number</dt>
                      <dd className="font-medium text-gray-900 mt-0.5">
                        {po.quotation?.quotation_number}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Revision</dt>
                      <dd className="font-medium text-gray-900 mt-0.5">
                        Rev {po.quotationRevision.revision_number} ({po.quotationRevision.status})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Quotation Title</dt>
                      <dd className="text-gray-700 mt-0.5">{po.quotation?.title}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Quotation Grand Total</dt>
                      <dd className="font-semibold text-gray-900 mt-0.5">
                        {po.quotationRevision.currency_symbol_snapshot}
                        {Number(po.quotationRevision.grand_total).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-xs text-gray-500 italic">
                    This Customer PO was recorded directly without referencing a quotation revision.
                  </p>
                )}
              </div>
            </div>

            {/* Financial Summary Column */}
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b">
                  Financial Summary
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal:</span>
                    <span className="font-medium text-gray-900">
                      {po.currency?.symbol}
                      {Number(po.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Tax Total:</span>
                    <span className="font-medium text-gray-900">
                      {po.currency?.symbol}
                      {Number(po.tax_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="pt-3 border-t flex justify-between text-base font-bold text-gray-900">
                    <span>Grand Total:</span>
                    <span className="text-blue-600">
                      {po.currency?.symbol}
                      {Number(po.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fulfilment Status Card */}
              <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-emerald-600" />
                  Fulfilment Order
                </h3>
                {po.fulfilmentOrder ? (
                  <div className="text-xs space-y-2">
                    <p className="font-medium text-gray-900">
                      Order #: {po.fulfilmentOrder.order_number}
                    </p>
                    <p className="text-gray-500">
                      Status:{" "}
                      <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {po.fulfilmentOrder.status}
                      </span>
                    </p>
                    <p className="text-gray-500">
                      Lines to fulfill: {po.fulfilmentOrder.lines?.length || 0}
                    </p>
                  </div>
                ) : po.status === "VALIDATED" ? (
                  <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded border border-amber-200">
                    PO has been validated. You can now generate the fulfilment order to allocate stock and initiate fulfillment.
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    Fulfilment order will be generated once PO is validated.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LINES */}
        {activeTab === "lines" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-900">
                  Customer Purchase Order Line Items ({po.lines?.length || 0})
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Item Code</th>
                      <th className="px-4 py-3 font-medium">Description</th>
                      <th className="px-4 py-3 font-medium">Quotation Match</th>
                      <th className="px-4 py-3 font-medium text-right">Quantity</th>
                      <th className="px-4 py-3 font-medium text-right">Unit Price</th>
                      <th className="px-4 py-3 font-medium text-right">Tax Amount</th>
                      <th className="px-4 py-3 font-medium text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {po.lines?.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          No line items recorded yet.
                        </td>
                      </tr>
                    ) : (
                      po.lines?.map((line: any) => (
                        <tr key={line.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{line.line_number}</td>
                          <td className="px-4 py-3 font-mono text-gray-600">{line.customer_item_code || "-"}</td>
                          <td className="px-4 py-3 text-gray-900 font-medium">{line.customer_item_description}</td>
                          <td className="px-4 py-3">
                            {line.quotation_line_id ? (
                              <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded text-[11px] font-medium border border-green-200">
                                <CheckCircle2 className="w-3 h-3 text-green-600" /> Matched Line
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-gray-500 bg-gray-50 px-2 py-0.5 rounded text-[11px] border">
                                <Info className="w-3 h-3 text-gray-400" /> Unmatched
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            {Number(line.quantity)} {line.unit_of_measure}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {po.currency?.symbol}{Number(line.unit_price).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {po.currency?.symbol}{Number(line.tax_amount).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">
                            {po.currency?.symbol}{Number(line.line_total).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Add Line Item Form (if DRAFT or RETURNED) */}
            {(po.status === "DRAFT" || po.status === "RETURNED") && canUpdate && (
              <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-blue-600" />
                  Add Line Item Manually
                </h4>
                <form action={addCustomerPOLineAction} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                  <input type="hidden" name="po_id" value={po.id} />
                  <div>
                    <label className="block text-gray-700 font-medium">Customer Item Code</label>
                    <input
                      type="text"
                      name="customer_item_code"
                      placeholder="e.g. SKU-123"
                      className="mt-1 w-full p-2 border rounded"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-gray-700 font-medium">Description *</label>
                    <input
                      type="text"
                      name="customer_item_description"
                      required
                      placeholder="Item name / description"
                      className="mt-1 w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium">Quantity *</label>
                    <input
                      type="number"
                      step="0.01"
                      name="quantity"
                      required
                      defaultValue="1"
                      className="mt-1 w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium">Unit Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      name="unit_price"
                      required
                      placeholder="0.00"
                      className="mt-1 w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium">Tax Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      name="tax_amount"
                      defaultValue="0"
                      className="mt-1 w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium">Line Total *</label>
                    <input
                      type="number"
                      step="0.01"
                      name="line_total"
                      required
                      placeholder="0.00"
                      className="mt-1 w-full p-2 border rounded"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
                    >
                      Add Line
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: VALIDATION HISTORY */}
        {activeTab === "validation" && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b">
              Validation & Review History Trail
            </h3>
            {po.validations?.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-4">
                No validation review decisions recorded yet.
              </p>
            ) : (
              <div className="space-y-4">
                {po.validations?.map((v: any) => (
                  <div key={v.id} className="p-4 rounded-lg border border-gray-200 bg-gray-50/50 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">
                        Status Transition: {v.previous_status} &rarr;{" "}
                        <span
                          className={`font-bold ${
                            v.new_status === "VALIDATED"
                              ? "text-green-700"
                              : v.new_status === "RETURNED"
                              ? "text-orange-700"
                              : "text-red-700"
                          }`}
                        >
                          {v.new_status}
                        </span>
                      </span>
                      <span className="text-gray-500">
                        {new Date(v.created_at).toLocaleString()}
                      </span>
                    </div>
                    {v.comments && (
                      <p className="text-gray-700 bg-white p-2.5 rounded border border-gray-100">
                        <span className="font-medium text-gray-500">Reviewer Notes: </span>
                        {v.comments}
                      </p>
                    )}
                    {v.findings && Array.isArray(v.findings) && v.findings.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <span className="font-medium text-gray-500">Recorded Findings at Evaluation:</span>
                        <ul className="mt-1 space-y-1 list-disc list-inside text-gray-600">
                          {v.findings.map((f: any, fIdx: number) => (
                            <li key={fIdx}>
                              [{f.severity}] {f.type}: {f.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: FULFILMENT */}
        {activeTab === "fulfilment" && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b">
              Downstream Fulfilment Details
            </h3>
            {po.fulfilmentOrder ? (
              <div className="space-y-4">
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <dt className="text-gray-500">Fulfilment Order #</dt>
                    <dd className="font-bold text-gray-900 mt-1">{po.fulfilmentOrder.order_number}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Status</dt>
                    <dd className="font-semibold text-emerald-700 mt-1">{po.fulfilmentOrder.status}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Created At</dt>
                    <dd className="text-gray-700 mt-1">
                      {new Date(po.fulfilmentOrder.created_at).toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Order Lines</dt>
                    <dd className="text-gray-700 mt-1">{po.fulfilmentOrder.lines?.length || 0} items</dd>
                  </div>
                </dl>

                {po.fulfilmentOrder.lines?.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-xs font-semibold text-gray-900 mb-2">Fulfilment Lines</h4>
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50 text-gray-500 uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">Item Code</th>
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-right">Accepted Qty</th>
                          <th className="px-3 py-2 text-right">Planned Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {po.fulfilmentOrder.lines.map((fol: any) => (
                          <tr key={fol.id}>
                            <td className="px-3 py-2 font-mono text-gray-600">{fol.item_code_snapshot || "-"}</td>
                            <td className="px-3 py-2 text-gray-900 font-medium">{fol.item_description_snapshot}</td>
                            <td className="px-3 py-2 text-right">{Number(fol.accepted_quantity)} {fol.unit_of_measure}</td>
                            <td className="px-3 py-2 text-right font-semibold">{Number(fol.planned_quantity)} {fol.unit_of_measure}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <PackageCheck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No fulfilment order linked to this Customer PO yet.</p>
                {po.status === "VALIDATED" && canCreateFulfilment && (
                  <form
                    action={async () => {
                      "use server";
                      await createFulfilmentOrderAction(po.id);
                    }}
                    className="mt-4"
                  >
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 text-white rounded-md text-xs font-medium hover:bg-emerald-700 shadow-sm"
                    >
                      Generate Fulfilment Order Now
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </RecordPage>
  );
}
