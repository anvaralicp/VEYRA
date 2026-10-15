import { requirePermission } from "../../../../lib/auth/boundary";
import { getTenantDb } from "../../../../lib/db/tenant-db";
import { getTenantContext } from "../../../../lib/tenant/context";
import Link from "next/link";

interface GoodsReceiptListItem {
  id: string;
  receipt_number?: string | null;
  created_at: string | Date;
  status: string;
  supplierPO?: {
    po_number?: string | null;
    vendor?: { name?: string | null } | null;
  } | null;
  stockLocation?: { name?: string | null } | null;
}

export default async function ReceiptsPage() {
  await requirePermission("inventory.view");
  const ctx = await getTenantContext();
  const tdb = await getTenantDb();

  const receipts: GoodsReceiptListItem[] = await tdb.GoodsReceipt.findMany({
    where: { tenant_id: ctx.tenantId },
    include: {
      supplierPO: { include: { vendor: true } },
      stockLocation: true
    },
    orderBy: { created_at: 'desc' }
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Goods Receipts</h1>
        <Link href="/inventory/receipts/new" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium">
          New Receipt
        </Link>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt Number</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier PO</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {receipts.map((r: GoodsReceiptListItem) => (
              <tr key={r.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                  <Link href={`/inventory/receipts/${r.id}`}>{r.receipt_number || 'DRAFT'}</Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{r.supplierPO?.po_number || 'Unknown'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{r.supplierPO?.vendor?.name || 'Unknown'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{r.stockLocation?.name || 'Unknown'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(r.created_at).toISOString().substring(0, 16).replace('T', ' ')}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${r.status === 'POSTED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
            {receipts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500 text-sm">
                  No receipts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
