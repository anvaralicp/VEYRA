
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { createManufacturerAction } from '../../../actions';
import { requirePermission } from "../../../../../lib/auth/boundary";

export default async function NewManufacturerPage() {
  await requirePermission("manufacturer.create");

  return (
    <RecordPage
      title="New Manufacturer"
      breadcrumbs={[{ label: "Commercial", href: "/commercial" }, { label: "Manufacturers", href: "/commercial/manufacturers" }]} activeTab="overview" tabs={[{ id: "overview", label: "Overview" }]}
    >
      <form action={createManufacturerAction} className="p-6 space-y-6 max-w-2xl">
        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">Name *</label>
            <input type="text" name="name" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700">Code</label>
            <input type="text" name="code" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" placeholder="e.g. CSCO" />
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700">Website</label>
            <input type="url" name="website" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700">Contact Email</label>
            <input type="email" name="contact_email" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700">Contact Phone</label>
            <input type="text" name="contact_phone" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea name="description" rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
          </div>
        </div>
        <div className="pt-5 border-t border-gray-200">
          <div className="flex justify-end">
            <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              Create Manufacturer
            </button>
          </div>
        </div>
      </form>
    </RecordPage>
  );
}
