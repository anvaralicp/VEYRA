/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { getCustomerById } from "../../../../../lib/crm/customer-service";
import { notFound } from "next/navigation";
import * as Icons from "lucide-react";
import Link from "next/link";
import { updateCustomerAction, createContactAction, createSiteAction } from '../../../actions';

export const instant = false;

export default async function Customer360Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const customer = await getCustomerById(resolvedParams.id);

  if (!customer) {
    notFound();
  }

  const activeTab = resolvedSearchParams?.tab || "overview";

  const breadcrumbs = [
    { label: "CRM", href: "/crm/customers" },
    { label: "Customers", href: "/crm/customers" },
    { label: customer.customer_number }
  ];

  const tabs = [
    { id: "overview", label: "Overview", href: `?tab=overview` },
    { id: "contacts", label: `Contacts (${customer.contacts.length})`, href: `?tab=contacts` },
    { id: "sites", label: `Sites (${customer.sites.length})`, href: `?tab=sites` },
  ];

  return (
    <RecordPage
      breadcrumbs={breadcrumbs}
      title={`${customer.customer_number} - ${customer.display_name}`}
      activeTab={activeTab}
      tabs={tabs}
    >
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium border-b pb-2 mb-4">Customer Details</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <div><dt className="text-sm font-medium text-gray-500">Legal Name</dt><dd className="mt-1 text-sm text-gray-900">{customer.legal_name}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Customer Type</dt><dd className="mt-1 text-sm text-gray-900">{customer.customer_type}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Status</dt><dd className="mt-1 text-sm text-gray-900">{customer.status}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Industry</dt><dd className="mt-1 text-sm text-gray-900">{customer.industry || '-'}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Account Manager</dt><dd className="mt-1 text-sm text-gray-900">{customer.account_manager_id || 'Unassigned'}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Created At</dt><dd className="mt-1 text-sm text-gray-900">{new Date(customer.created_at).toLocaleDateString()}</dd></div>
            </dl>
          </section>

          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium border-b pb-2 mb-4">Registration & Contact</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <div><dt className="text-sm font-medium text-gray-500">GSTIN</dt><dd className="mt-1 text-sm text-gray-900">{customer.gstin || '-'}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">PAN</dt><dd className="mt-1 text-sm text-gray-900">{customer.pan || '-'}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Registration</dt><dd className="mt-1 text-sm text-gray-900">{customer.registration_number || '-'}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Email</dt><dd className="mt-1 text-sm text-gray-900">{customer.email || '-'}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Phone</dt><dd className="mt-1 text-sm text-gray-900">{customer.phone || '-'}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Website</dt><dd className="mt-1 text-sm text-gray-900">{customer.website || '-'}</dd></div>
            </dl>
          </section>

          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 md:col-span-2">
            <h3 className="text-lg font-medium border-b pb-2 mb-4">Related Records Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-semibold text-blue-700">{customer._count?.opportunities || 0}</div>
                <div className="text-sm text-blue-600 font-medium">Opportunities</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-semibold text-green-700">{customer._count?.requirements || 0}</div>
                <div className="text-sm text-green-600 font-medium">Requirements</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-semibold text-purple-700">0</div>
                <div className="text-sm text-purple-600 font-medium">Projects</div>
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === "contacts" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium">Contacts</h3>
            <form action={createContactAction.bind(null, customer.id)} className="flex gap-2">
              <input type="text" name="name" placeholder="Contact Name" required className="px-3 py-1 border rounded-md text-sm" />
              <input type="email" name="email" placeholder="Email" className="px-3 py-1 border rounded-md text-sm" />
              <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700">Add</button>
            </form>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customer.contacts.map((contact: any) => (
                  <tr key={contact.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{contact.name} {contact.is_primary && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Primary</span>}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{contact.email || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{contact.phone || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{contact.contact_type}</td>
                  </tr>
                ))}
                {customer.contacts.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500 text-sm">No contacts found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "sites" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium">Sites</h3>
            <form action={createSiteAction.bind(null, customer.id)} className="flex gap-2">
              <input type="text" name="name" placeholder="Site Name" required className="px-3 py-1 border rounded-md text-sm" />
              <input type="text" name="city" placeholder="City" className="px-3 py-1 border rounded-md text-sm" />
              <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700">Add</button>
            </form>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customer.sites.map((site: any) => (
                  <tr key={site.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{site.site_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{site.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{site.city || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{site.site_type}</td>
                  </tr>
                ))}
                {customer.sites.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500 text-sm">No sites found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </RecordPage>
  );
}
