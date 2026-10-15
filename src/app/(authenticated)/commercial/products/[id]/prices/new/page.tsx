/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecordPage } from "../../../../../../../components/templates/RecordPage";
import { getProductById } from "../../../../../../../lib/commercial/product-service";
import { listMappingsForProduct } from "../../../../../../../lib/commercial/product-vendor-service";
import { listCurrencies } from "../../../../../../../lib/commercial/currency-service";
import { requirePermission } from "../../../../../../../lib/auth/boundary";
import { notFound } from "next/navigation";
import { createVendorPriceAction } from '../../../../../actions';

export default async function AddPricePage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  await requirePermission("pricing.create");
  const resolvedParams = await Promise.resolve(params);
  const product = await getProductById(resolvedParams.id);

  if (!product || !product.is_active) {
    notFound();
  }

  // Get active mappings
  const allMappings = await listMappingsForProduct(product.id);
  const activeMappings = allMappings.filter((m: any) => m.is_active);

  if (activeMappings.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500">
        You must map a vendor to this product before you can add a price.
      </div>
    );
  }

  // Get active currencies
  const allCurrencies = await listCurrencies();
  const activeCurrencies = allCurrencies.filter((c: any) => c.is_active);

  return (
    <RecordPage
      title={`Add Vendor Price: ${product.name}`}
      breadcrumbs={[
        { label: "Commercial", href: "/commercial" },
        { label: "Products & Services", href: "/commercial/products" },
        { label: product.item_code, href: `/commercial/products/${product.id}` }
      ]}
      activeTab="form"
      tabs={[{ id: "form", label: "Price Details" }]}
    >
      <form action={createVendorPriceAction} className="p-6 space-y-8 max-w-4xl">
        <input type="hidden" name="product_id" value={product.id} />

        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 border-b pb-2">Pricing details</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Mapped Vendor *</label>
              <select name="product_vendor_id" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border">
                <option value="">-- Select Vendor Mapping --</option>
                {activeMappings.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.vendor.name} {m.is_preferred ? '(Preferred)' : ''}</option>
                ))}
              </select>
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Currency *</label>
              <select name="currency_id" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border">
                <option value="">-- Select Currency --</option>
                {activeCurrencies.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Unit Cost *</label>
              <input type="number" step="0.0001" min="0" name="unit_cost" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" placeholder="0.00" />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Minimum Quantity for Price Break (Optional)</label>
              <input type="number" name="minimum_quantity" step="0.01" min="0.01" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" placeholder="e.g. 10" />
              <p className="text-xs text-gray-500 mt-1">Leave blank for base pricing.</p>
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Valid From *</label>
              <input type="date" name="valid_from" required defaultValue={new Date().toISOString().split('T')[0]} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Valid Until (Optional)</label>
              <input type="date" name="valid_until" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Vendor Reference / Quote Number (Optional)</label>
              <input type="text" name="reference_number" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
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
              Save Price
            </button>
          </div>
        </div>
      </form>
    </RecordPage>
  );
}
