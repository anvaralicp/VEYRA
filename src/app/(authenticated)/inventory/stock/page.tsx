import { requirePermission } from "../../../../lib/auth/boundary";
import { getTenantDb } from "../../../../lib/db/tenant-db";
import { getTenantContext } from "../../../../lib/tenant/context";
import { getStockBalance } from "../../../../lib/inventory/goods-receipt-service";
import Link from "next/link";

interface LocationOption {
  id: string;
  name: string;
}

interface StockBalanceWhereClause {
  tenant_id: string;
  stock_location_id?: string;
}

export default async function StockBalancePage({ searchParams }: { searchParams?: Promise<{ location?: string }> | { location?: string } }) {
  await requirePermission("inventory.view");
  const ctx = await getTenantContext();
  const tdb = await getTenantDb();

  const resolvedSearchParams = await Promise.resolve(searchParams);

  // Need to get all locations for filter
  const locations: LocationOption[] = await tdb.StockLocation.findMany({
    where: { tenant_id: ctx.tenantId },
    orderBy: { name: 'asc' }
  });

  const locationFilter = resolvedSearchParams?.location;

  // Group by product and location
  const whereClause: StockBalanceWhereClause = { tenant_id: ctx.tenantId };
  if (locationFilter) {
    whereClause.stock_location_id = locationFilter;
  }

  const grouped = await tdb.InventoryLedger.groupBy({
    by: ['product_service_id', 'stock_location_id'],
    where: whereClause
  });

  const results = [];
  for (const item of grouped) {
    const loc = locations.find((l: LocationOption) => l.id === item.stock_location_id);
    const prod = await tdb.ProductService.findUnique({
      where: { id: item.product_service_id }
    });
    const balance = await getStockBalance(item.product_service_id, item.stock_location_id);

    results.push({
      product_id: item.product_service_id,
      product_code: prod?.code || 'Unknown',
      product_name: prod?.name || 'Unknown',
      uom: prod?.unit_of_measure || '-',
      location_id: item.stock_location_id,
      location_name: loc?.name || 'Unknown',
      quantity: balance.toString()
    });
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stock Balances</h1>
        <div className="flex space-x-4">
          <Link href="/inventory/receipts/new" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium">
            Receive Goods
          </Link>
          <Link href="/inventory/counts/new" className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm font-medium">
            Count Stock
          </Link>
        </div>
      </div>

      <div className="mb-6 bg-white p-4 rounded shadow flex items-center">
        <span className="text-sm font-medium text-gray-700 mr-4">Filter Location:</span>
        <form className="flex space-x-2">
          <select name="location" defaultValue={locationFilter || ""} className="border-gray-300 rounded-md text-sm">
            <option value="">All Locations</option>
            {locations.map((l: LocationOption) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <button type="submit" className="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm hover:bg-gray-200">
            Apply
          </button>
        </form>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        {results.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No stock found.
            <div className="mt-4">
              <Link href="/inventory/receipts/new" className="text-indigo-600 hover:text-indigo-900">Record a Goods Receipt</Link>
            </div>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">On-Hand Quantity</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">UOM</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {results.map((r, i) => (
                <tr key={i}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{r.product_code}</div>
                    <div className="text-sm text-gray-500">{r.product_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{r.location_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{r.quantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{r.uom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
