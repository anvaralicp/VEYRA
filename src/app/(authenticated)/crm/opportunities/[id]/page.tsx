/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { getOpportunityById } from "../../../../../lib/crm/opportunity-service";
import { notFound } from "next/navigation";
import { markOpportunityWonAction, markOpportunityLostAction } from '../../../actions';

export const instant = false;

export default async function OpportunityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const opp = await getOpportunityById(resolvedParams.id);
  if (!opp) notFound();

  const activeTab = resolvedSearchParams?.tab || "overview";
  const tabs = [
    { id: "overview", label: "Overview", href: "?tab=overview" },
    { id: "presales", label: "Presales", href: "?tab=presales" },
    { id: "commercial", label: "Commercial", href: "?tab=commercial" }
  ];

  const breadcrumbs = [
    { label: "CRM", href: "/crm/opportunities" },
    { label: "Opportunities", href: "/crm/opportunities" },
    { label: opp.opportunity_number }
  ];

  return (
    <RecordPage
      breadcrumbs={breadcrumbs}
      title={opp.name}
      activeTab={activeTab}
      tabs={tabs}
    >
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium border-b pb-2 mb-4">Opportunity Details</h3>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <div><dt className="text-sm font-medium text-gray-500">Number</dt><dd className="mt-1 text-sm text-gray-900">{opp.opportunity_number}</dd></div>
                <div><dt className="text-sm font-medium text-gray-500">Status</dt><dd className="mt-1 text-sm text-gray-900">{opp.status}</dd></div>
                <div><dt className="text-sm font-medium text-gray-500">Stage</dt><dd className="mt-1 text-sm text-gray-900">{opp.stage}</dd></div>
                <div><dt className="text-sm font-medium text-gray-500">Customer</dt><dd className="mt-1 text-sm text-gray-900">{opp.customer?.display_name || '-'}</dd></div>
                <div><dt className="text-sm font-medium text-gray-500">Value</dt><dd className="mt-1 text-sm text-gray-900">{opp.estimated_value ? `${opp.currency} ${opp.estimated_value.toLocaleString()}` : '-'}</dd></div>
                <div><dt className="text-sm font-medium text-gray-500">Probability</dt><dd className="mt-1 text-sm text-gray-900">{opp.probability}%</dd></div>
                <div><dt className="text-sm font-medium text-gray-500">Expected Close</dt><dd className="mt-1 text-sm text-gray-900">{opp.expected_close_date ? new Date(opp.expected_close_date).toLocaleDateString() : '-'}</dd></div>
                <div><dt className="text-sm font-medium text-gray-500">Source</dt><dd className="mt-1 text-sm text-gray-900">{opp.source || '-'}</dd></div>
                <div className="sm:col-span-2"><dt className="text-sm font-medium text-gray-500">Description</dt><dd className="mt-1 text-sm text-gray-900">{opp.description || '-'}</dd></div>
              </dl>
            </section>
          </div>

          <div className="space-y-6">
            <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium border-b pb-2 mb-4">Actions</h3>
              {opp.status === "OPEN" ? (
                <div className="space-y-4">
                  <form action={markOpportunityWonAction.bind(null, opp.id)}>
                    <button type="submit" className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium">Mark as Won</button>
                  </form>
                  <form action={markOpportunityLostAction.bind(null, opp.id)} className="space-y-2">
                    <input type="text" name="loss_reason" placeholder="Reason for loss..." required className="w-full px-3 py-2 border rounded-md text-sm" />
                    <button type="submit" className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium">Mark as Lost</button>
                  </form>
                </div>
              ) : (
                <div className="text-center p-4 bg-gray-50 rounded-md">
                  This opportunity is {opp.status}.
                  {opp.status === "LOST" && opp.loss_reason && <p className="mt-2 text-sm text-gray-600">Reason: {opp.loss_reason}</p>}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {activeTab === "presales" && (
        <div className="space-y-6">
          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium border-b pb-2 mb-4">Requirements</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead><tr><th className="px-2 py-2 text-left text-xs text-gray-500 uppercase">Number</th><th className="px-2 py-2 text-left text-xs text-gray-500 uppercase">Title</th><th className="px-2 py-2 text-left text-xs text-gray-500 uppercase">Status</th></tr></thead>
                <tbody className="divide-y divide-gray-200">
                  {opp.requirements.length === 0 ? (
                    <tr><td colSpan={3} className="px-2 py-4 text-gray-500 text-center">No requirements found.</td></tr>
                  ) : (
                    opp.requirements.map((r: any) => (
                      <tr key={r.id}>
                        <td className="px-2 py-2"><a href={`/presales/requirements/${r.id}`} className="text-blue-600">{r.requirement_number}</a></td>
                        <td className="px-2 py-2">{r.title}</td>
                        <td className="px-2 py-2">{r.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium border-b pb-2 mb-4">Site Surveys</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead><tr><th className="px-2 py-2 text-left text-xs text-gray-500 uppercase">Number</th><th className="px-2 py-2 text-left text-xs text-gray-500 uppercase">Status</th></tr></thead>
                <tbody className="divide-y divide-gray-200">
                  {opp.site_surveys.length === 0 ? (
                    <tr><td colSpan={2} className="px-2 py-4 text-gray-500 text-center">No site surveys found.</td></tr>
                  ) : (
                    opp.site_surveys.map((s: any) => (
                      <tr key={s.id}>
                        <td className="px-2 py-2"><a href={`/presales/site-surveys/${s.id}`} className="text-blue-600">{s.survey_number}</a></td>
                        <td className="px-2 py-2">{s.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium border-b pb-2 mb-4">Solutions</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead><tr><th className="px-2 py-2 text-left text-xs text-gray-500 uppercase">Number</th><th className="px-2 py-2 text-left text-xs text-gray-500 uppercase">Name</th><th className="px-2 py-2 text-left text-xs text-gray-500 uppercase">Status</th></tr></thead>
                <tbody className="divide-y divide-gray-200">
                  {opp.solutions.length === 0 ? (
                    <tr><td colSpan={3} className="px-2 py-4 text-gray-500 text-center">No solutions found.</td></tr>
                  ) : (
                    opp.solutions.map((s: any) => (
                      <tr key={s.id}>
                        <td className="px-2 py-2"><a href={`/presales/solutions/${s.id}`} className="text-blue-600">{s.solution_number}</a></td>
                        <td className="px-2 py-2">{s.name}</td>
                        <td className="px-2 py-2">{s.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium border-b pb-2 mb-4">Bills of Quantities (BOQs)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead><tr><th className="px-2 py-2 text-left text-xs text-gray-500 uppercase">Number</th><th className="px-2 py-2 text-left text-xs text-gray-500 uppercase">Name</th><th className="px-2 py-2 text-left text-xs text-gray-500 uppercase">Status</th></tr></thead>
                <tbody className="divide-y divide-gray-200">
                  {opp.boqs.length === 0 ? (
                    <tr><td colSpan={3} className="px-2 py-4 text-gray-500 text-center">No BOQs found.</td></tr>
                  ) : (
                    opp.boqs.map((b: any) => (
                      <tr key={b.id}>
                        <td className="px-2 py-2"><a href={`/presales/boqs/${b.id}`} className="text-blue-600">{b.boq_number}</a></td>
                        <td className="px-2 py-2">{b.name}</td>
                        <td className="px-2 py-2">{b.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activeTab === "commercial" && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center text-gray-500 py-12">
          Commercial (Quotation/BOQ) functionality is not yet implemented.
        </div>
      )}

    </RecordPage>
  );
}
