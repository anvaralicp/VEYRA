/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { createSiteSurveyAction } from '../../../actions';
import { getTenantContext } from "../../../../../lib/tenant/context";
import { getTenantDb } from "../../../../../lib/db/tenant-db";

export const instant = false;

export default async function NewSiteSurveyPage() {
  const context = await getTenantContext();
  const tdb = await getTenantDb();

  const opps = await (tdb as any).Opportunity.findMany({
    where: { tenant_id: context.tenantId, status: "OPEN" },
    select: { id: true, name: true, opportunity_number: true, customer_id: true }
  });

  const customers = await (tdb as any).Customer.findMany({
    where: { tenant_id: context.tenantId, deleted_at: null },
    select: { id: true, display_name: true }
  });

  const sites = await (tdb as any).CustomerSite.findMany({
    where: { tenant_id: context.tenantId },
    select: { id: true, name: true, customer_id: true }
  });

  const members = await (tdb as any).TenantMember.findMany({
    where: { tenant_id: context.tenantId },
    include: { user: { select: { name: true, email: true } } }
  });

  const breadcrumbs = [
    { label: "Presales", href: "/presales/site-surveys" },
    { label: "Site Surveys", href: "/presales/site-surveys" },
    { label: "New Survey" }
  ];

  return (
    <RecordPage
      breadcrumbs={breadcrumbs}
      title="Create New Site Survey"
      activeTab="overview"
      tabs={[{ id: "overview", label: "Details" }]}
    >
      <form action={createSiteSurveyAction} className="space-y-8 max-w-3xl">
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Survey Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
              <label className="block text-sm font-medium text-gray-700">Customer Site *</label>
              <select name="site_id" required className="mt-1 w-full px-3 py-2 border rounded-md">
                <option value="">Select Site...</option>
                {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Surveyor</label>
              <select name="surveyor_id" className="mt-1 w-full px-3 py-2 border rounded-md">
                <option value="">Select Surveyor...</option>
                {members.map((m: any) => <option key={m.user_id} value={m.user_id}>{m.user.name || m.user.email}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Survey Date</label>
              <input type="date" name="survey_date" className="mt-1 w-full px-3 py-2 border rounded-md" />
            </div>
          </div>
        </section>

        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Technical Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Summary</label>
              <textarea name="summary" rows={2} className="mt-1 w-full px-3 py-2 border rounded-md"></textarea>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-4">
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700">
            Create Survey
          </button>
        </div>
      </form>
    </RecordPage>
  );
}
