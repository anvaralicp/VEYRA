
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { createVendorAction } from '../../../actions';
import { requirePermission } from "../../../../../lib/auth/boundary";

export default async function NewVendorPage() {
  await requirePermission("vendor.create");

  return (
    <RecordPage
      title="New Vendor"
      breadcrumbs={[{ label: "Commercial", href: "/commercial" }, { label: "Vendors", href: "/commercial/vendors" }]}
      activeTab="overview"
      tabs={[{ id: "overview", label: "Overview" }]}
    >
      <form action={createVendorAction} className="p-6 space-y-8 max-w-4xl">
        {/* Identity */}
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 border-b pb-2">Identity</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Vendor Code *</label>
              <input type="text" name="vendor_code" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" placeholder="V-001" />
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Vendor Type *</label>
              <select name="vendor_type" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border">
                <option value="DISTRIBUTOR">Distributor</option>
                <option value="RESELLER">Reseller</option>
                <option value="SYSTEM_INTEGRATOR">System Integrator</option>
                <option value="OEM">OEM</option>
                <option value="SERVICE_PROVIDER">Service Provider</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Name *</label>
              <input type="text" name="name" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Legal Name</label>
              <input type="text" name="legal_name" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Display Name</label>
              <input type="text" name="display_name" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea name="description" rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 border-b pb-2">Contact</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" name="email" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input type="text" name="phone" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Website</label>
              <input type="url" name="website" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 border-b pb-2">Address</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
              <input type="text" name="address_line1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
              <input type="text" name="address_line2" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">City</label>
              <input type="text" name="city" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">State / Province</label>
              <input type="text" name="state" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Postal Code</label>
              <input type="text" name="postal_code" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Country</label>
              <input type="text" name="country" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
            </div>
          </div>
        </div>

        {/* Tax */}
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 border-b pb-2">Tax / Registration</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">GSTIN / Tax ID</label>
              <input type="text" name="gstin" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">PAN / Registration Number</label>
              <input type="text" name="pan" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
            </div>
          </div>
        </div>

        <div className="pt-5 border-t border-gray-200">
          <div className="flex justify-end">
            <button type="submit" className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              Create Vendor
            </button>
          </div>
        </div>
      </form>
    </RecordPage>
  );
}
