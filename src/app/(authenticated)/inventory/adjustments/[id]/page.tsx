import { requirePermission } from "../../../../../lib/auth/boundary";
import { getTenantDb } from "../../../../../lib/db/tenant-db";
import { getTenantContext } from "../../../../../lib/tenant/context";
import { notFound } from "next/navigation";

export default async function AdjustmentDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  await requirePermission("inventory.adjustment.view");
  const ctx = await getTenantContext();
  const tdb = await getTenantDb();

  const resolvedParams = await Promise.resolve(params);
  const adj = await tdb.InventoryAdjustment.findUnique({
    where: { id: resolvedParams.id, tenant_id: ctx.tenantId },
    include: {
      stockLocation: true,
      productService: true
    }
  });

  if (!adj) notFound();

  const delta = Number(adj.quantity_delta);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Adjustment: {adj.id.substring(0,8)}</h1>
        <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${adj.status === 'POSTED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
          {adj.status}
        </span>
      </div>

      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6 grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Location</h3>
            <p className="mt-1 text-sm text-gray-900">{adj.stockLocation?.name}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Product</h3>
            <p className="mt-1 text-sm text-gray-900">{adj.productService?.name}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Adjustment Quantity</h3>
            <p className={`mt-1 text-lg font-bold ${delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {delta > 0 ? "+" : ""}{delta}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Reason</h3>
            <p className="mt-1 text-sm text-gray-900">{adj.reason || 'No reason provided'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Date</h3>
            <p className="mt-1 text-sm text-gray-900">{new Date(adj.created_at).toISOString().substring(0, 16).replace('T', ' ')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
