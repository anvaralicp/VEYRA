import { requirePermission } from "../../../../lib/auth/boundary";
import { getTenantDb } from "../../../../lib/db/tenant-db";
import { getTenantContext } from "../../../../lib/tenant/context";
import { runReconciliation } from "../../../../lib/inventory/reconciliation-service";

interface LocationOption {
  id: string;
  name: string;
}

interface ReconciliationResult {
  product_service_id: string;
  ledger_quantity: string;
  stored_balance: string;
  difference: string;
  status: string;
}

export default async function ReconciliationPage({ searchParams }: { searchParams?: Promise<{ location?: string }> | { location?: string } }) {
  await requirePermission("inventory.reconciliation.view");
  const ctx = await getTenantContext();
  const tdb = await getTenantDb();

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const locations: LocationOption[] = await tdb.StockLocation.findMany({
    where: { tenant_id: ctx.tenantId },
    orderBy: { name: 'asc' }
  });

  const locationFilter = resolvedSearchParams?.location || (locations[0]?.id as string);

  let results: ReconciliationResult[] = [];
  if (locationFilter) {
    try {
      results = await runReconciliation(locationFilter);
    } catch (err: unknown) {
      console.error(err);
    }
  }

  // Get product names
  const enriched = await Promise.all(results.map(async r => {
    const p = await tdb.ProductService.findUnique({ where: { id: r.product_service_id } });
    return { ...r, product_name: p?.name, product_code: p?.code };
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Inventory Reconciliation</h1>

      <div className="mb-6 bg-white p-4 rounded shadow flex items-center">
        <span className="text-sm font-medium text-gray-700 mr-4">Location:</span>
        <form className="flex space-x-2">
          <select name="location" defaultValue={locationFilter || ""} className="border-gray-300 rounded-md text-sm">
            {locations.map((l: LocationOption) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <button type="submit" className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">
            Run Reconciliation
          </button>
        </form>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ledger Balance</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stored Balance</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Difference</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {enriched.map((r, i) => (
              <tr key={i}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{r.product_code}</div>
                  <div className="text-sm text-gray-500">{r.product_name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">{r.ledger_quantity}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{r.stored_balance}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">{r.difference}</td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
            {enriched.length === 0 && locationFilter && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">
                  No stock movements found for this location.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
