/* eslint-disable @typescript-eslint/no-explicit-any */
import { requirePermission } from "../../../../../lib/auth/boundary";
import { getTenantDb } from "../../../../../lib/db/tenant-db";
import { getTenantContext } from "../../../../../lib/tenant/context";
import { notFound } from "next/navigation";

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  await requirePermission("inventory.view");
  const ctx = await getTenantContext();
  const tdb: any = await getTenantDb();

  const resolvedParams = await Promise.resolve(params);
  const receipt = await tdb.GoodsReceipt.findUnique({
    where: { id: resolvedParams.id, tenant_id: ctx.tenantId },
    include: {
      supplierPurchaseOrder: { include: { vendor: true } },
      vendor: true,
      stockLocation: true,
      lines: {
        include: {
          supplierPurchaseOrderLine: {
            include: { productService: true }
          },
          productService: true
        }
      }
    }
  });

  if (!receipt) notFound();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Goods Receipt: {receipt.receipt_number || 'DRAFT'}</h1>
        <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${receipt.status === 'POSTED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
          {receipt.status}
        </span>
      </div>

      <div className="bg-white shadow sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:p-6 grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Supplier PO</h3>
            <p className="mt-1 text-sm text-gray-900">{receipt.supplierPurchaseOrder?.po_number || 'N/A'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Vendor</h3>
            <p className="mt-1 text-sm text-gray-900">{receipt.vendor?.name || receipt.supplierPurchaseOrder?.vendor?.name || 'N/A'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Location</h3>
            <p className="mt-1 text-sm text-gray-900">{receipt.stockLocation?.name || 'N/A'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Created Date</h3>
            <p className="mt-1 text-sm text-gray-900">{new Date(receipt.created_at).toISOString().substring(0, 16).replace('T', ' ')}</p>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mb-4">Lines</h2>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Expected</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Received</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Accepted</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Rejected</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {receipt.lines.map((line: any) => (
              <tr key={line.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{line.productService?.name || line.supplierPurchaseOrderLine?.productService?.name || line.item_description_snapshot}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{line.supplierPurchaseOrderLine?.quantity?.toString() || line.ordered_quantity?.toString() || '0'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">{line.received_quantity?.toString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-bold text-right">{line.accepted_quantity?.toString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-bold text-right">{line.rejected_quantity?.toString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
