import { requirePermission } from "../../../../../lib/auth/boundary";
import { getTenantDb } from "../../../../../lib/db/tenant-db";
import { getTenantContext } from "../../../../../lib/tenant/context";
import { notFound } from "next/navigation";

interface CountLineItem {
  id: string;
  expected_quantity: number | string | { toString: () => string };
  physical_quantity: number | string | { toString: () => string };
  productService?: { name: string } | null;
}

export default async function CountDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  await requirePermission("inventory.count.view");
  const ctx = await getTenantContext();
  const tdb = await getTenantDb();

  const resolvedParams = await Promise.resolve(params);
  const count = await tdb.StockCount.findUnique({
    where: { id: resolvedParams.id, tenant_id: ctx.tenantId },
    include: {
      stockLocation: true,
      lines: { include: { productService: true } }
    }
  });

  if (!count) notFound();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stock Count: {count.count_number || 'DRAFT'}</h1>
        <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${count.status === 'POSTED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
          {count.status}
        </span>
      </div>

      <div className="bg-white shadow sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:p-6 grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Location</h3>
            <p className="mt-1 text-sm text-gray-900">{count.stockLocation?.name}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Date</h3>
            <p className="mt-1 text-sm text-gray-900">{new Date(count.created_at).toISOString().substring(0, 16).replace('T', ' ')}</p>
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
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Physical</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Variance</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {count.lines.map((line: CountLineItem) => {
              const expected = Number(line.expected_quantity);
              const physical = Number(line.physical_quantity);
              const variance = physical - expected;
              return (
              <tr key={line.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{line.productService?.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{expected}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">{physical}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right">
                  <span className={variance > 0 ? "text-green-600" : variance < 0 ? "text-red-600" : "text-gray-500"}>
                    {variance > 0 ? "+" : ""}{variance}
                  </span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
