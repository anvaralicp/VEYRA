/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { createBOQAction } from '../../../actions';
import { getTenantContext } from "../../../../../lib/tenant/context";
import { getTenantDb } from "../../../../../lib/db/tenant-db";

export const instant = false;

export default async function NewBOQPage() {
  const context = await getTenantContext();
  const tdb = await getTenantDb();

  const opps = await (tdb as any).Opportunity.findMany({
    where: { tenant_id: context.tenantId, status: "OPEN" },
    select: { id: true, name: true, opportunity_number: true }
  });

  const sols = await (tdb as any).Solution.findMany({
    where: { tenant_id: context.tenantId },
    select: { id: true, name: true, solution_number: true }
  });

  const breadcrumbs = [
    { label: "Presales", href: "/presales/boqs" },
    { label: "BOQs", href: "/presales/boqs" },
    { label: "New BOQ" }
  ];

  return (
    <RecordPage
      breadcrumbs={breadcrumbs}
      title="Create New BOQ"
      activeTab="overview"
      tabs={[{ id: "overview", label: "Details" }]}
    >
      <form action={createBOQAction} className="space-y-8 max-w-3xl">
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">BOQ Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Name *</label>
              <input type="text" name="name" required className="mt-1 w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Opportunity *</label>
              <select name="opportunity_id" required className="mt-1 w-full px-3 py-2 border rounded-md">
                <option value="">Select Opportunity...</option>
                {opps.map((o: any) => <option key={o.id} value={o.id}>[{o.opportunity_number}] {o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Solution</label>
              <select name="solution_id" className="mt-1 w-full px-3 py-2 border rounded-md">
                <option value="">Select Solution...</option>
                {sols.map((s: any) => <option key={s.id} value={s.id}>[{s.solution_number}] {s.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea name="description" rows={3} className="mt-1 w-full px-3 py-2 border rounded-md"></textarea>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-4">
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700">
            Create BOQ
          </button>
        </div>
      </form>
    </RecordPage>
  );
}
