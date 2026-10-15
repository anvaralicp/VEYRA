/* eslint-disable @typescript-eslint/no-explicit-any */
import { requirePermission, checkPermissionForUI } from "../../../../lib/auth/boundary";
import { getTenantContext } from "../../../../lib/tenant/context";
import { getTenantDb } from "../../../../lib/db/tenant-db";
import Link from "next/link";
import { Plus, FileText, Clock, CheckCircle2, Send, CheckCheck, XCircle } from "lucide-react";
import { PageHeader } from "../../../../components/ui/page-header";
import { ContentContainer } from "../../../../components/ui/content-container";

function getStatusBadge(status: string) {
  switch (status) {
    case "DRAFT":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <FileText className="w-3 h-3 text-gray-500" /> Draft
        </span>
      );
    case "PENDING_APPROVAL":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          <Clock className="w-3 h-3 text-amber-500" /> Pending Approval
        </span>
      );
    case "APPROVED":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <CheckCircle2 className="w-3 h-3 text-blue-600" /> Approved
        </span>
      );
    case "ISSUED":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          <Send className="w-3 h-3 text-purple-600" /> Issued
        </span>
      );
    case "ACKNOWLEDGED":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCheck className="w-3 h-3 text-green-600" /> Acknowledged
        </span>
      );
    case "CANCELLED":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3 text-red-600" /> Cancelled
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {status}
        </span>
      );
  }
}

export const instant = false;

export default async function SupplierPOListPage() {
  await requirePermission("procurement.view");
  const ctx = await getTenantContext();
  const tdb: any = await getTenantDb();
  const canCreate = await checkPermissionForUI("procurement.create");

  const orders = await tdb.SupplierPurchaseOrder.findMany({
    where: { tenant_id: ctx.tenantId },
    include: {
      vendor: { select: { id: true, name: true, code: true } },
      currency: { select: { id: true, code: true, symbol: true } }
    },
    orderBy: { created_at: "desc" }
  });

  return (
    <ContentContainer>
      <PageHeader
        title="Supplier Purchase Orders"
        description="Manage vendor orders, approvals, issuance, and procurement status."
        actions={
          canCreate ? (
            <Link
              href="/procurement/purchase-orders/new"
              className="inline-flex items-center gap-2 px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
              New Supplier PO
            </Link>
          ) : undefined
        }
      />

      <div className="bg-white shadow border border-gray-200 rounded-xl overflow-hidden mt-6">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  PO Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Order Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Expected Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Grand Total
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((spo: any) => {
                const currencySymbol = spo.currency?.symbol || spo.currency?.code || "$";
                return (
                  <tr key={spo.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                      <Link href={`/procurement/purchase-orders/${spo.id}`} className="hover:underline">
                        {spo.po_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {spo.vendor?.name || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(spo.order_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {spo.expected_date ? new Date(spo.expected_date).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      {currencySymbol} {Number(spo.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {getStatusBadge(spo.status)}
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-sm">
                    No supplier purchase orders found. Click &quot;New Supplier PO&quot; to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ContentContainer>
  );
}
