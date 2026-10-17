import Link from "next/link";
import { getPlatformAuditEvents } from "../../../lib/platform/tenant-service";
import { ShieldAlert, Shield } from "lucide-react";

export const instant = false;

interface AuditPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
}

export default async function PlatformAuditPage({ searchParams }: AuditPageProps) {
  const resolvedSearchParams = await searchParams;
  const page = typeof resolvedSearchParams?.page === "string" ? parseInt(resolvedSearchParams.page, 10) : 1;

  const data = await getPlatformAuditEvents({
    page: isNaN(page) ? 1 : page,
    pageSize: 20,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            Platform Administrative Audit Log
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Immutable audit record of all platform operations, tenant lifecycle transitions, and administrator invitations.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Tenant Business Records Excluded</span>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {data.items.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No platform administrative audit events recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Target Tenant</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Details / Parameters</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {data.items.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          log.action.includes("SUSPEND")
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : log.action.includes("REACTIVATE")
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : log.action.includes("INVITE")
                            ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                            : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-300 font-sans font-medium">{log.entity}</td>

                    <td className="py-3 px-4 text-slate-400">
                      {log.tenantId ? (
                        <Link
                          href={`/platform-admin/tenants/${log.tenantId}`}
                          className="text-indigo-400 hover:text-indigo-300"
                        >
                          {log.tenantId.slice(0, 8)}...
                        </Link>
                      ) : (
                        "Global"
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-400">{log.userId ? log.userId.slice(0, 8) + "..." : "System"}</td>

                    <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                      {log.details ? (
                        <span title={JSON.stringify(log.details, null, 2)}>
                          {String(
                            log.details.reason ||
                              log.details.message ||
                              JSON.stringify(log.details)
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.pagination.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} records)
            </div>
            <div className="flex items-center gap-2">
              {data.pagination.page > 1 && (
                <Link
                  href={`/platform-admin/audit?page=${data.pagination.page - 1}`}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
                >
                  Previous
                </Link>
              )}
              {data.pagination.page < data.pagination.totalPages && (
                <Link
                  href={`/platform-admin/audit?page=${data.pagination.page + 1}`}
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
