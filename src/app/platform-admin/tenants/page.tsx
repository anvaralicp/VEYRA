import Link from "next/link";
import { getPlatformTenants, PlatformTenantFilterOptions } from "../../../lib/platform/tenant-service";
import {
  Building2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  Shield,
} from "lucide-react";

export const instant = false;

interface TenantsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
}

export default async function PlatformTenantsPage({ searchParams }: TenantsPageProps) {
  const resolvedSearchParams = await searchParams;

  const search = typeof resolvedSearchParams?.q === "string" ? resolvedSearchParams.q : undefined;
  const status = typeof resolvedSearchParams?.status === "string" ? (resolvedSearchParams.status as PlatformTenantFilterOptions["status"]) : "all";
  const plan = typeof resolvedSearchParams?.plan === "string" ? resolvedSearchParams.plan : "all";
  const trialStatus = typeof resolvedSearchParams?.trial === "string" ? (resolvedSearchParams.trial as PlatformTenantFilterOptions["trialStatus"]) : "all";
  const page = typeof resolvedSearchParams?.page === "string" ? parseInt(resolvedSearchParams.page, 10) : 1;

  const data = await getPlatformTenants({
    search,
    status,
    plan,
    trialStatus,
    page: isNaN(page) ? 1 : page,
    pageSize: 10,
    sortBy: "created_at",
    sortOrder: "desc",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            Tenant Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse, inspect, and manage tenant organizations. Restricted strictly to administrative metadata.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Tenant Business Data Hidden & Blocked</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <form method="GET" action="/platform-admin/tenants" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              name="q"
              defaultValue={search || ""}
              placeholder="Search by tenant ID, name, email..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Account Status Filter */}
          <div>
            <select
              name="status"
              defaultValue={status}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
              <option value="pending">Pending Only</option>
            </select>
          </div>

          {/* Plan Filter */}
          <div>
            <select
              name="plan"
              defaultValue={plan}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Plans</option>
              <option value="trial">7 Day Trial</option>
              <option value="basic">Basic</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 text-xs font-medium transition-colors"
            >
              Filter
            </button>
            <Link
              href="/platform-admin/tenants"
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors text-center"
            >
              Reset
            </Link>
          </div>
        </form>
      </div>

      {/* Tenants Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {data.items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No tenants matched your query</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your search criteria or clearing filters to view all registered organizations.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Organization / Tenant</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Subscription & Trial</th>
                  <th className="py-3 px-4">Registered Members</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.items.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white text-sm">{t.name}</div>
                      <div className="font-mono text-[11px] text-slate-400 mt-0.5">{t.id}</div>
                      {t.domain && <div className="text-[11px] text-indigo-400 mt-0.5">{t.domain}</div>}
                    </td>

                    <td className="py-3.5 px-4">
                      {t.status === "ACTIVE" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          ACTIVE
                        </span>
                      ) : t.status === "SUSPENDED" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <AlertTriangle className="w-3 h-3" />
                          SUSPENDED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="w-3 h-3" />
                          PENDING
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-200 capitalize">{t.planName}</div>
                      {t.planId === "trial" && (
                        <div className="text-[11px] mt-0.5">
                          {t.isTrialExpired ? (
                            <span className="text-slate-500">Trial Expired</span>
                          ) : t.isTrialNearingExpiry ? (
                            <span className="text-amber-400 font-medium">Expires in {t.trialDaysRemaining}d</span>
                          ) : (
                            <span className="text-slate-400">{t.trialDaysRemaining} days remaining</span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono text-slate-200 text-sm">{t.memberCount}</span>
                      <span className="text-slate-500 text-[11px] ml-1">users</span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 text-[11px] font-mono">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/platform-admin/tenants/${t.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                      >
                        Inspect
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {data.pagination.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing Page <span className="font-semibold text-white">{data.pagination.page}</span> of{" "}
              <span className="font-semibold text-white">{data.pagination.totalPages}</span> (
              {data.pagination.total} total tenants)
            </div>
            <div className="flex items-center gap-2">
              {data.pagination.page > 1 && (
                <Link
                  href={`/platform-admin/tenants?page=${data.pagination.page - 1}${search ? `&q=${search}` : ""}${
                    status !== "all" ? `&status=${status}` : ""
                  }${plan !== "all" ? `&plan=${plan}` : ""}`}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
                >
                  Previous
                </Link>
              )}
              {data.pagination.page < data.pagination.totalPages && (
                <Link
                  href={`/platform-admin/tenants?page=${data.pagination.page + 1}${search ? `&q=${search}` : ""}${
                    status !== "all" ? `&status=${status}` : ""
                  }${plan !== "all" ? `&plan=${plan}` : ""}`}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
