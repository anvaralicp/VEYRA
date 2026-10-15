/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPipeline } from "../../../../../lib/crm/opportunity-service";
import { PageHeader } from "../../../../../components/ui/page-header";
import { Breadcrumbs } from "../../../../../components/ui/breadcrumbs";
import Link from "next/link";
import * as Icons from "lucide-react";

export const instant = false;

const STAGES = [
  "NEW",
  "QUALIFICATION",
  "DISCOVERY",
  "SOLUTION",
  "COMMERCIAL",
  "NEGOTIATION"
];

export default async function PipelinePage() {
  const opps = await getPipeline();

  const breadcrumbs = [
    { label: "CRM", href: "/crm/opportunities" },
    { label: "Opportunities", href: "/crm/opportunities" },
    { label: "Pipeline" }
  ];

  const actions = (
    <Link
      href="/crm/opportunities/new"
      className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
    >
      <Icons.Plus className="mr-2 h-4 w-4" />
      New Opportunity
    </Link>
  );

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={breadcrumbs} />}
        title="Sales Pipeline"
        actions={actions}
      />
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full min-w-max pb-4">
          {STAGES.map(stage => {
            const stageOpps = opps.filter((o: any) => o.stage === stage);
            const totalValue = stageOpps.reduce((sum: number, o: any) => sum + (o.estimated_value || 0), 0);
            return (
              <div key={stage} className="w-80 flex flex-col bg-gray-100 rounded-lg shrink-0">
                <div className="p-3 border-b border-gray-200">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-semibold text-gray-700">{stage}</h3>
                    <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full font-medium">{stageOpps.length}</span>
                  </div>
                  <p className="text-sm text-gray-500 font-medium">USD {totalValue.toLocaleString()}</p>
                </div>
                <div className="flex-1 p-2 space-y-3 overflow-y-auto">
                  {stageOpps.map((opp: any) => (
                    <Link key={opp.id} href={`/crm/opportunities/${opp.id}`} className="block bg-white p-3 rounded shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow transition-shadow">
                      <h4 className="font-medium text-sm text-blue-600 truncate mb-1">{opp.name}</h4>
                      <p className="text-xs text-gray-900 truncate">{opp.customer?.display_name || 'No Customer'}</p>
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-xs text-gray-500 font-medium">USD {opp.estimated_value ? opp.estimated_value.toLocaleString() : 0}</span>
                        <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">{opp.probability}%</span>
                      </div>
                    </Link>
                  ))}
                  {stageOpps.length === 0 && (
                    <div className="text-center p-4 text-xs text-gray-400">No opportunities</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
