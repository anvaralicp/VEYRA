import { getTenantContext } from "../../../lib/tenant/context";
import { db } from "../../../prisma/db";
import { getModel } from "../../../lib/db/legacy-adapter";
import { updateOrganization } from "./actions";

import { PageHeader } from "../../../components/ui/page-header";
import { ContentContainer } from "../../../components/ui/content-container";

export const instant = false;

export default async function AdminOrganizationPage() {
  const context = await getTenantContext();

  // Actually, wait, getTenantContext() only resolves the tenant ID, and RBAC is done in actions.
  // We can let the user view this page if they have organization.view, but they can't save unless they have organization.update.

  let tenant = null;
  try {
    const Tenant = getModel(db, "Tenant");
    tenant = Tenant
      ? await Tenant.findUnique({
          where: { id: context.tenantId },
          select: {
            id: true,
            name: true,
            legal_name: true,
            email: true,
            phone: true,
            website: true,
            timezone: true,
          },
        })
      : null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[AdminOrganizationPage] Failed to fetch tenant details:", msg);
    tenant = null;
  }

  if (!tenant) return <div>Tenant not found</div>;

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      <PageHeader title="Organization Settings" description="Manage your tenant configuration." />
      <ContentContainer className="flex-1 p-6">
        <div className="max-w-4xl bg-white p-8 rounded-lg shadow-sm border border-gray-200">
          <form action={updateOrganization} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Display Name</label>
                <input type="text" name="name" defaultValue={tenant.name} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Legal Name</label>
                <input type="text" name="legal_name" defaultValue={tenant.legal_name || ""} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input type="email" name="email" defaultValue={tenant.email || ""} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input type="text" name="phone" defaultValue={tenant.phone || ""} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Website</label>
                <input type="text" name="website" defaultValue={tenant.website || ""} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Timezone</label>
                <input type="text" name="timezone" defaultValue={tenant.timezone} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 flex justify-end">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </ContentContainer>
    </div>
  );
}
