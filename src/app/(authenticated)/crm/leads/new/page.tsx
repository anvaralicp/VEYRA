/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { createLeadAction } from '../../../actions';
import { getTenantContext } from "../../../../../lib/tenant/context";
import { getTenantDb } from "../../../../../lib/db/tenant-db";

export const instant = false;

export default async function NewLeadPage() {
  const context = await getTenantContext();
  const tdb = await getTenantDb();

  // Need users to assign owner
  const members = await tdb.tenantMember.findMany({
    where: { tenant_id: context.tenantId },
    include: { user: { select: { name: true, email: true } } }
  });

  const breadcrumbs = [
    { label: "CRM", href: "/crm/leads" },
    { label: "Leads", href: "/crm/leads" },
    { label: "New Lead" }
  ];

  return (
    <RecordPage
      breadcrumbs={breadcrumbs}
      title="Create New Lead"
      activeTab="overview"
      tabs={[{ id: "overview", label: "Details" }]}
    >
      <form action={createLeadAction} className="space-y-8 max-w-3xl">

        {/* GENERAL */}
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Lead Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Company Name *</label>
              <input type="text" name="company_name" required className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Contact Name *</label>
              <input type="text" name="contact_name" required className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" name="email" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input type="text" name="phone" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Source</label>
              <select name="source" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="WEBSITE">Website</option>
                <option value="REFERRAL">Referral</option>
                <option value="PARTNER">Partner</option>
                <option value="OEM">OEM</option>
                <option value="DISTRIBUTOR">Distributor</option>
                <option value="SOCIAL">Social</option>
                <option value="EVENT">Event</option>
                <option value="COLD_OUTREACH">Cold Outreach</option>
                <option value="EXISTING_CUSTOMER">Existing Customer</option>
                <option value="OTHER">Other</option>
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
          </div>
        </section>

        {/* DETAILS */}
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Business Details</h2>
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
              <label className="block text-sm font-medium text-gray-700">Expected Close Date</label>
              <input type="date" name="expected_close_date" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Requirement / Notes</label>
              <textarea name="requirement" rows={4} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"></textarea>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-4">
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700">
            Create Lead
          </button>
        </div>

      </form>
    </RecordPage>
  );
}
