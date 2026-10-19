/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import Link from "next/link";
import { getPlatformSalesEnquiries } from "../../../lib/platform/sales-service";
import { updateSalesEnquiryStatusAction } from "../actions";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Search,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Calendar,
  AlertCircle,
  TrendingUp,
} from "lucide-react";

export const instant = false;

interface SalesPageProps {
  searchParams?: Promise<{
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
  }> | {
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
  };
}

export default async function PlatformSalesPage({ searchParams }: SalesPageProps) {
  const resolvedParams = searchParams ? await Promise.resolve(searchParams) : {};
  const currentStatus = resolvedParams.status || "ALL";
  const currentSearch = resolvedParams.search || "";
  const currentStartDate = resolvedParams.startDate || "";
  const currentEndDate = resolvedParams.endDate || "";
  const currentPage = parseInt(resolvedParams.page || "1", 10) || 1;

  let data;
  let errorMsg: string | null = null;

  try {
    data = await getPlatformSalesEnquiries({
      status: currentStatus,
      search: currentSearch,
      startDate: currentStartDate,
      endDate: currentEndDate,
      page: currentPage,
      pageSize: 15,
    });
  } catch (err: any) {
    errorMsg = err?.message || "Failed to retrieve platform sales enquiries.";
  }

  const statusOptions = [
    { label: "All Enquiries", value: "ALL" },
    { label: "New", value: "NEW" },
    { label: "Contacted", value: "CONTACTED" },
    { label: "Qualified", value: "QUALIFIED" },
    { label: "Closed", value: "CLOSED" },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Briefcase className="w-6 h-6 text-indigo-400" />
            Platform Sales & Customer Acquisition
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Inbound prospective customer enquiries submitted to VEYRA, qualification funnel, and tenant conversion tracking.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/platform-admin/financials"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-colors border border-slate-700"
          >
            Financial Dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {errorMsg ? (
        <div className="p-6 rounded-xl bg-red-950/40 border border-red-800/80 text-red-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-white">Sales Pipeline Unavailable</h3>
            <p className="text-xs mt-1 text-red-200">{errorMsg}</p>
          </div>
        </div>
      ) : data ? (
        <>
          {/* Funnel & Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Inbound */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Enquiries</span>
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Briefcase className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white">{data.metrics.total}</span>
                <span className="text-xs text-slate-400">prospects</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 pt-3 border-t border-slate-800/80">
                <span className="text-amber-400 font-medium">{data.metrics.newCount} new</span>
                <span>•</span>
                <span className="text-blue-400 font-medium">{data.metrics.contactedCount} contacted</span>
              </div>
            </div>

            {/* Qualified Prospects */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Qualified Leads</span>
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white">{data.metrics.qualifiedCount}</span>
                <span className="text-xs text-slate-400">high-intent</span>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-slate-400 pt-3 border-t border-slate-800/80">
                <span>Evaluated for enterprise or multi-user plan deployment</span>
              </div>
            </div>

            {/* Converted to Registered Tenants */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tenant Conversions</span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white">{data.metrics.convertedCount}</span>
                <span className="text-xs text-emerald-400 font-medium">({data.metrics.conversionRatePct}%)</span>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-slate-400 pt-3 border-t border-slate-800/80">
                <span>Matched with registered tenant organizations</span>
              </div>
            </div>

            {/* Pipeline Closed */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Closed Enquiries</span>
                <div className="p-2 rounded-lg bg-slate-800 text-slate-400 border border-slate-700">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white">{data.metrics.closedCount}</span>
                <span className="text-xs text-slate-400">completed</span>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-slate-400 pt-3 border-t border-slate-800/80">
                <span>Archived or concluded sales conversations</span>
              </div>
            </div>
          </div>

          {/* Privacy & Schema Gap Notice */}
          <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-900/50 text-xs text-indigo-300 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-white">Platform Sales Isolation & Data Model Status:</p>
              <p>
                Platform sales data originates exclusively from public inbound enquiries (<code className="font-mono text-indigo-200">SalesEnquiry</code>).
                Operator actions to update status are logged to the platform audit trail.
                Custom lead notes, sales rep assignment, and automated conversion linkage are pending schema extension approval.
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
            <form method="GET" className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Search Box */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  name="search"
                  defaultValue={currentSearch}
                  placeholder="Search by contact name, company, email or reference..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Status Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                {statusOptions.map((opt) => (
                  <Link
                    key={opt.value}
                    href={`/platform-admin/sales?status=${opt.value}${currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : ""}${currentStartDate ? `&startDate=${currentStartDate}` : ""}${currentEndDate ? `&endDate=${currentEndDate}` : ""}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      currentStatus === opt.value
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {opt.label}
                  </Link>
                ))}
              </div>

              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shrink-0"
              >
                Apply Filters
              </button>
            </form>
          </div>

          {/* Enquiries Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Inbound Sales Prospects</h2>
              <span className="text-xs text-slate-400 font-mono">
                Showing {data.enquiries.length} of {data.total} records
              </span>
            </div>

            {data.enquiries.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-3">
                <Briefcase className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-sm font-medium text-slate-400">No sales enquiries match the selected criteria.</p>
                <Link
                  href="/platform-admin/sales"
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:underline"
                >
                  Clear filters
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3.5">Reference & Date</th>
                      <th className="px-6 py-3.5">Contact & Company</th>
                      <th className="px-6 py-3.5">Team & Modules</th>
                      <th className="px-6 py-3.5">Tenant Conversion</th>
                      <th className="px-6 py-3.5">Pipeline Status</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    {data.enquiries.map((enq) => (
                      <tr key={enq.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-mono font-medium text-indigo-300">{enq.referenceNumber}</div>
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(enq.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white">{enq.contactName}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">{enq.email}</div>
                          <div className="text-xs text-slate-300 mt-1 font-medium">{enq.company}</div>
                          {enq.phone && (
                            <div className="text-[11px] text-slate-500 mt-0.5">Tel: {enq.phone}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 border border-slate-700">
                            {enq.userCount} users
                          </div>
                          {enq.modules.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5 max-w-xs">
                              {enq.modules.slice(0, 3).map((m) => (
                                <span
                                  key={m}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800/60"
                                >
                                  {m}
                                </span>
                              ))}
                              {enq.modules.length > 3 && (
                                <span className="text-[10px] text-slate-500 self-center">
                                  +{enq.modules.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                          {enq.message && (
                            <div className="text-[11px] text-slate-400 mt-1.5 italic line-clamp-1" title={enq.message}>
                              &ldquo;{enq.message}&rdquo;
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {enq.matchedTenant ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                Converted to Tenant
                              </span>
                              <div>
                                <Link
                                  href={`/platform-admin/tenants/${enq.matchedTenant.id}`}
                                  className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline font-medium"
                                >
                                  {enq.matchedTenant.name}
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] text-slate-500 bg-slate-800/60 border border-slate-700/60">
                              Pending Conversion
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                              enq.status === "NEW"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : enq.status === "CONTACTED"
                                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                : enq.status === "QUALIFIED"
                                ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            {enq.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {/* Status Management Form */}
                          <form action={updateSalesEnquiryStatusAction} className="inline-flex items-center gap-2">
                            <input type="hidden" name="enquiryId" value={enq.id} />
                            <select
                              name="status"
                              defaultValue={enq.status}
                              className="bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                            >
                              <option value="NEW">Set NEW</option>
                              <option value="CONTACTED">Set CONTACTED</option>
                              <option value="QUALIFIED">Set QUALIFIED</option>
                              <option value="CLOSED">Set CLOSED</option>
                            </select>
                            <button
                              type="submit"
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
                            >
                              Update
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {data.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Page {data.page} of {data.totalPages}
                </span>
                <div className="flex items-center gap-2">
                  {data.page > 1 && (
                    <Link
                      href={`/platform-admin/sales?page=${data.page - 1}${currentStatus !== "ALL" ? `&status=${currentStatus}` : ""}${currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : ""}`}
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
                    >
                      Previous
                    </Link>
                  )}
                  {data.page < data.totalPages && (
                    <Link
                      href={`/platform-admin/sales?page=${data.page + 1}${currentStatus !== "ALL" ? `&status=${currentStatus}` : ""}${currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : ""}`}
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
                    >
                      Next
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
