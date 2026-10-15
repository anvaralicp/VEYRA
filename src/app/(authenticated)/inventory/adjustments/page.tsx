import { requirePermission } from "../../../../lib/auth/boundary";
import { getTenantDb } from "../../../../lib/db/tenant-db";
import { getTenantContext } from "../../../../lib/tenant/context";
import Link from "next/link";

interface AdjustmentListItem {
  id: string;
  status: string;
  quantity_delta: number | string | { toString: () => string };
  productService?: { name: string } | null;
  stockLocation?: { name: string } | null;
}

export default async function AdjustmentsPage() {
  await requirePermission("inventory.adjustment.view");
  const ctx = await getTenantContext();
  const tdb = await getTenantDb();

  const adjs: AdjustmentListItem[] = await tdb.InventoryAdjustment.findMany({
    where: { tenant_id: ctx.tenantId },
    include: { productService: true, stockLocation: true },
    orderBy: { created_at: 'desc' }
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory Adjustments</h1>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adjustment Ref</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Delta</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {adjs.map((a: AdjustmentListItem) => (
              <tr key={a.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                  <Link href={`/inventory/adjustments/${a.id}`}>{a.id.substring(0,8)}</Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{a.productService?.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{a.stockLocation?.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                  <span className={Number(a.quantity_delta) >= 0 ? "text-green-600" : "text-red-600"}>
                    {Number(a.quantity_delta) > 0 ? "+" : ""}{a.quantity_delta?.toString()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${a.status === 'POSTED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {a.status}
                  </span>
                </td>
              </tr>
            ))}
            {adjs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">
                  No adjustments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
