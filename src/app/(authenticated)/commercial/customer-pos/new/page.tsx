/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { requirePermission } from "../../../../../lib/auth/boundary";
import { getTenantDb } from "../../../../../lib/db/tenant-db";
import { listCurrencies } from "../../../../../lib/commercial/currency-service";
import { createCustomerPOAction } from "../actions";
import Link from "next/link";

export const instant = false;

export default async function NewCustomerPOPage({
  searchParams,
}: {
  searchParams?: Promise<{ quotation_revision_id?: string; customer_id?: string }> | { quotation_revision_id?: string; customer_id?: string };
}) {
  await requirePermission("customer_po.create");

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const tdb: any = await getTenantDb();
  const root = tdb.tdb || tdb;

  const CustomerModel = root.Customer || root.customer;
  const QuotationRevisionModel = root.QuotationRevision || root.quotationRevision;

  const [customers, quotationRevisions, currencies] = await Promise.all([
    CustomerModel.findMany({
      orderBy: { name: "asc" },
    }),
    QuotationRevisionModel.findMany({
      where: { status: "ISSUED" },
      include: {
        quotation: { include: { customer: true } },
      },
      orderBy: { created_at: "desc" },
    }),
    listCurrencies(),
  ]);

  const defaultQuotationRevId = resolvedSearchParams?.quotation_revision_id || "";
  const selectedRev = quotationRevisions.find((r: any) => r.id === defaultQuotationRevId);
  const defaultCustomerId = resolvedSearchParams?.customer_id || selectedRev?.quotation?.customer_id || "";

  const today = new Date().toISOString().split("T")[0];

  return (
    <RecordPage
      title="Record Customer Purchase Order"
      breadcrumbs={[
        { label: "Commercial", href: "/commercial/quotations" },
        { label: "Customer POs", href: "/commercial/customer-pos" },
        { label: "New PO", href: "/commercial/customer-pos/new" },
      ]}
      activeTab="form"
      tabs={[{ id: "form", label: "PO Details" }]}
    >
      <div className="p-6 max-w-4xl">
        <form action={createCustomerPOAction} className="space-y-6 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="border-b pb-4">
            <h3 className="text-base font-semibold text-gray-900">Purchase Order Header</h3>
            <p className="text-xs text-gray-500 mt-1">
              Record a received customer purchase order. Link to an issued quotation to enable automated discrepancy validation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Customer <span className="text-red-500">*</span>
              </label>
              <select
                name="customer_id"
                required
                defaultValue={defaultCustomerId}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm p-2.5 border bg-white focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Select Customer --</option>
                {customers.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code || "No code"})
                  </option>
                ))}
              </select>
            </div>

            {/* PO Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Customer PO Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="po_number"
                required
                placeholder="e.g. PO-ACME-2026-001"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm p-2.5 border bg-white focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-xs text-gray-400 mt-1 block">
                Must be unique per customer.
              </span>
            </div>

            {/* Linked Quotation Revision */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Reference Issued Quotation (Recommended)
              </label>
              <select
                name="quotation_revision_id"
                defaultValue={defaultQuotationRevId}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm p-2.5 border bg-white focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- None (Direct Customer PO without quotation) --</option>
                {quotationRevisions.map((rev: any) => (
                  <option key={rev.id} value={rev.id}>
                    {rev.quotation?.quotation_number} Rev {rev.revision_number} — {rev.quotation?.title} (Customer: {rev.quotation?.customer?.name}) — {rev.currency_code_snapshot} {rev.grand_total}
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-500 mt-1 block">
                Only quotation revisions in ISSUED state can be referenced.
              </span>
            </div>

            {/* PO Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                PO Issue Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="po_date"
                required
                defaultValue={today}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm p-2.5 border bg-white focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Received Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                PO Received Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="received_date"
                required
                defaultValue={today}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm p-2.5 border bg-white focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Valid Until */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                PO Valid Until (Optional)
              </label>
              <input
                type="date"
                name="valid_until"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm p-2.5 border bg-white focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Currency */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Currency <span className="text-red-500">*</span>
              </label>
              <select
                name="currency_id"
                required
                defaultValue={selectedRev?.currency_id || currencies[0]?.id}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm p-2.5 border bg-white focus:ring-blue-500 focus:border-blue-500"
              >
                {currencies.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Financial Totals</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-medium text-gray-600">Subtotal</label>
                <input
                  type="number"
                  step="0.01"
                  name="subtotal"
                  required
                  defaultValue={selectedRev?.subtotal ? String(selectedRev.subtotal) : "0"}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm p-2 border bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Tax Total</label>
                <input
                  type="number"
                  step="0.01"
                  name="tax_total"
                  required
                  defaultValue={selectedRev?.total_tax ? String(selectedRev.total_tax) : "0"}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm p-2 border bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Grand Total</label>
                <input
                  type="number"
                  step="0.01"
                  name="grand_total"
                  required
                  defaultValue={selectedRev?.grand_total ? String(selectedRev.grand_total) : "0"}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm p-2 border bg-white font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Line items import checkbox */}
          <div className="bg-blue-50/50 p-4 rounded-md border border-blue-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="import_quotation_lines"
                value="true"
                defaultChecked={true}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <span className="text-sm text-gray-800 font-medium">
                Auto-import line items from referenced quotation revision
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              Copies item descriptions, codes, quantities, and prices from the quotation for line-by-line validation and discrepancy checking.
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Notes & Commercial Terms</label>
            <textarea
              name="notes"
              rows={3}
              placeholder="Payment terms, delivery clauses, or special customer instructions specified on the PO..."
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm p-2.5 border bg-white focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
            <Link
              href="/commercial/customer-pos"
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="px-5 py-2.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Save Customer PO Draft
            </button>
          </div>
        </form>
      </div>
    </RecordPage>
  );
}
