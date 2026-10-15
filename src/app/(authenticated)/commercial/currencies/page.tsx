/* eslint-disable @typescript-eslint/no-explicit-any */
import { listCurrencies } from "../../../../lib/commercial/currency-service";
import { checkPermissionForUI } from "../../../../lib/auth/boundary";
import Link from "next/link";
import { Plus } from "lucide-react";
import { deactivateCurrencyAction, activateCurrencyAction, setDefaultCurrencyAction } from '../../actions';

export default async function CurrenciesListPage() {
  const currencies = await listCurrencies();
  const canManage = await checkPermissionForUI("organization.update");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Currencies</h1>
          <p className="text-sm text-gray-500">Manage currencies used for commercial pricing and quotations.</p>
        </div>
        {canManage && (
          <Link href="/commercial/currencies/new" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium">
            <Plus className="w-4 h-4 mr-2" /> Add Currency
          </Link>
        )}
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Default</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currencies.map((c: any) => (
              <tr key={c.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{c.code}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.symbol}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {c.is_default && <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Default</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${c.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {c.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  {canManage && (
                    <>
                      {c.is_active && !c.is_default && (
                        <form className="inline" action={async () => { "use server"; await setDefaultCurrencyAction(c.id); }}>
                          <button className="text-indigo-600 hover:text-indigo-900">Set Default</button>
                        </form>
                      )}
                      {c.is_active && !c.is_default && (
                        <form className="inline" action={async () => { "use server"; await deactivateCurrencyAction(c.id); }}>
                          <button className="text-red-600 hover:text-red-900">Deactivate</button>
                        </form>
                      )}
                      {!c.is_active && (
                        <form className="inline" action={async () => { "use server"; await activateCurrencyAction(c.id); }}>
                          <button className="text-green-600 hover:text-green-900">Activate</button>
                        </form>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
            {currencies.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">No currencies defined.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
