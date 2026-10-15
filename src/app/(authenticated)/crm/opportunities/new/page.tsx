/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { createOpportunityAction } from '../../../actions';
import { getTenantContext } from "../../../../../lib/tenant/context";
import { getTenantDb } from "../../../../../lib/db/tenant-db";

export const instant = false;

export default async function NewOpportunityPage() {
  const context = await getTenantContext();
  const tdb = await getTenantDb();

  // Need users to assign owner
  const members = await tdb.tenantMember.findMany({
    where: { tenant_id: context.tenantId },
    include: { user: { select: { name: true, email: true } } }
  });

  // Need customers
  const customers = await (tdb as any).Customer.findMany({
    where: { tenant_id: context.tenantId, deleted_at: null },
    select: { id: true, display_name: true }
  });

  const breadcrumbs = [
    { label: "CRM", href: "/crm/opportunities" },
    { label: "Opportunities", href: "/crm/opportunities" },
    { label: "New Opportunity" }
  ];

  return (
    <RecordPage
      breadcrumbs={breadcrumbs}
      title="Create New Opportunity"
      activeTab="overview"
      tabs={[{ id: "overview", label: "Details" }]}
    >
      <form action={createOpportunityAction} className="space-y-8 max-w-3xl">

        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">General Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Opportunity Name *</label>
              <input type="text" name="name" required className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Customer *</label>
              <select name="customer_id" required className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="">Select Customer...</option>
                {customers.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.display_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Owner *</label>
              <select name="owner_id" required defaultValue={context.userId} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md">
                {members.map((m: any) => (
                  <option key={m.user_id} value={m.user_id}>{m.user.name || m.user.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Stage</label>
              <select name="stage" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="NEW">New</option>
                <option value="QUALIFICATION">Qualification</option>
                <option value="DISCOVERY">Discovery</option>
                <option value="SOLUTION">Solution</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="NEGOTIATION">Negotiation</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Source</label>
              <input type="text" name="source" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>
        </section>

        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Financials & Timeline</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Estimated Value</label>
              <input type="number" step="0.01" name="estimated_value" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Currency</label>
              <input type="text" name="currency" defaultValue="USD" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Probability (%)</label>
              <input type="number" min="0" max="100" name="probability" defaultValue="10" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Expected Close Date</label>
              <input type="date" name="expected_close_date" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea name="description" rows={3} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"></textarea>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-4">
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700">
            Create Opportunity
          </button>
        </div>

      </form>
    </RecordPage>
  );
}
