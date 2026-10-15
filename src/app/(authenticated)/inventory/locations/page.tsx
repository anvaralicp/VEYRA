import { requirePermission } from "../../../../lib/auth/boundary";
import { getTenantDb } from "../../../../lib/db/tenant-db";
import { getTenantContext } from "../../../../lib/tenant/context";

interface StockLocationItem {
  id: string;
  name: string;
  code: string;
  status: string;
}

export default async function StockLocationsPage() {
  await requirePermission("inventory.location.view");
  const ctx = await getTenantContext();
  const tdb = await getTenantDb();

  const locations: StockLocationItem[] = await tdb.StockLocation.findMany({
    where: { tenant_id: ctx.tenantId },
    orderBy: { name: 'asc' }
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stock Locations</h1>
        {/* We can add a new location button if we build the UI for it, sticking to list for now */}
      </div>
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul role="list" className="divide-y divide-gray-200">
          {locations.map((loc: StockLocationItem) => (
            <li key={loc.id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-indigo-600 truncate">{loc.name}</p>
                    <p className="text-sm text-gray-500">Code: {loc.code}</p>
                  </div>
                  <div className="ml-2 flex-shrink-0 flex">
                    <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${loc.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {loc.status}
                    </p>
                  </div>
                </div>
              </div>
            </li>
          ))}
          {locations.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-500 text-sm">
              No stock locations found.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
