import { submitGoodsReceiptDraft } from "./actions";
import { requirePermission } from "../../../../../lib/auth/boundary";
import { getTenantDb } from "../../../../../lib/db/tenant-db";
import { getTenantContext } from "../../../../../lib/tenant/context";
import { redirect } from "next/navigation";

interface LocationOption {
  id: string;
  name: string;
}

interface SpoOption {
  id: string;
  po_number: string;
  vendor?: { name: string } | null;
}

interface SpoLineDetail {
  id: string;
  quantity?: { toString: () => string } | number | string;
  productService?: { name: string } | null;
}

interface SpoDetail {
  id: string;
  lines: SpoLineDetail[];
}

export default async function NewReceiptPage({ searchParams }: { searchParams?: Promise<{ spo_id?: string }> | { spo_id?: string } }) {
  await requirePermission("goods_receipt.create");
  const ctx = await getTenantContext();
  const tdb = await getTenantDb();

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const spoId = resolvedSearchParams?.spo_id;

  const locations: LocationOption[] = await tdb.StockLocation.findMany({
    where: { tenant_id: ctx.tenantId, status: 'ACTIVE' },
    orderBy: { name: 'asc' }
  });

  const spos: SpoOption[] = await tdb.SupplierPurchaseOrder.findMany({
    where: { tenant_id: ctx.tenantId, status: { in: ['ISSUED', 'PARTIAL_RECEIPT'] } },
    orderBy: { created_at: 'desc' },
    include: { vendor: true }
  });

  let selectedSPO: SpoDetail | null = null;
  if (spoId) {
    selectedSPO = await tdb.SupplierPurchaseOrder.findUnique({
      where: { id: spoId, tenant_id: ctx.tenantId },
      include: { lines: { include: { productService: true } } }
    });
  }



  async function createReceiptAction(formData: FormData) {
    "use server";
    const grId = await submitGoodsReceiptDraft(formData);
    redirect(`/inventory/receipts/${grId}`);
  }



  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Goods Receipt</h1>
      <div className="bg-white shadow sm:rounded-lg p-6 mb-8 max-w-lg">
        <form action="">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Supplier PO</label>
            <div className="flex space-x-2 mt-1">
              <select name="spo_id" defaultValue={spoId || ""} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                <option value="">Select Supplier PO...</option>
                {spos.map((s: SpoOption) => (
                  <option key={s.id} value={s.id}>{s.po_number} ({s.vendor?.name})</option>
                ))}
              </select>
              <button type="submit" className="px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm font-medium border hover:bg-gray-200">
                Load
              </button>
            </div>
          </div>
        </form>
      </div>

      {selectedSPO && (
        <form action={createReceiptAction} className="bg-white shadow sm:rounded-lg overflow-hidden">
          <input type="hidden" name="spo_id" value={selectedSPO.id} />

          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Receiving Location</label>
              <select name="location_id" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                <option value="">Select Location...</option>
                {locations.map((l: LocationOption) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Delivery Note / Reference</label>
              <input type="text" name="delivery_note" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
            </div>
          </div>

          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ordered</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Received</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Accepted</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Rejected</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {selectedSPO.lines.map((line: SpoLineDetail) => (
                <tr key={line.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <input type="hidden" name="line_id" value={line.id} />
                    {line.productService?.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    {line.quantity?.toString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input type="number" name={`recv_${line.id}`} defaultValue="0" min="0" step="any" className="w-20 text-right rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input type="number" name={`acc_${line.id}`} defaultValue="0" min="0" step="any" className="w-20 text-right rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-green-600" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input type="number" name={`rej_${line.id}`} defaultValue="0" min="0" step="any" className="w-20 text-right rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-red-600" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input type="text" name={`reason_${line.id}`} placeholder="If rejected..." className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium">
              Save Draft Receipt
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
