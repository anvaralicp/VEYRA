
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { getRequirementById } from "../../../../../lib/presales/requirement-service";
import { notFound } from "next/navigation";

export const instant = false;

export default async function RequirementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const req = await getRequirementById(resolvedParams.id);
  if (!req) notFound();

  const activeTab = resolvedSearchParams?.tab || "overview";
  const tabs = [
    { id: "overview", label: "Overview", href: "?tab=overview" },
    { id: "surveys", label: "Site Surveys", href: "?tab=surveys" },
    { id: "solutions", label: "Solutions", href: "?tab=solutions" }
  ];

  const breadcrumbs = [
    { label: "Presales", href: "/presales/requirements" },
    { label: "Requirements", href: "/presales/requirements" },
    { label: req.requirement_number }
  ];

  return (
    <RecordPage
      breadcrumbs={breadcrumbs}
      title={req.title}
      activeTab={activeTab}
      tabs={tabs}
    >
      {activeTab === "overview" && (
        <div className="space-y-6">
          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium border-b pb-2 mb-4">Requirement Details</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <div><dt className="text-sm font-medium text-gray-500">Number</dt><dd className="mt-1 text-sm text-gray-900">{req.requirement_number}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Status</dt><dd className="mt-1 text-sm text-gray-900">{req.status}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Opportunity</dt><dd className="mt-1 text-sm text-gray-900">{req.opportunity?.name}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Customer</dt><dd className="mt-1 text-sm text-gray-900">{req.customer?.display_name}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Priority</dt><dd className="mt-1 text-sm text-gray-900">{req.priority}</dd></div>
            </dl>
          </section>

          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium border-b pb-2 mb-4">Technical Details</h3>
            <div className="space-y-4">
              <div><h4 className="text-sm font-medium text-gray-500">Business Need</h4><p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{req.business_need || '-'}</p></div>
              <div><h4 className="text-sm font-medium text-gray-500">Technical Need</h4><p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{req.technical_need || '-'}</p></div>
              <div><h4 className="text-sm font-medium text-gray-500">Scope</h4><p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{req.scope || '-'}</p></div>
            </div>
          </section>
        </div>
      )}

      {activeTab === "surveys" && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center text-gray-500 py-12">
          Surveys associated with this requirement will be listed here.
        </div>
      )}

      {activeTab === "solutions" && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center text-gray-500 py-12">
          Solutions associated with this requirement will be listed here.
        </div>
      )}
    </RecordPage>
  );
}
