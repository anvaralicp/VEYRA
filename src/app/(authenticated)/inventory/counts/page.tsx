import { requirePermission } from "../../../../lib/auth/boundary";
import { getTenantDb } from "../../../../lib/db/tenant-db";
import { getTenantContext } from "../../../../lib/tenant/context";
import Link from "next/link";

interface StockCountListItem {
  id: string;
  count_number?: string | null;
  created_at: string | Date;
  status: string;
  stockLocation?: { name: string } | null;
}

export default async function CountsPage() {
  await requirePermission("inventory.count.view");
  const ctx = await getTenantContext();
  const tdb = await getTenantDb();

  const counts: StockCountListItem[] = await tdb.StockCount.findMany({
    where: { tenant_id: ctx.tenantId },
    include: { stockLocation: true },
    orderBy: { created_at: 'desc' }
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stock Counts</h1>
        <Link href="/inventory/counts/new" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium">
          New Count
        </Link>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count Ref</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {counts.map((c: StockCountListItem) => (
              <tr key={c.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                  <Link href={`/inventory/counts/${c.id}`}>{c.count_number || 'DRAFT'}</Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.stockLocation?.name || 'Unknown'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(c.created_at).toISOString().substring(0, 16).replace('T', ' ')}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${c.status === 'POSTED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
            {counts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500 text-sm">
                  No stock counts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
