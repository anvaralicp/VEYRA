/* eslint-disable @typescript-eslint/no-explicit-any */
import { requirePermission, checkPermissionForUI } from "../../../../lib/auth/boundary";
import { listCustomerPOs } from "../../../../lib/commercial/customer-po-service";
import Link from "next/link";
import { Plus, ChevronRight, FileText, CheckCircle2, Clock, XCircle, Undo2 } from "lucide-react";
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
    case "SUBMITTED":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          <Clock className="w-3 h-3 text-amber-500" /> Submitted
        </span>
      );
    case "UNDER_REVIEW":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          <Clock className="w-3 h-3 text-purple-500" /> Under Review
        </span>
      );
    case "VALIDATED":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle2 className="w-3 h-3 text-green-600" /> Validated
        </span>
      );
    case "RETURNED":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          <Undo2 className="w-3 h-3 text-orange-600" /> Returned
        </span>
      );
    case "REJECTED":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3 text-red-600" /> Rejected
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

export default async function CustomerPOsListPage({
  searchParams,
}: {
  searchParams?: Promise<{ search?: string; status?: string; page?: string }> | { search?: string; status?: string; page?: string };
}) {
  await requirePermission("customer_po.view");
  const canCreate = await checkPermissionForUI("customer_po.create");

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const search = resolvedSearchParams?.search || "";
  const statusFilter = resolvedSearchParams?.status || "";
  const page = parseInt(resolvedSearchParams?.page || "1", 10) || 1;

  const result = await listCustomerPOs({
    search: search || undefined,
    status: statusFilter || undefined,
    page,
    limit: 25,
  });

  const actions = canCreate ? (
    <Link
      href="/commercial/customer-pos/new"
      className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 shadow-sm"
    >
      <Plus className="mr-2 h-4 w-4" />
      Record Customer PO
    </Link>
  ) : null;

  const statuses = ["ALL", "DRAFT", "SUBMITTED", "UNDER_REVIEW", "VALIDATED", "RETURNED", "REJECTED"];

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      <PageHeader
        title="Customer Purchase Orders"
        description="Receive, validate against quotation revisions, and fulfill client purchase orders."
        actions={actions}
      />

      <ContentContainer className="flex-1 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
          {/* Filter Bar */}
          <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
            <form method="GET" className="flex items-center gap-3 w-full sm:w-auto flex-1">
              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder="Search PO #, Customer, or Notes..."
                className="w-full sm:w-72 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <button
                type="submit"
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Search
              </button>
              {search && (
                <Link
                  href="/commercial/customer-pos"
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Clear
                </Link>
              )}
            </form>

            {/* Status Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {statuses.map((st) => {
                const isSelected = (!statusFilter && st === "ALL") || statusFilter === st;
                const href = st === "ALL" ? "/commercial/customer-pos" : `/commercial/customer-pos?status=${st}`;
                return (
                  <Link
                    key={st}
                    href={href}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {st}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3 font-medium">PO Number</th>
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium">Quotation Ref</th>
                  <th className="px-6 py-3 font-medium">PO Date</th>
                  <th className="px-6 py-3 font-medium">Grand Total</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Fulfilment</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {result.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      No Customer Purchase Orders found matching criteria.
                    </td>
                  </tr>
                ) : (
                  result.items.map((po: any) => (
                    <tr key={po.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">
                        <Link href={`/commercial/customer-pos/${po.id}`} className="hover:underline">
                          {po.po_number}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">
                        {po.customer?.name || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {po.quotation ? (
                          <Link
                            href={`/commercial/quotations/${po.quotation.id}`}
                            className="text-blue-500 hover:underline"
                          >
                            {po.quotation.quotation_number}
                            {po.quotationRevision?.revision_number ? ` (Rev ${po.quotationRevision.revision_number})` : ""}
                          </Link>
                        ) : (
                          <span className="text-gray-400 italic">None (Direct PO)</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {new Date(po.po_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">
                        {po.currency?.symbol || "$"}{Number(po.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(po.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {po.fulfilmentOrder ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            FO: {po.fulfilmentOrder.order_number} ({po.fulfilmentOrder.status})
                          </span>
                        ) : po.status === "VALIDATED" ? (
                          <span className="text-xs text-amber-600 font-medium">Ready to fulfill</span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <Link
                          href={`/commercial/customer-pos/${po.id}`}
                          className="text-gray-400 hover:text-blue-600 inline-flex items-center"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-sm text-gray-600">
            <div>
              Showing {result.items.length > 0 ? (result.page - 1) * result.limit + 1 : 0} to{" "}
              {Math.min(result.page * result.limit, result.total)} of {result.total} records
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/commercial/customer-pos?page=${result.page - 1}${search ? `&search=${search}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}`}
                className={`px-3 py-1 border rounded text-xs ${result.page <= 1 ? "opacity-50 pointer-events-none bg-gray-100" : "bg-white hover:bg-gray-50"}`}
              >
                Previous
              </Link>
              <span className="text-xs font-medium px-2">Page {result.page} of {result.totalPages}</span>
              <Link
                href={`/commercial/customer-pos?page=${result.page + 1}${search ? `&search=${search}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}`}
                className={`px-3 py-1 border rounded text-xs ${result.page >= result.totalPages ? "opacity-50 pointer-events-none bg-gray-100" : "bg-white hover:bg-gray-50"}`}
              >
                Next
              </Link>
            </div>
          </div>
        </div>
      </ContentContainer>
    </div>
  );
}
