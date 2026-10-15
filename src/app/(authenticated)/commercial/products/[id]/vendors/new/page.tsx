/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecordPage } from "../../../../../../../components/templates/RecordPage";
import { getProductById } from "../../../../../../../lib/commercial/product-service";
import { getVendors } from "../../../../../../../lib/commercial/vendor-service";
import { requirePermission } from "../../../../../../../lib/auth/boundary";
import { notFound } from "next/navigation";
import { createProductVendorAction } from '../../../../../actions';

export default async function MapVendorPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  await requirePermission("product_vendor.create");
  const resolvedParams = await Promise.resolve(params);
  const product = await getProductById(resolvedParams.id);

  if (!product || !product.is_active) {
    notFound();
  }

  // Only get active vendors for new mappings
  const allVendors = await getVendors();
  const activeVendors = allVendors.filter((v: any) => v.is_active);

  return (
    <RecordPage
      title={`Map Vendor to: ${product.name}`}
      breadcrumbs={[
        { label: "Commercial", href: "/commercial" },
        { label: "Products & Services", href: "/commercial/products" },
        { label: product.item_code, href: `/commercial/products/${product.id}` }
      ]}
      activeTab="mapping"
      tabs={[{ id: "mapping", label: "Mapping Details" }]}
    >
      <form action={createProductVendorAction} className="p-6 space-y-8 max-w-4xl">
        <input type="hidden" name="product_id" value={product.id} />

        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 border-b pb-2">Supplier details</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Vendor / Distributor *</label>
              <select name="vendor_id" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border">
                <option value="">-- Select Vendor --</option>
                {activeVendors.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name} ({v.vendor_code})</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Vendor Part Number</label>
              <input type="text" name="vendor_part_number" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" placeholder="e.g. C9300-48P-A" />
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Lead Time (Days)</label>
              <input type="number" name="lead_time_days" min="0" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Minimum Order Quantity (MOQ)</label>
              <input type="number" name="minimum_order_quantity" step="0.01" min="0.01" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
            </div>

            <div className="col-span-2">
              <label className="flex items-center space-x-3 mt-4">
                <input type="checkbox" name="is_preferred" value="true" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600" />
                <span className="text-sm font-medium text-gray-700">Set as Preferred Vendor</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">Checking this will replace the current preferred vendor if one exists.</p>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea name="notes" rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border"></textarea>
            </div>
          </div>
        </div>

        <div className="pt-5 border-t border-gray-200">
          <div className="flex justify-end">
            <button type="submit" className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              Save Mapping
            </button>
          </div>
        </div>
      </form>
    </RecordPage>
  );
}
