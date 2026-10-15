
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { requirePermission } from "../../../../../lib/auth/boundary";
import { createCurrencyAction } from '../../../actions';

export default async function AddCurrencyPage() {
  await requirePermission("organization.update");

  return (
    <RecordPage
      title="Add Currency"
      breadcrumbs={[
        { label: "Commercial", href: "/commercial" },
        { label: "Currencies", href: "/commercial/currencies" }
      ]}
      activeTab="form"
      tabs={[{ id: "form", label: "Currency Details" }]}
    >
      <form action={createCurrencyAction} className="p-6 space-y-8 max-w-4xl">
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 border-b pb-2">Details</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Code *</label>
              <input type="text" name="code" required maxLength={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border uppercase" placeholder="USD" />
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Symbol *</label>
              <input type="text" name="symbol" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" placeholder="$" />
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Name *</label>
              <input type="text" name="name" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" placeholder="US Dollar" />
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Decimal Places</label>
              <input type="number" name="decimal_places" defaultValue={2} min={0} max={4} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
            </div>

            <div className="col-span-2">
              <label className="flex items-center space-x-3 mt-4">
                <input type="checkbox" name="is_default" value="true" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600" />
                <span className="text-sm font-medium text-gray-700">Set as Default Currency</span>
              </label>
            </div>
          </div>
        </div>

        <div className="pt-5 border-t border-gray-200">
          <div className="flex justify-end">
            <button type="submit" className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              Save Currency
            </button>
          </div>
        </div>
      </form>
    </RecordPage>
  );
}
