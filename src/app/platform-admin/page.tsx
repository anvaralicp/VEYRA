import Link from "next/link";
import { getPlatformOverviewMetrics } from "../../lib/platform/tenant-service";
import {
  Building2,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Activity,
  Layers,
} from "lucide-react";

export const instant = false;

export default async function PlatformAdminDashboard() {
  const metrics = await getPlatformOverviewMetrics();

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Platform Overview</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time persisted platform metadata, tenant lifecycle indicators, and operational telemetry.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/platform-admin/tenants"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors shadow-sm"
          >
            Tenant Directory
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tenants */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Tenants</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{metrics.totalTenants}</span>
            <span className="text-xs text-slate-400">organizations</span>
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-400 pt-3 border-t border-slate-800/80">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {metrics.activeTenants} active
            </span>
            {metrics.suspendedTenants > 0 && (
              <span className="flex items-center gap-1 text-rose-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                {metrics.suspendedTenants} suspended
              </span>
            )}
            {metrics.pendingTenants > 0 && (
              <span className="flex items-center gap-1 text-amber-400 font-medium">
                {metrics.pendingTenants} pending
              </span>
            )}
          </div>
        </div>

        {/* Aggregate Registered Users */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Platform Users</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{metrics.totalRegisteredUsers}</span>
            <span className="text-xs text-slate-400">identities</span>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs text-slate-400 pt-3 border-t border-slate-800/80">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Aggregate scalar count; zero business profile exposure</span>
          </div>
        </div>

        {/* Trial Accounts */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Trials</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{metrics.trialAccounts}</span>
            <span className="text-xs text-slate-400">trial evaluations</span>
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-400 pt-3 border-t border-slate-800/80">
            <span className="flex items-center gap-1 text-amber-400 font-medium">
              {metrics.trialsNearingExpiry} expiring soon
            </span>
            {metrics.trialsExpired > 0 && (
              <span className="flex items-center gap-1 text-slate-500">
                {metrics.trialsExpired} expired
              </span>
            )}
          </div>
        </div>

        {/* Onboarding Health */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Onboarding Rate</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {metrics.totalTenants > 0
                ? `${Math.round((metrics.onboardingCompleted / metrics.totalTenants) * 100)}%`
                : "100%"}
            </span>
            <span className="text-xs text-slate-400">completed</span>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs text-emerald-400 pt-3 border-t border-slate-800/80">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{metrics.onboardingCompleted} bootstrapped successfully</span>
          </div>
        </div>
      </div>

      {/* Plan Distribution & Security Boundary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan Distribution */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Subscription Distribution
            </h2>
            <span className="text-xs text-slate-500">Configured Plans</span>
          </div>
          <div className="space-y-3">
            {Object.entries(metrics.planDistribution).map(([planId, count]) => {
              const total = metrics.totalTenants || 1;
              const pct = Math.round((count / total) * 100);
              const planName = planId.charAt(0).toUpperCase() + planId.slice(1);
              return (
                <div key={planId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium capitalize">{planName}</span>
                    <span className="text-slate-400 font-mono">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        planId === "trial"
                          ? "bg-amber-500"
                          : planId === "professional"
                          ? "bg-indigo-500"
                          : planId === "enterprise"
                          ? "bg-purple-500"
                          : "bg-blue-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Privacy & Operator Guardrails */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Privacy-First Platform Governance
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ENFORCED
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Zero Tenant Business Access
              </div>
              <p className="text-slate-400 leading-relaxed">
                Platform operators cannot view or query tenant customers, contacts, quotations, BOQs, support
                tickets, or business documents.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                No Impersonation or Backdoors
              </div>
              <p className="text-slate-400 leading-relaxed">
                Platform administrators are never injected into tenant memberships and cannot bypass application
                authorization filters.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Server-Side Suspension
              </div>
              <p className="text-slate-400 leading-relaxed">
                Suspension blocks active sessions, API requests, and logins at the database layer immediately.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Hashed Administrator Invitations
              </div>
              <p className="text-slate-400 leading-relaxed">
                Tenant administrator invitations use SHA-256 hashed single-use tokens; plaintext tokens are never
                stored in the database.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Platform Administrative Events */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              Recent Platform Administrative Events
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Persisted audit trail for tenant lifecycle, subscription activation, and administrative operations.
            </p>
          </div>
          <Link
            href="/platform-admin/audit"
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1"
          >
            View all audit records
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {metrics.recentEvents.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No platform administrative events recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {metrics.recentEvents.map((evt) => (
              <div key={evt.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 text-[11px] font-mono rounded font-semibold ${
                      evt.action.includes("SUSPEND")
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : evt.action.includes("REACTIVATE")
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : evt.action.includes("INVITE")
                        ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                        : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                    }`}
                  >
                    {evt.action}
                  </span>
                  <div className="text-xs">
                    <span className="text-slate-300 font-medium">{evt.entity}</span>
                    <span className="text-slate-500 mx-2">•</span>
                    <span className="font-mono text-slate-400">Tenant: {evt.tenantId ? evt.tenantId.slice(0, 8) + "..." : "Global"}</span>
                    {typeof evt.details?.reason === "string" && (
                      <span className="text-slate-400 ml-2 italic">&ldquo;{evt.details.reason}&rdquo;</span>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {new Date(evt.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
