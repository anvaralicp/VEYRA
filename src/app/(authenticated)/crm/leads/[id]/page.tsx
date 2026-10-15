/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { getLeadById } from "../../../../../lib/crm/lead-service";
import { notFound } from "next/navigation";
import { getTenantContext } from "../../../../../lib/tenant/context";
import { getTenantDb } from "../../../../../lib/db/tenant-db";
import { checkPermissionForUI } from "../../../../../lib/auth/boundary";
import { ConvertLeadModal } from "./convert-modal";
import Link from "next/link";
import { CheckCircle2, TrendingUp, ShieldAlert } from "lucide-react";

export const instant = false;

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ tab?: string; convert?: string }> | { tab?: string; convert?: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const lead = await getLeadById(resolvedParams.id);
  if (!lead) notFound();

  const activeTab = resolvedSearchParams?.tab || "overview";
  const isConvertRequested = resolvedSearchParams?.convert === "true";

  const tabs = [
    { id: "overview", label: "Overview", href: "?tab=overview" },
    { id: "conversion", label: "Conversion", href: "?tab=conversion" }
  ];

  const breadcrumbs = [
    { label: "CRM", href: "/crm/leads" },
    { label: "Leads", href: "/crm/leads" },
    { label: lead.lead_number }
  ];

  // Check user conversion permission
  const canConvert = await checkPermissionForUI("lead.convert");

  // Fetch tenant customer options if lead is eligible for conversion
  let customers: any[] = [];
  if (lead.status !== "CONVERTED") {
    try {
      const context = await getTenantContext();
      const tdb: any = await getTenantDb();
      const CustomerModel = tdb.Customer || tdb.customer;
      if (CustomerModel && typeof CustomerModel.findMany === "function") {
        customers = await CustomerModel.findMany({
          where: { tenant_id: context.tenantId, deleted_at: null },
          select: { id: true, display_name: true, legal_name: true },
          orderBy: { display_name: "asc" }
        });
      }
    } catch {
      customers = [];
    }
  }

  const isEligible = lead.status !== "CONVERTED";

  const statusBadge = (
    <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
      lead.status === "CONVERTED" ? "bg-green-100 text-green-800" :
      lead.status === "LOST" ? "bg-red-100 text-red-800" :
      lead.status === "QUALIFIED" ? "bg-blue-100 text-blue-800" :
      "bg-gray-100 text-gray-800"
    }`}>
      {lead.status}
    </span>
  );

  // Clearly visible header action for eligible leads
  const actions = isEligible && canConvert ? (
    <ConvertLeadModal
      lead={lead}
      customers={customers}
      canConvert={canConvert}
      defaultOpen={isConvertRequested}
    />
  ) : null;

  return (
    <RecordPage
      breadcrumbs={breadcrumbs}
      title={lead.company_name}
      recordNumber={lead.lead_number}
      status={statusBadge}
      actions={actions}
      activeTab={activeTab}
      tabs={tabs}
    >
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Conversion Notification Banner if Already Converted */}
          {lead.status === "CONVERTED" && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-green-900">Lead Converted</h4>
                  <p className="text-xs text-green-700 mt-0.5">
                    This lead was converted into an active Opportunity on{" "}
                    <strong>
                      {lead.converted_at ? new Date(lead.converted_at).toLocaleDateString() : "Unknown date"}
                    </strong>
                    .
                  </p>
                </div>
              </div>
              <Link
                href="/crm/opportunities"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-800 text-xs font-medium rounded-md transition-colors"
              >
                View Opportunities &rarr;
              </Link>
            </div>
          )}

          {/* Quick Convert Prompt for Eligible Leads */}
          {isEligible && canConvert && (
            <div className="bg-blue-50/70 border border-blue-200/80 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-blue-900">Opportunity Conversion Ready</h4>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Progress this lead to sales by converting it to an Opportunity and linked Customer account.
                  </p>
                </div>
              </div>
              <ConvertLeadModal
                lead={lead}
                customers={customers}
                canConvert={canConvert}
                buttonText="Convert to Opportunity"
                buttonVariant="primary"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium border-b pb-2 mb-4">Lead Details</h3>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <div><dt className="text-sm font-medium text-gray-500">Number</dt><dd className="mt-1 text-sm text-gray-900">{lead.lead_number}</dd></div>
                <div><dt className="text-sm font-medium text-gray-500">Status</dt><dd className="mt-1 text-sm text-gray-900">{statusBadge}</dd></div>
                <div><dt className="text-sm font-medium text-gray-500">Company</dt><dd className="mt-1 text-sm text-gray-900">{lead.company_name}</dd></div>
                <div><dt className="text-sm font-medium text-gray-500">Contact</dt><dd className="mt-1 text-sm text-gray-900">{lead.contact_name}</dd></div>
                <div><dt className="text-sm font-medium text-gray-500">Email</dt><dd className="mt-1 text-sm text-gray-900">{lead.email || '-'}</dd></div>
                <div><dt className="text-sm font-medium text-gray-500">Phone</dt><dd className="mt-1 text-sm text-gray-900">{lead.phone || '-'}</dd></div>
                <div><dt className="text-sm font-medium text-gray-500">Source</dt><dd className="mt-1 text-sm text-gray-900">{lead.source || '-'}</dd></div>
                <div><dt className="text-sm font-medium text-gray-500">Industry</dt><dd className="mt-1 text-sm text-gray-900">{lead.industry || '-'}</dd></div>
              </dl>
            </section>

            <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium border-b pb-2 mb-4">Business</h3>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <div><dt className="text-sm font-medium text-gray-500">Value</dt><dd className="mt-1 text-sm text-gray-900">{lead.estimated_value ? `${lead.currency || 'USD'} ${lead.estimated_value.toLocaleString()}` : '-'}</dd></div>
                <div><dt className="text-sm font-medium text-gray-500">Close Date</dt><dd className="mt-1 text-sm text-gray-900">{lead.expected_close_date ? new Date(lead.expected_close_date).toLocaleDateString() : '-'}</dd></div>
                <div className="sm:col-span-2"><dt className="text-sm font-medium text-gray-500">Requirement</dt><dd className="mt-1 text-sm text-gray-900">{lead.requirement || '-'}</dd></div>
                <div className="sm:col-span-2"><dt className="text-sm font-medium text-gray-500">Notes</dt><dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{lead.notes || '-'}</dd></div>
              </dl>
            </section>
          </div>
        </div>
      )}

      {activeTab === "conversion" && (
        <div className="max-w-2xl">
          {lead.status === "CONVERTED" ? (
            <div className="bg-green-50 text-green-800 p-6 rounded-lg border border-green-200 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-green-900">Lead Already Converted</h4>
              </div>
              <p className="text-sm text-green-700">
                This lead was converted into an Opportunity on{" "}
                <strong>
                  {lead.converted_at ? new Date(lead.converted_at).toLocaleDateString() : "Unknown date"}
                </strong>
                .
              </p>
              <div className="pt-2">
                <Link
                  href="/crm/opportunities"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium text-sm rounded-md transition-colors shadow-xs"
                >
                  Go to Opportunities &rarr;
                </Link>
              </div>
            </div>
          ) : !canConvert ? (
            <div className="bg-amber-50 text-amber-800 p-6 rounded-lg border border-amber-200 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-900">Permission Required</h4>
                <p className="text-sm text-amber-700 mt-1">
                  You do not have the <code>lead.convert</code> permission required to convert leads into opportunities. Contact your organization administrator to request access.
                </p>
              </div>
            </div>
          ) : (
            <ConvertLeadModal
              inline
              lead={lead}
              customers={customers}
              canConvert={canConvert}
            />
          )}
        </div>
      )}
    </RecordPage>
  );
}
