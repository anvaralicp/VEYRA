
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { getSiteSurveyById } from "../../../../../lib/presales/site-survey-service";
import { notFound } from "next/navigation";

export const instant = false;

export default async function SiteSurveyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const sur = await getSiteSurveyById(resolvedParams.id);
  if (!sur) notFound();

  const activeTab = resolvedSearchParams?.tab || "overview";
  const tabs = [
    { id: "overview", label: "Overview", href: "?tab=overview" },
    { id: "site-info", label: "Site Information", href: "?tab=site-info" },
    { id: "existing-env", label: "Existing Environment", href: "?tab=existing-env" },
    { id: "requirements", label: "Requirements", href: "?tab=requirements" },
    { id: "constraints", label: "Constraints", href: "?tab=constraints" },
    { id: "observations", label: "Observations", href: "?tab=observations" },
    { id: "recommendations", label: "Recommendations", href: "?tab=recommendations" },
  ];

  const breadcrumbs = [
    { label: "Presales", href: "/presales/site-surveys" },
    { label: "Site Surveys", href: "/presales/site-surveys" },
    { label: sur.survey_number }
  ];

  return (
    <RecordPage
      breadcrumbs={breadcrumbs}
      title={sur.survey_number}
      activeTab={activeTab}
      tabs={tabs}
    >
      {activeTab === "overview" && (
        <div className="space-y-6">
          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium border-b pb-2 mb-4">Survey Details</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <div><dt className="text-sm font-medium text-gray-500">Number</dt><dd className="mt-1 text-sm text-gray-900">{sur.survey_number}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Status</dt><dd className="mt-1 text-sm text-gray-900">{sur.status}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Opportunity</dt><dd className="mt-1 text-sm text-gray-900">{sur.opportunity?.name}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Customer</dt><dd className="mt-1 text-sm text-gray-900">{sur.customer?.display_name}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Site</dt><dd className="mt-1 text-sm text-gray-900">{sur.site?.name}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Survey Date</dt><dd className="mt-1 text-sm text-gray-900">{sur.survey_date ? new Date(sur.survey_date).toLocaleDateString() : '-'}</dd></div>
            </dl>
          </section>

          <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium border-b pb-2 mb-4">Summary</h3>
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{sur.summary || '-'}</p>
          </section>
        </div>
      )}

      {activeTab === "existing-env" && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium border-b pb-2 mb-4">Existing Environment</h3>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{sur.existing_environment || '-'}</p>
        </div>
      )}

      {activeTab === "requirements" && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium border-b pb-2 mb-4">Requirements</h3>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{sur.requirements || '-'}</p>
        </div>
      )}

      {activeTab === "constraints" && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium border-b pb-2 mb-4">Constraints</h3>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{sur.constraints || '-'}</p>
        </div>
      )}

      {activeTab === "observations" && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium border-b pb-2 mb-4">Observations</h3>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{sur.observations || '-'}</p>
        </div>
      )}

      {activeTab === "recommendations" && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium border-b pb-2 mb-4">Recommendations</h3>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{sur.recommendations || '-'}</p>
        </div>
      )}
    </RecordPage>
  );
}
