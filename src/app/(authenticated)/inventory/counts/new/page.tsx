import { submitStockCountDraft } from "./actions";
import { requirePermission } from "../../../../../lib/auth/boundary";
import { getTenantDb } from "../../../../../lib/db/tenant-db";
import { getTenantContext } from "../../../../../lib/tenant/context";
import { redirect } from "next/navigation";
import { getStockBalance } from "../../../../../lib/inventory/goods-receipt-service";

interface LocationOption {
  id: string;
  name: string;
}

interface ProductItem {
  id: string;
  name: string;
  expected_quantity?: { toString: () => string } | number | string;
}

export default async function NewCountPage({ searchParams }: { searchParams?: Promise<{ location_id?: string }> | { location_id?: string } }) {
  await requirePermission("inventory.count.create");
  const ctx = await getTenantContext();
  const tdb = await getTenantDb();

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const locationId = resolvedSearchParams?.location_id;

  const locations: LocationOption[] = await tdb.StockLocation.findMany({
    where: { tenant_id: ctx.tenantId, status: 'ACTIVE' },
    orderBy: { name: 'asc' }
  });

  let selectedLocation: LocationOption | null = null;
  let products: ProductItem[] = [];

  if (locationId) {
    selectedLocation = await tdb.StockLocation.findUnique({
      where: { id: locationId, tenant_id: ctx.tenantId }
    });

    // Get all stockable products
    const rawProducts: ProductItem[] = await tdb.ProductService.findMany({
      where: { tenant_id: ctx.tenantId, is_stockable: true, status: 'ACTIVE' },
      orderBy: { name: 'asc' }
    });

    // Get expected quantities for rendering
    products = await Promise.all(rawProducts.map(async (p: ProductItem) => {
      const bal = await getStockBalance(p.id, selectedLocation!.id);
      return { ...p, expected_quantity: bal };
    }));
  }



  async function createCountAction(formData: FormData) {
    "use server";
    const cId = await submitStockCountDraft(formData);
    redirect(`/inventory/counts/${cId}`);
  }



  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Stock Count</h1>

      <div className="bg-white shadow sm:rounded-lg p-6 mb-8 max-w-lg">
        <form action="">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Stock Location</label>
            <div className="flex space-x-2 mt-1">
              <select name="location_id" defaultValue={locationId || ""} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                <option value="">Select Location...</option>
                {locations.map((l: LocationOption) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <button type="submit" className="px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm font-medium border hover:bg-gray-200">
                Load
              </button>
            </div>
          </div>
        </form>
      </div>

      {selectedLocation && (
        <form action={createCountAction} className="bg-white shadow sm:rounded-lg overflow-hidden">
          <input type="hidden" name="location_id" value={selectedLocation.id} />

          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <label className="block text-sm font-medium text-gray-700">Notes / Remarks</label>
            <textarea name="notes" rows={2} className="mt-1 block w-full max-w-lg rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"></textarea>
          </div>

          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Expected</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Physical Count</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason (if variance)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((p: ProductItem) => (
                <tr key={p.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <input type="hidden" name="product_id" value={p.id} />
                    {p.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    {p.expected_quantity?.toString() ?? "0"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input type="number" name={`phys_${p.id}`} min="0" step="any" placeholder="-" className="w-24 text-right rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input type="text" name={`reason_${p.id}`} placeholder="Reason..." className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                    No stockable products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium">
              Start Stock Count
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
