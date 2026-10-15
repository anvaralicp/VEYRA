/* eslint-disable @typescript-eslint/no-explicit-any */
import { requirePermission, checkPermissionForUI } from "../../../../../lib/auth/boundary";
import { getTenantContext } from "../../../../../lib/tenant/context";
import { getTenantDb } from "../../../../../lib/db/tenant-db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, Send, CheckCheck, XCircle, FileText } from "lucide-react";
import { PageHeader } from "../../../../../components/ui/page-header";
import { ContentContainer } from "../../../../../components/ui/content-container";
import {
  submitSupplierPOForApproval,
  approveSupplierPO,
  issueSupplierPO,
  acknowledgeSupplierPO,
  cancelSupplierPO,
  addSupplierPurchaseOrderLine
} from "../../../../../lib/commercial/procurement-service";
import { revalidatePath } from "next/cache";

function getStatusBadge(status: string) {
  switch (status) {
    case "DRAFT":
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
          <FileText className="w-3.5 h-3.5 text-gray-500" /> Draft
        </span>
      );
    case "PENDING_APPROVAL":
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
          <Clock className="w-3.5 h-3.5 text-amber-500" /> Pending Approval
        </span>
      );
    case "APPROVED":
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /> Approved
        </span>
      );
    case "ISSUED":
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
          <Send className="w-3.5 h-3.5 text-purple-600" /> Issued
        </span>
      );
    case "ACKNOWLEDGED":
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
          <CheckCheck className="w-3.5 h-3.5 text-green-600" /> Acknowledged
        </span>
      );
    case "CANCELLED":
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
          <XCircle className="w-3.5 h-3.5 text-red-600" /> Cancelled
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
          {status}
        </span>
      );
  }
}

export const instant = false;

