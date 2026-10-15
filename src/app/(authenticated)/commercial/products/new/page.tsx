/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { createProductAction } from '../../../actions';
import { getCategories } from "../../../../../lib/commercial/category-service";
import { getManufacturers } from "../../../../../lib/commercial/manufacturer-service";
import { requirePermission } from "../../../../../lib/auth/boundary";

export default async function NewProductPage() {
  await requirePermission("product.create");

  const categories = await getCategories();
  const manufacturers = await getManufacturers();

  return (
    <RecordPage
      title="New Product / Service"
      breadcrumbs={[{ label: "Commercial", href: "/commercial" }, { label: "Products & Services", href: "/commercial/products" }]} activeTab="overview" tabs={[{ id: "overview", label: "Overview" }]}
    >
      <form action={createProductAction} className="p-6 space-y-6 max-w-3xl">
        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700">Item Code *</label>
            <input type="text" name="item_code" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" placeholder="PRD-001" />
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700">Item Type *</label>
            <select name="item_type" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border">
              <option value="PRODUCT">Product</option>
              <option value="SERVICE">Service</option>
              <option value="LICENSE">License</option>
              <option value="SUBSCRIPTION">Subscription</option>
              <option value="SUPPORT">Support</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">Name *</label>
            <input type="text" name="name" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">Short Description</label>
            <input type="text" name="short_description" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <select name="category_id" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border">
              <option value="">-- Select Category --</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700">Manufacturer</label>
            <select name="manufacturer_id" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border">
              <option value="">-- Select Manufacturer --</option>
              {manufacturers.map((m: any) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700">Model Number</label>
            <input type="text" name="model_number" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700">Unit *</label>
            <input type="text" name="unit" required defaultValue="EA" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700">HSN/SAC Code</label>
            <input type="text" name="hsn_sac_code" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700">Tax Code</label>
            <input type="text" name="tax_code" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
          </div>

          <div className="col-span-1 flex items-center mt-6">
            <input type="checkbox" name="is_serialized" id="is_serialized" value="true" className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
            <label htmlFor="is_serialized" className="ml-2 block text-sm text-gray-900">Is Serialized?</label>
          </div>
        </div>

        <div className="pt-5 border-t border-gray-200">
          <div className="flex justify-end">
            <button type="submit" className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              Create Product
            </button>
          </div>
        </div>
      </form>
    </RecordPage>
  );
}
