/* eslint-disable @typescript-eslint/no-explicit-any */
import { ListPage } from "../../../../components/templates/ListPage";
import { getCustomers } from "../../../../lib/crm/customer-service";
import Link from "next/link";
import * as Icons from "lucide-react";
export const instant = false;

export default async function CustomersListPage({ searchParams }: { searchParams?: Promise<{ q?: string }> | { q?: string } }) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const query = resolvedSearchParams?.q;
  const customers = await getCustomers(query);

  // We should also conditionally render the "Create Customer" button
  // Let's assume we use checkPermissionForUI
  const { checkPermissionForUI } = await import("../../../../lib/auth/boundary");
  const canCreate = await checkPermissionForUI("customer.create");

  const actions = canCreate ? (
    <Link
      href="/crm/customers/new"
      className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
    >
      <Icons.Plus className="mr-2 h-4 w-4" />
      New Customer
    </Link>
  ) : null;

  return (
    <ListPage
      title="Customers"
      description="Manage your customer relationships and records."
      actions={actions}
    >
      <div className="min-w-full inline-block align-middle">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No customers found.
                </td>
              </tr>
            ) : (
              customers.map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    <Link href={`/crm/customers/${c.id}`}>{c.customer_number}</Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {c.display_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {c.customer_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      c.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link href={`/crm/customers/${c.id}`} className="text-gray-400 hover:text-blue-600">
                      <Icons.ChevronRight className="h-5 w-5 ml-auto" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ListPage>
  );
}
