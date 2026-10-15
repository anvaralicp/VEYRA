/* eslint-disable @typescript-eslint/no-explicit-any */
import { ListPage } from "../../../../components/templates/ListPage";
import { getOpportunities } from "../../../../lib/crm/opportunity-service";
import Link from "next/link";
import * as Icons from "lucide-react";

export const instant = false;

export default async function OpportunitiesListPage({ searchParams }: { searchParams?: Promise<{ q?: string }> | { q?: string } }) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const query = resolvedSearchParams?.q;
  const opps = await getOpportunities(query);

  const { checkPermissionForUI } = await import("../../../../lib/auth/boundary");
  const canCreate = await checkPermissionForUI("opportunity.create");

  const actions = (
    <div className="flex items-center gap-2">
      <Link
        href="/crm/opportunities/pipeline"
        className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 h-10 px-4 py-2"
      >
        <Icons.Kanban className="mr-2 h-4 w-4" />
        Pipeline
      </Link>
      {canCreate && (
        <Link
          href="/crm/opportunities/new"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
        >
          <Icons.Plus className="mr-2 h-4 w-4" />
          New Opportunity
        </Link>
      )}
    </div>
  );

  return (
    <ListPage
      title="Opportunities"
      description="Manage sales pipeline and potential business."
      actions={actions}
    >
      <div className="min-w-full inline-block align-middle overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Weighted</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {opps.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  No opportunities found.
                </td>
              </tr>
            ) : (
              opps.map((opp: any) => {
                const val = opp.estimated_value || 0;
                const prob = opp.probability || 0;
                const weighted = (val * prob) / 100;
                return (
                  <tr key={opp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      <Link href={`/crm/opportunities/${opp.id}`}>{opp.opportunity_number}</Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{opp.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{opp.customer?.display_name || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{opp.stage}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {val ? `${opp.currency} ${val.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {weighted ? `${opp.currency} ${weighted.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        opp.status === 'WON' ? 'bg-green-100 text-green-800' :
                        opp.status === 'LOST' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {opp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link href={`/crm/opportunities/${opp.id}`} className="text-gray-400 hover:text-blue-600">
                        <Icons.ChevronRight className="h-5 w-5 ml-auto" />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </ListPage>
  );
}
