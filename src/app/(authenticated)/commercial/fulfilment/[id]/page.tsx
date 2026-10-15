/* eslint-disable @typescript-eslint/no-explicit-any */
import { requirePermission } from "../../../../../lib/auth/boundary";
import { getTenantDb } from "../../../../../lib/db/tenant-db";
import { getTenantContext } from "../../../../../lib/tenant/context";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function FulfilmentDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  await requirePermission("fulfilment.view");
  const ctx = await getTenantContext();
  const tdb: any = await getTenantDb();

  const resolvedParams = await Promise.resolve(params);
  const order = await tdb.FulfilmentOrder.findUnique({
    where: { id: resolvedParams.id, tenant_id: ctx.tenantId },
    include: {
      customerPurchaseOrder: { include: { customer: true, customerSite: true, quotation: true } },
      customer: true,
      customerSite: true,
      lines: { include: { productService: true } }
    }
  });

  if (!order) notFound();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fulfilment Order: {order.order_number || order.id.substring(0,8).toUpperCase()}</h1>
        <div className="flex space-x-3">
          <Link
            href={`/commercial/fulfilment/${order.id}/planning`}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium"
          >
            Planning & Execution
          </Link>
        </div>
      </div>

      <div className="bg-white shadow sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:p-6 grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Customer PO</h3>
            <p className="mt-1 text-sm text-gray-900">{order.customerPurchaseOrder?.po_number || 'N/A'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Customer</h3>
            <p className="mt-1 text-sm text-gray-900">{order.customer?.display_name || order.customerPurchaseOrder?.customer?.display_name || 'N/A'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Target Site</h3>
            <p className="mt-1 text-sm text-gray-900">{order.customerSite?.name || order.customerPurchaseOrder?.customerSite?.name || 'TBD'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Status</h3>
            <p className="mt-1 text-sm font-bold text-gray-900">{order.status}</p>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mb-4">Fulfilment Lines</h2>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Required Qty</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Allocated Qty</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {order.lines.map((line: any) => (
              <tr key={line.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{line.productService?.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{line.required_quantity?.toString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">{line.allocated_quantity?.toString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{line.delivery_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
