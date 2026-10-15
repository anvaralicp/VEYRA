/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { getSolutionById } from "../../../../../lib/presales/solution-service";
import { notFound } from "next/navigation";
import { newSolutionRevisionAction } from '../../../actions';

export const instant = false;

export default async function SolutionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const sol = await getSolutionById(resolvedParams.id);
  if (!sol) notFound();

  const activeTab = resolvedSearchParams?.tab || "overview";
  const tabs = [
    { id: "overview", label: "Overview", href: "?tab=overview" },
    { id: "revisions", label: "Revisions", href: "?tab=revisions" },
    { id: "boq", label: "BOQs", href: "?tab=boq" }
  ];

  const breadcrumbs = [
    { label: "Presales", href: "/presales/solutions" },
    { label: "Solutions", href: "/presales/solutions" },
    { label: sol.solution_number }
  ];

  const { checkPermissionForUI } = await import("../../../../../lib/auth/boundary");
  const canUpdate = await checkPermissionForUI("solution.update");

  return (
    <RecordPage
      breadcrumbs={breadcrumbs}
      title={sol.name}
      activeTab={activeTab}
      tabs={tabs}
    >
      {activeTab === "overview" && (
        <div className="space-y-6">
          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium border-b pb-2 mb-4">Solution Details</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <div><dt className="text-sm font-medium text-gray-500">Number</dt><dd className="mt-1 text-sm text-gray-900">{sol.solution_number}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Status</dt><dd className="mt-1 text-sm text-gray-900">{sol.status}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Opportunity</dt><dd className="mt-1 text-sm text-gray-900">{sol.opportunity?.name}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Owner ID</dt><dd className="mt-1 text-sm text-gray-900">{sol.owner_id}</dd></div>
            </dl>
          </section>

          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium border-b pb-2 mb-4">Architecture</h3>
            <div className="space-y-4">
              <div><h4 className="text-sm font-medium text-gray-500">Description</h4><p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{sol.description || '-'}</p></div>
              <div><h4 className="text-sm font-medium text-gray-500">Architecture Summary</h4><p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{sol.architecture_summary || '-'}</p></div>
              <div><h4 className="text-sm font-medium text-gray-500">Assumptions</h4><p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{sol.assumptions || '-'}</p></div>
              <div><h4 className="text-sm font-medium text-gray-500">Exclusions</h4><p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{sol.exclusions || '-'}</p></div>
              <div><h4 className="text-sm font-medium text-gray-500">Technical Notes</h4><p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{sol.technical_notes || '-'}</p></div>
            </div>
          </section>
        </div>
      )}

      {activeTab === "revisions" && (
        <div className="space-y-6">
          {canUpdate && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium border-b pb-2 mb-4">Create New Revision</h3>
              <form action={newSolutionRevisionAction.bind(null, sol.id)} className="space-y-4">
                <input type="text" name="title" placeholder="Revision Title (optional)" className="w-full px-3 py-2 border rounded-md" />
                <textarea name="description" placeholder="Description of changes" className="w-full px-3 py-2 border rounded-md" defaultValue={sol.description || ''}></textarea>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm">Create Revision</button>
              </form>
            </div>
          )}

          <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rev #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sol.revisions.map((rev: any) => (
                  <tr key={rev.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">R{rev.revision_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{rev.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(rev.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "boq" && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center text-gray-500 py-12">
          BOQs associated with this solution will be listed here.
        </div>
      )}
    </RecordPage>
  );
}
