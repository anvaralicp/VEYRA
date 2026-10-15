/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { getBOQById } from "../../../../../lib/presales/boq-service";
import { notFound } from "next/navigation";
import { addBOQLineAction, submitBOQRevisionAction, approveBOQRevisionAction, rejectBOQRevisionAction, newBOQRevisionAction } from '../../../actions';
import { checkPermissionForUI } from "../../../../../lib/auth/boundary";

export const instant = false;

export default async function BOQDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const boq = await getBOQById(resolvedParams.id);
  if (!boq) notFound();

  const activeTab = resolvedSearchParams?.tab || "overview";
  const tabs = [
    { id: "overview", label: "Overview", href: "?tab=overview" },
    { id: "lines", label: "Lines", href: "?tab=lines" },
    { id: "revisions", label: "Revisions", href: "?tab=revisions" }
  ];

  const breadcrumbs = [
    { label: "Presales", href: "/presales/boqs" },
    { label: "BOQs", href: "/presales/boqs" },
    { label: boq.boq_number }
  ];

  const currentRev = boq.revisions.find((r: any) => r.id === boq.current_revision_id) || boq.revisions[0];
  const canUpdate = await checkPermissionForUI("boq.update");
  const canSubmit = await checkPermissionForUI("boq.submit");
  const canApprove = await checkPermissionForUI("boq.approve");
  const canCreate = await checkPermissionForUI("boq.create");

  const isDraft = currentRev && (currentRev.status === "DRAFT" || currentRev.status === "REJECTED");
  const isSubmitted = currentRev && currentRev.status === "SUBMITTED";

  return (
    <RecordPage
      breadcrumbs={breadcrumbs}
      title={boq.name}
      activeTab={activeTab}
      tabs={tabs}
    >
      {activeTab === "overview" && (
        <div className="space-y-6">
          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium border-b pb-2 mb-4">BOQ Details</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <div><dt className="text-sm font-medium text-gray-500">Number</dt><dd className="mt-1 text-sm text-gray-900">{boq.boq_number}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Status</dt><dd className="mt-1 text-sm text-gray-900">{boq.status}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Opportunity</dt><dd className="mt-1 text-sm text-gray-900">{boq.opportunity?.name}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Solution</dt><dd className="mt-1 text-sm text-gray-900">{boq.solution?.name || '-'}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Current Revision</dt><dd className="mt-1 text-sm text-gray-900">R{currentRev?.revision_number} ({currentRev?.status})</dd></div>
            </dl>
          </section>

          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium border-b pb-2 mb-4">Actions</h3>
            <div className="flex gap-4">
              {isDraft && canSubmit && (
                <form action={submitBOQRevisionAction.bind(null, boq.id, currentRev.id)}>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm">Submit for Approval</button>
                </form>
              )}
              {isSubmitted && canApprove && (
                <>
                  <form action={approveBOQRevisionAction.bind(null, boq.id, currentRev.id)}>
                    <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-md text-sm">Approve Revision</button>
                  </form>
                  <form action={rejectBOQRevisionAction.bind(null, boq.id, currentRev.id)}>
                    <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-md text-sm">Reject Revision</button>
                  </form>
                </>
              )}
              {!isDraft && !isSubmitted && canCreate && (
                <form action={newBOQRevisionAction.bind(null, boq.id)}>
                  <button type="submit" className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm">New Revision</button>
                </form>
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === "lines" && currentRev && (
        <div className="space-y-6">
          {isDraft && canUpdate && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium border-b pb-2 mb-4">Add Line Item</h3>
              <form action={addBOQLineAction.bind(null, boq.id, currentRev.id)} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div><label className="block text-xs">Product</label><input type="text" name="product_name" required className="w-full px-2 py-1 border rounded" /></div>
                <div><label className="block text-xs">Mfr</label><input type="text" name="manufacturer" className="w-full px-2 py-1 border rounded" /></div>
                <div><label className="block text-xs">Qty</label><input type="number" name="quantity" defaultValue="1" className="w-full px-2 py-1 border rounded" /></div>
                <div><label className="block text-xs">&nbsp;</label><button type="submit" className="w-full px-2 py-1 bg-blue-600 text-white rounded">Add</button></div>
              </form>
            </div>
          )}

          <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mfr</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currentRev.lines.map((l: any) => (
                  <tr key={l.id}>
                    <td className="px-6 py-4 text-sm text-gray-500">{l.line_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{l.product_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{l.manufacturer}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{l.quantity} {l.unit}</td>
                  </tr>
                ))}
                {currentRev.lines.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">No lines added yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "revisions" && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rev #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {boq.revisions.map((rev: any) => (
                <tr key={rev.id} className={rev.id === boq.current_revision_id ? "bg-blue-50" : ""}>
                  <td className="px-6 py-4 text-sm font-medium">R{rev.revision_number} {rev.id === boq.current_revision_id ? "(Current)" : ""}</td>
                  <td className="px-6 py-4 text-sm">{rev.status}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(rev.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </RecordPage>
  );
}