export default async function SupplierPODetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  await requirePermission("procurement.view");
  const ctx = await getTenantContext();
  const tdb: any = await getTenantDb();

  const resolvedParams = await Promise.resolve(params);
  const spoId = resolvedParams.id;

  const spo = await tdb.SupplierPurchaseOrder.findUnique({
    where: { id: spoId, tenant_id: ctx.tenantId },
    include: {
      vendor: true,
      currency: true,
      lines: {
        include: { productService: true },
        orderBy: { created_at: "asc" }
      },
      statusHistory: {
        orderBy: { created_at: "desc" }
      }
    }
  });

  if (!spo) notFound();

  const canSubmit = await checkPermissionForUI("procurement.submit");
  const canApprove = await checkPermissionForUI("procurement.approve");
  const canIssue = await checkPermissionForUI("procurement.issue");
  const canAcknowledge = await checkPermissionForUI("procurement.acknowledge");
  const canCancel = await checkPermissionForUI("procurement.cancel");
  const canUpdate = await checkPermissionForUI("procurement.update");

  // Server actions for transitions
  async function submitAction() {
    "use server";
    await submitSupplierPOForApproval(spoId);
    revalidatePath(`/procurement/purchase-orders/${spoId}`);
    revalidatePath("/procurement/purchase-orders");
  }

  async function approveAction() {
    "use server";
    await approveSupplierPO(spoId);
    revalidatePath(`/procurement/purchase-orders/${spoId}`);
    revalidatePath("/procurement/purchase-orders");
  }

  async function issueAction() {
    "use server";
    await issueSupplierPO(spoId);
    revalidatePath(`/procurement/purchase-orders/${spoId}`);
    revalidatePath("/procurement/purchase-orders");
  }

  async function acknowledgeAction() {
    "use server";
    await acknowledgeSupplierPO(spoId);
    revalidatePath(`/procurement/purchase-orders/${spoId}`);
    revalidatePath("/procurement/purchase-orders");
  }

  async function cancelAction(formData: FormData) {
    "use server";
    const reason = (formData.get("reason") as string) || "Cancelled by user";
    await cancelSupplierPO(spoId, reason);
    revalidatePath(`/procurement/purchase-orders/${spoId}`);
    revalidatePath("/procurement/purchase-orders");
  }

  async function addLineAction(formData: FormData) {
    "use server";
    const item_description_snapshot = formData.get("item_description") as string;
    const unit_of_measure = (formData.get("uom") as string) || "EA";
    const quantity = parseFloat(formData.get("quantity") as string) || 1;
    const unit_price = parseFloat(formData.get("unit_price") as string) || 0;
    const tax_rate = parseFloat(formData.get("tax_rate") as string) || 0;

    await addSupplierPurchaseOrderLine(spoId, {
      item_description_snapshot,
      unit_of_measure,
      quantity,
      unit_price,
      tax_rate
    });

    revalidatePath(`/procurement/purchase-orders/${spoId}`);
    revalidatePath("/procurement/purchase-orders");
  }

  const currencySymbol = spo.currency?.symbol || spo.currency?.code || "$";

  return (
    <ContentContainer>
      <PageHeader
        title={`Supplier PO: ${spo.po_number}`}
        description={`Vendor order for ${spo.vendor?.name || "Vendor"}`}
        actions={
          <div className="flex items-center gap-3">
            <Link
              href="/procurement/purchase-orders"
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>

            {/* Action buttons based on status machine */}
            {spo.status === "DRAFT" && canSubmit && (
              <form action={submitAction}>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition"
                >
                  Submit for Approval
                </button>
              </form>
            )}

            {spo.status === "DRAFT" && canIssue && (
              <form action={issueAction}>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 shadow-sm transition"
                >
                  Issue Directly
                </button>
              </form>
            )}

            {spo.status === "PENDING_APPROVAL" && canApprove && (
              <form action={approveAction}>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 shadow-sm transition"
                >
                  Approve PO
                </button>
              </form>
            )}

            {spo.status === "APPROVED" && canIssue && (
              <form action={issueAction}>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 shadow-sm transition"
                >
                  Issue PO
                </button>
              </form>
            )}

            {spo.status === "ISSUED" && canAcknowledge && (
              <form action={acknowledgeAction}>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 shadow-sm transition"
                >
                  Acknowledge PO
                </button>
              </form>
            )}

            {["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(spo.status) && canCancel && (
              <form action={cancelAction}>
                <button
                  type="submit"
                  className="px-3 py-2 border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 transition"
                >
                  Cancel PO
                </button>
              </form>
            )}
          </div>
        }
      />

      {/* PO Overview Card */}
      <div className="bg-white shadow border border-gray-200 rounded-xl p-6 mt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</h4>
            <div className="mt-1">{getStatusBadge(spo.status)}</div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor</h4>
            <p className="mt-1 text-sm font-medium text-gray-900">{spo.vendor?.name}</p>
            <p className="text-xs text-gray-500">{spo.vendor?.code}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Order Date</h4>
            <p className="mt-1 text-sm text-gray-900">{new Date(spo.order_date).toLocaleDateString()}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Expected Date</h4>
            <p className="mt-1 text-sm text-gray-900">
              {spo.expected_date ? new Date(spo.expected_date).toLocaleDateString() : "Not specified"}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Destination</h4>
            <p className="mt-1 text-sm text-gray-900">{spo.delivery_destination || "Standard Delivery"}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Currency</h4>
            <p className="mt-1 text-sm text-gray-900">{spo.currency?.code} ({spo.currency?.symbol})</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tax Total</h4>
            <p className="mt-1 text-sm text-gray-900">
              {currencySymbol} {Number(spo.tax_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Grand Total</h4>
            <p className="mt-1 text-base font-bold text-gray-900">
              {currencySymbol} {Number(spo.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Lines Section */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">Order Lines</h3>
        </div>

        {spo.status === "DRAFT" && canUpdate && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">Add Line Item</h4>
            <form action={addLineAction} className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  name="item_description"
                  required
                  placeholder="Item description *"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <input
                  type="text"
                  name="uom"
                  defaultValue="EA"
                  placeholder="UOM"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  name="quantity"
                  required
                  defaultValue="1"
                  placeholder="Qty *"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="unit_price"
                  required
                  placeholder="Unit Price *"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="tax_rate"
                  defaultValue="0"
                  placeholder="Tax %"
                  className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white shadow border border-gray-200 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  UOM
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Qty
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Unit Price
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Tax Rate
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Line Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {spo.lines.map((line: any) => (
                <tr key={line.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {line.item_description_snapshot}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                    {line.unit_of_measure}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {Number(line.quantity).toString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {currencySymbol} {Number(line.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    {Number(line.tax_rate).toString()}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                    {currencySymbol} {Number(line.line_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {spo.lines.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500 text-sm">
                    No items added yet. Add lines before submitting for approval.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status History Audit */}
      {spo.statusHistory && spo.statusHistory.length > 0 && (
        <div className="mt-8 bg-white shadow border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Workflow History</h3>
          <ul className="divide-y divide-gray-100 text-sm">
            {spo.statusHistory.map((h: any) => (
              <li key={h.id} className="py-2.5 flex justify-between items-center text-gray-600">
                <span className="font-medium text-gray-800">
                  Transitioned from <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{h.previous_status}</code> to{" "}
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{h.new_status}</code>
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(h.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ContentContainer>
  );
}
