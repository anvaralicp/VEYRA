/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { createRequirementAction } from '../../../actions';
import { getTenantContext } from "../../../../../lib/tenant/context";
import { getTenantDb } from "../../../../../lib/db/tenant-db";

export const instant = false;

export default async function NewRequirementPage() {
  const context = await getTenantContext();
  const tdb = await getTenantDb();

  const members = await (tdb as any).TenantMember.findMany({
    where: { tenant_id: context.tenantId },
    include: { user: { select: { name: true, email: true } } }
  });

  const opps = await (tdb as any).Opportunity.findMany({
    where: { tenant_id: context.tenantId, status: "OPEN" },
    select: { id: true, name: true, opportunity_number: true, customer_id: true }
  });

  // Since requirement requires customer, we can either select it or derive from opp. For simplicity, derive it in UI by mapping.
  // Actually, just pass opps, we will let user select opp. We should probably require them to select customer separately or fetch it.
  const customers = await (tdb as any).Customer.findMany({
    where: { tenant_id: context.tenantId, deleted_at: null },
    select: { id: true, display_name: true }
  });

  const breadcrumbs = [
    { label: "Presales", href: "/presales/requirements" },
    { label: "Requirements", href: "/presales/requirements" },
    { label: "New Requirement" }
  ];

  return (
    <RecordPage
      breadcrumbs={breadcrumbs}
      title="Create New Requirement"
      activeTab="overview"
      tabs={[{ id: "overview", label: "Details" }]}
    >
      <form action={createRequirementAction} className="space-y-8 max-w-3xl">
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Requirement Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Title *</label>
              <input type="text" name="title" required className="mt-1 w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Opportunity *</label>
              <select name="opportunity_id" required className="mt-1 w-full px-3 py-2 border rounded-md">
                <option value="">Select Opportunity...</option>
                {opps.map((o: any) => <option key={o.id} value={o.id}>[{o.opportunity_number}] {o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Customer *</label>
              <select name="customer_id" required className="mt-1 w-full px-3 py-2 border rounded-md">
                <option value="">Select Customer...</option>
                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Priority</label>
              <select name="priority" className="mt-1 w-full px-3 py-2 border rounded-md">
                <option value="LOW">Low</option>
                <option value="MEDIUM" selected>Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Owner *</label>
              <select name="owner_id" required defaultValue={context.userId} className="mt-1 w-full px-3 py-2 border rounded-md">
                {members.map((m: any) => (
                  <option key={m.user_id} value={m.user_id}>{m.user.name || m.user.email}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Technical Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea name="description" rows={2} className="mt-1 w-full px-3 py-2 border rounded-md"></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Business Need</label>
              <textarea name="business_need" rows={2} className="mt-1 w-full px-3 py-2 border rounded-md"></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Technical Need</label>
              <textarea name="technical_need" rows={2} className="mt-1 w-full px-3 py-2 border rounded-md"></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Scope</label>
              <textarea name="scope" rows={2} className="mt-1 w-full px-3 py-2 border rounded-md"></textarea>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-4">
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700">
            Create Requirement
          </button>
        </div>
      </form>
    </RecordPage>
  );
}
