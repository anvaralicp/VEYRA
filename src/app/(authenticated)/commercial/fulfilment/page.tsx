/* eslint-disable @typescript-eslint/no-explicit-any */
import { requirePermission } from "../../../../lib/auth/boundary";
import { getTenantDb } from "../../../../lib/db/tenant-db";
import { getTenantContext } from "../../../../lib/tenant/context";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function FulfilmentListPage() {
  await requirePermission("fulfilment.view");
  const ctx = await getTenantContext();
  const tdb: any = await getTenantDb();

  const orders = await tdb.FulfilmentOrder.findMany({
    where: { tenant_id: ctx.tenantId },
    include: {
      customerPurchaseOrder: { include: { customer: true } },
      customer: true
    },
    orderBy: { created_at: 'desc' }
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fulfilment Orders</h1>
        <div className="flex space-x-3">
          <Link
            href="/commercial/customer-pos"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Convert from Customer PO
          </Link>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fulfilment Ref</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer PO</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders.map((o: any) => (
              <tr key={o.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                  <Link href={`/commercial/fulfilment/${o.id}`}>{o.order_number || o.id.substring(0,8).toUpperCase()}</Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{o.customerPurchaseOrder?.po_number || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{o.customer?.display_name || o.customerPurchaseOrder?.customer?.display_name || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(o.created_at).toISOString().substring(0, 16).replace('T', ' ')}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${['READY_FOR_EXECUTION','COMPLETED'].includes(o.status) ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {o.status}
                  </span>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">
                  No fulfilment orders found. Convert a validated Customer PO to begin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
