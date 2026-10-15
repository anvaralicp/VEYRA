/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { getVendorById } from "../../../../../lib/commercial/vendor-service";
import { listMappingsForVendor } from "../../../../../lib/commercial/product-vendor-service";
import { notFound } from "next/navigation";
import { deactivateVendorAction, activateVendorAction } from '../../../actions';
import Link from "next/link";

export default async function VendorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const vendor = await getVendorById(resolvedParams.id);

  if (!vendor) {
    notFound();
  }

  const activeTab = resolvedSearchParams?.tab || "overview";
  let products: any[] = [];
  if (activeTab === "products") {
    products = await listMappingsForVendor(vendor.id);
  }

  return (
    <RecordPage
      title={vendor.name}
      breadcrumbs={[{ label: "Commercial", href: "/commercial" }, { label: "Vendors", href: "/commercial/vendors" }]}
      activeTab={activeTab}
      tabs={[
        { id: "overview", label: "Overview", href: "?tab=overview" },
        { id: "contact", label: "Contact & Address", href: "?tab=contact" },
        { id: "products", label: "Related Products", href: "?tab=products" }
      ]}
    >
      <div className="flex justify-end p-4 border-b">
        {vendor.is_active ? (
          <form action={async () => {
            "use server";
            await deactivateVendorAction(vendor.id);
          }}>
            <button type="submit" className="px-4 py-2 bg-red-100 text-red-700 rounded-md text-sm font-medium hover:bg-red-200">
              Deactivate
            </button>
          </form>
        ) : (
          <form action={async () => {
            "use server";
            await activateVendorAction(vendor.id);
          }}>
            <button type="submit" className="px-4 py-2 bg-green-100 text-green-700 rounded-md text-sm font-medium hover:bg-green-200">
              Activate
            </button>
          </form>
        )}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Identity</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Vendor Code</dt>
                <dd className="mt-1 text-sm text-gray-900">{vendor.vendor_code}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Vendor Type</dt>
                <dd className="mt-1 text-sm text-gray-900">{vendor.vendor_type}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{vendor.name}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Legal Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{vendor.legal_name || '-'}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Display Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{vendor.display_name || '-'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Description</dt>
                <dd className="mt-1 text-sm text-gray-900">{vendor.description || '-'}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1 text-sm text-gray-900">{vendor.is_active ? 'Active' : 'Inactive'}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Tax / Registration</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">GSTIN / Tax ID</dt>
                <dd className="mt-1 text-sm text-gray-900">{vendor.gstin || '-'}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">PAN</dt>
                <dd className="mt-1 text-sm text-gray-900">{vendor.pan || '-'}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {activeTab === "contact" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Contact</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">{vendor.email ? <a href={`mailto:${vendor.email}`} className="text-blue-600 hover:underline">{vendor.email}</a> : '-'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Phone</dt>
                <dd className="mt-1 text-sm text-gray-900">{vendor.phone || '-'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Website</dt>
                <dd className="mt-1 text-sm text-gray-900">{vendor.website ? <a href={vendor.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{vendor.website}</a> : '-'}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Address</h3>
            <address className="not-italic text-sm text-gray-900 space-y-1">
              {vendor.address_line1 || vendor.address_line2 || vendor.city || vendor.state || vendor.postal_code || vendor.country ? (
                <>
                  {vendor.address_line1 && <div>{vendor.address_line1}</div>}
                  {vendor.address_line2 && <div>{vendor.address_line2}</div>}
                  <div>
                    {vendor.city}{vendor.city && vendor.state ? ', ' : ''}{vendor.state} {vendor.postal_code}
                  </div>
                  {vendor.country && <div>{vendor.country}</div>}
                </>
              ) : (
                <span className="text-gray-500">No address provided.</span>
              )}
            </address>
          </div>
        </div>
      )}

      {activeTab === "products" && (
        <div className="p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Products Supplied</h3>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manufacturer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor Part #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preferred</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((p: any) => (
                <tr key={p.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600"><Link href={`/commercial/products/${p.product.id}`}>{p.product.item_code}</Link></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.product.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.product.manufacturer?.name || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.product.model_number || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.vendor_part_number || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.is_preferred ? <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">Preferred</span> : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">No products supplied by this vendor.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </RecordPage>
  );
}
