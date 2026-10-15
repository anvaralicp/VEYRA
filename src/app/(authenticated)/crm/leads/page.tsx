/* eslint-disable @typescript-eslint/no-explicit-any */
import { ListPage } from "../../../../components/templates/ListPage";
import { getLeads } from "../../../../lib/crm/lead-service";
import Link from "next/link";
import * as Icons from "lucide-react";

export const instant = false;

export default async function LeadsListPage({ searchParams }: { searchParams?: Promise<{ q?: string }> | { q?: string } }) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const query = resolvedSearchParams?.q;
  const leads = await getLeads(query);

  const { checkPermissionForUI } = await import("../../../../lib/auth/boundary");
  const canCreate = await checkPermissionForUI("lead.create");
  const canConvert = await checkPermissionForUI("lead.convert");

  const actions = canCreate ? (
    <Link
      href="/crm/leads/new"
      className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
    >
      <Icons.Plus className="mr-2 h-4 w-4" />
      New Lead
    </Link>
  ) : null;

  return (
    <ListPage
      title="Leads"
      description="Manage prospective customers and business requirements."
      actions={actions}
    >
      <div className="min-w-full inline-block align-middle overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No leads found.
                </td>
              </tr>
            ) : (
              leads.map((lead: any) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    <Link href={`/crm/leads/${lead.id}`}>{lead.lead_number}</Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lead.company_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.contact_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.source}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      lead.status === 'CONVERTED' ? 'bg-green-100 text-green-800' :
                      lead.status === 'LOST' ? 'bg-red-100 text-red-800' :
                      lead.status === 'QUALIFIED' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      {canConvert && lead.status !== "CONVERTED" && (
                        <Link
                          href={`/crm/leads/${lead.id}?convert=true`}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium transition-colors"
                        >
                          <Icons.TrendingUp className="h-3 w-3" />
                          Convert
                        </Link>
                      )}
                      <Link href={`/crm/leads/${lead.id}`} className="text-gray-400 hover:text-blue-600">
                        <Icons.ChevronRight className="h-5 w-5" />
                      </Link>
                    </div>
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
