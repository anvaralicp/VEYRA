/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { getProductById } from "../../../../../lib/commercial/product-service";
import { listMappingsForProduct } from "../../../../../lib/commercial/product-vendor-service";
import { listPricesForProduct } from "../../../../../lib/commercial/vendor-price-service";
import { notFound } from "next/navigation";
import { deactivateProductAction, deactivateProductVendorAction, activateProductVendorAction, setPreferredVendorAction, clearPreferredVendorAction, deactivateVendorPriceAction, activateVendorPriceAction } from '../../../actions';
import Link from "next/link";
import { Plus } from "lucide-react";
import { checkPermissionForUI } from "../../../../../lib/auth/boundary";

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const product = await getProductById(resolvedParams.id);

  if (!product) {
    notFound();
  }

  const activeTab = resolvedSearchParams?.tab || "overview";

  let vendors: any[] = [];
  if (activeTab === "vendors") {
    vendors = await listMappingsForProduct(product.id);
  }

  let prices: any[] = [];
  if (activeTab === "pricing") {
    prices = await listPricesForProduct(product.id);
  }

  const canManageVendors = await checkPermissionForUI("product_vendor.create");
  const canManagePricing = await checkPermissionForUI("pricing.create");
  const now = new Date();

  return (
    <RecordPage
      title={product.name}
      breadcrumbs={[{ label: "Commercial", href: "/commercial" }, { label: "Products & Services", href: "/commercial/products" }]}
      activeTab={activeTab}
      tabs={[
        { id: "overview", label: "Overview", href: "?tab=overview" },
        { id: "vendors", label: "Vendors", href: "?tab=vendors" },
        { id: "pricing", label: "Pricing", href: "?tab=pricing" }
      ]}
    >
      <div className="flex justify-end p-4 border-b">
        {product.is_active && (
          <form action={async () => {
            "use server";
            await deactivateProductAction(product.id);
          }}>
            <button type="submit" className="px-4 py-2 bg-red-100 text-red-700 rounded-md text-sm font-medium hover:bg-red-200">
              Deactivate
            </button>
          </form>
        )}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Overview</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Item Code</dt>
                <dd className="mt-1 text-sm text-gray-900">{product.item_code}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Item Type</dt>
                <dd className="mt-1 text-sm text-gray-900">{product.item_type}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{product.name}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Short Description</dt>
                <dd className="mt-1 text-sm text-gray-900">{product.short_description || '-'}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Classification</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Category</dt>
                <dd className="mt-1 text-sm text-gray-900">{product.category?.name || '-'}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Manufacturer</dt>
                <dd className="mt-1 text-sm text-gray-900">{product.manufacturer?.name || '-'}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Model Number</dt>
                <dd className="mt-1 text-sm text-gray-900">{product.model_number || '-'}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Is Serialized</dt>
                <dd className="mt-1 text-sm text-gray-900">{product.is_serialized ? "Yes" : "No"}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {activeTab === "vendors" && (
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Mapped Vendors</h3>
            {canManageVendors && product.is_active && (
              <Link
                href={`/commercial/products/${product.id}/vendors/new`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2"/> Map Vendor
              </Link>
            )}
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Part Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MOQ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preferred</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vendors.map((v: any) => (
                <tr key={v.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600"><Link href={`/commercial/vendors/${v.vendor.id}`}>{v.vendor.name}</Link></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.vendor_part_number || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.lead_time_days !== null ? v.lead_time_days + " days" : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.minimum_order_quantity !== null ? v.minimum_order_quantity.toString() : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.is_preferred ? <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">Preferred</span> : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${v.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {v.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    {canManageVendors && (
                      <>
                        {v.is_active && !v.is_preferred && (
                          <form className="inline" action={async () => { "use server"; await setPreferredVendorAction(v.id, product.id); }}>
                            <button className="text-indigo-600 hover:text-indigo-900">Set Preferred</button>
                          </form>
                        )}
                        {v.is_active && v.is_preferred && (
                          <form className="inline" action={async () => { "use server"; await clearPreferredVendorAction(v.id, product.id); }}>
                            <button className="text-gray-600 hover:text-gray-900">Clear Preferred</button>
                          </form>
                        )}
                        {v.is_active ? (
                          <form className="inline" action={async () => { "use server"; await deactivateProductVendorAction(v.id, product.id); }}>
                            <button className="text-red-600 hover:text-red-900">Deactivate</button>
                          </form>
                        ) : (
                          <form className="inline" action={async () => { "use server"; await activateProductVendorAction(v.id, product.id); }}>
                            <button className="text-green-600 hover:text-green-900">Activate</button>
                          </form>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {vendors.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">No vendors mapped to this product.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "pricing" && (
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Vendor Pricing</h3>
            {canManagePricing && product.is_active && (
              <Link
                href={`/commercial/products/${product.id}/prices/new`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2"/> Add Price
              </Link>
            )}
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Cost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min Qty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valid From</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valid Until</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {prices.map((p: any) => {
                const validFrom = new Date(p.valid_from);
                const validUntil = p.valid_until ? new Date(p.valid_until) : null;
                const isCurrent = p.is_active && validFrom <= now && (!validUntil || validUntil >= now);
                const isFuture = p.is_active && validFrom > now;
                const isExpired = p.is_active && validUntil && validUntil < now;

                return (
                  <tr key={p.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      <Link href={`/commercial/vendors/${p.productVendor.vendor.id}`}>{p.productVendor.vendor.name}</Link>
                      {p.productVendor.is_preferred && <span className="ml-2 px-1.5 py-0.5 bg-yellow-100 text-yellow-800 rounded text-[10px]">Pref</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.currency.symbol} {p.unit_cost.toString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.minimum_quantity ? p.minimum_quantity.toString() : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{validFrom.toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{validUntil ? validUntil.toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {!p.is_active && <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Inactive</span>}
                      {isCurrent && <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Current</span>}
                      {isFuture && <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Future</span>}
                      {isExpired && <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Expired</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {canManagePricing && (
                        <>
                          {p.is_active ? (
                            <form className="inline" action={async () => { "use server"; await deactivateVendorPriceAction(p.id, product.id); }}>
                              <button className="text-red-600 hover:text-red-900">Deactivate</button>
                            </form>
                          ) : (
                            <form className="inline" action={async () => { "use server"; await activateVendorPriceAction(p.id, product.id); }}>
                              <button className="text-green-600 hover:text-green-900">Activate</button>
                            </form>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {prices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">No prices recorded for this product.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </RecordPage>
  );
}
