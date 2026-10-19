import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlatformTenantDetails } from "../../../../lib/platform/tenant-service";
import {
  suspendTenantAction,
  reactivateTenantAction,
  inviteTenantAdminAction,
  revokeTenantAdminInvitationAction,
  updateTenantRestrictionAction,
  updateTenantPlanAction,
  extendTenantTrialAction,
} from "../../actions";
import {
  Building2,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Mail,
  UserCheck,
  Ban,
  RotateCcw,
  Trash2,
  Calendar,
  Layers,
  Lock,
  Unlock,
  CreditCard,
  FileText,
  ShieldAlert,
} from "lucide-react";

export const instant = false;

interface TenantDetailPageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default async function PlatformTenantDetailPage({ params }: TenantDetailPageProps) {
  const resolvedParams = await params;
  const tenantId = resolvedParams.id;

  const tenant = await getPlatformTenantDetails(tenantId);
  if (!tenant) {
    notFound();
  }

  return (
    <div className="space-y-8">
      {/* Back and Page Header */}
      <div>
        <Link
          href="/platform-admin/tenants"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Tenant Directory
        </Link>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">{tenant.name}</h1>
              {tenant.status === "ACTIVE" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  ACTIVE
                </span>
              ) : tenant.status === "SUSPENDED" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  SUSPENDED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Clock className="w-3.5 h-3.5" />
                  PENDING
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2 font-mono">
              <span>ID: {tenant.id}</span>
              <span>•</span>
              <span>Registered: {new Date(tenant.createdAt).toLocaleDateString()}</span>
              {tenant.domain && (
                <>
                  <span>•</span>
                  <span className="text-indigo-400">{tenant.domain}</span>
                </>
              )}
            </div>
          </div>

          {/* Top Consequential Action Controls */}
          <div className="flex items-center gap-3">
            {tenant.status === "ACTIVE" ? (
              <form action={suspendTenantAction}>
                <input type="hidden" name="tenantId" value={tenant.id} />
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    name="reason"
                    placeholder="Suspension reason..."
                    required
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-700/60 font-medium text-xs transition-colors"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Suspend Tenant
                  </button>
                </div>
              </form>
            ) : (
              <form action={reactivateTenantAction}>
                <input type="hidden" name="tenantId" value={tenant.id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 font-medium text-xs transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reactivate Tenant Account
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Grid of Metadata Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Organization & Subscription Metadata */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Information Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Building2 className="w-4 h-4 text-blue-400" />
              Organization Account Metadata
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Display Name</span>
                <span className="text-slate-200 font-medium text-sm mt-0.5 block">{tenant.name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Legal Entity Name</span>
                <span className="text-slate-200 font-medium mt-0.5 block">{tenant.legalName || "Not provided"}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Registration Number</span>
                <span className="text-slate-200 font-mono mt-0.5 block">{tenant.registrationNumber || "Not recorded"}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Custom Domain</span>
                <span className="text-indigo-400 font-mono mt-0.5 block">{tenant.domain || "Standard domain"}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Timezone</span>
                <span className="text-slate-200 font-mono mt-0.5 block">{tenant.timezone}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Base Currency</span>
                <span className="text-slate-200 font-mono mt-0.5 block">{tenant.currency}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Registered Members</span>
                <span className="text-slate-200 font-mono mt-0.5 block">{tenant.memberCount} users</span>
              </div>
            </div>
          </div>

          {/* Operational Restriction Governance Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Restriction Governance
              </h2>
              <span className="text-[11px] text-slate-500 font-mono">Independent Operational Holds</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Fine-grained operational controls to restrict specific tenant capabilities without completely suspending the organization.
              All restriction changes require an explicit audit justification and are logged with transactional proof.
            </p>

            <div className="space-y-3 pt-1">
              {/* Security Isolation Restriction */}
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-rose-400" />
                      Security Isolation
                    </span>
                    {tenant.restrictions.is_security_restricted ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        RESTRICTED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        CLEAR
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Immediately locks tenant access across CRM, API keys, and background workers during suspected credential leaks or anomalies.
                  </div>
                </div>
                <form action={updateTenantRestrictionAction} className="flex items-center gap-2 shrink-0">
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <input type="hidden" name="restrictionType" value="security" />
                  <input type="hidden" name="enable" value={tenant.restrictions.is_security_restricted ? "false" : "true"} />
                  <input
                    type="text"
                    name="reason"
                    placeholder="Mandatory justification..."
                    required
                    className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 w-44"
                  />
                  <button
                    type="submit"
                    className={`px-3 py-1 rounded font-medium text-xs transition-colors inline-flex items-center gap-1 ${
                      tenant.restrictions.is_security_restricted
                        ? "bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60"
                        : "bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-700/60"
                    }`}
                  >
                    {tenant.restrictions.is_security_restricted ? (
                      <>
                        <Unlock className="w-3 h-3" />
                        Release
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3" />
                        Apply Hold
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Billing Delinquency Restriction */}
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                      Billing Delinquency
                    </span>
                    {tenant.restrictions.is_billing_restricted ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        RESTRICTED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        CLEAR
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Blocks CRM write actions, quotations, and exports due to overdue invoices while allowing tenant billing contact login.
                  </div>
                </div>
                <form action={updateTenantRestrictionAction} className="flex items-center gap-2 shrink-0">
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <input type="hidden" name="restrictionType" value="billing" />
                  <input type="hidden" name="enable" value={tenant.restrictions.is_billing_restricted ? "false" : "true"} />
                  <input
                    type="text"
                    name="reason"
                    placeholder="Mandatory justification..."
                    required
                    className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 w-44"
                  />
                  <button
                    type="submit"
                    className={`px-3 py-1 rounded font-medium text-xs transition-colors inline-flex items-center gap-1 ${
                      tenant.restrictions.is_billing_restricted
                        ? "bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60"
                        : "bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-700/60"
                    }`}
                  >
                    {tenant.restrictions.is_billing_restricted ? (
                      <>
                        <Unlock className="w-3 h-3" />
                        Release
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3" />
                        Apply Hold
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Policy Enforcement Restriction */}
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      Policy Violation Hold
                    </span>
                    {tenant.restrictions.is_policy_restricted ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        RESTRICTED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        CLEAR
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Restricts external sharing, email broadcast, and customer data exports pending terms of service investigation.
                  </div>
                </div>
                <form action={updateTenantRestrictionAction} className="flex items-center gap-2 shrink-0">
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <input type="hidden" name="restrictionType" value="policy" />
                  <input type="hidden" name="enable" value={tenant.restrictions.is_policy_restricted ? "false" : "true"} />
                  <input
                    type="text"
                    name="reason"
                    placeholder="Mandatory justification..."
                    required
                    className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 w-44"
                  />
                  <button
                    type="submit"
                    className={`px-3 py-1 rounded font-medium text-xs transition-colors inline-flex items-center gap-1 ${
                      tenant.restrictions.is_policy_restricted
                        ? "bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60"
                        : "bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-700/60"
                    }`}
                  >
                    {tenant.restrictions.is_policy_restricted ? (
                      <>
                        <Unlock className="w-3 h-3" />
                        Release
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3" />
                        Apply Hold
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Administrative Lock Restriction */}
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-purple-400" />
                      Administrative Freeze
                    </span>
                    {tenant.restrictions.is_administrative_restricted ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        RESTRICTED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        CLEAR
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Freezes administrative role changes, plan modifications, and organization configuration during ownership transfers.
                  </div>
                </div>
                <form action={updateTenantRestrictionAction} className="flex items-center gap-2 shrink-0">
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <input type="hidden" name="restrictionType" value="administrative" />
                  <input type="hidden" name="enable" value={tenant.restrictions.is_administrative_restricted ? "false" : "true"} />
                  <input
                    type="text"
                    name="reason"
                    placeholder="Mandatory justification..."
                    required
                    className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 w-44"
                  />
                  <button
                    type="submit"
                    className={`px-3 py-1 rounded font-medium text-xs transition-colors inline-flex items-center gap-1 ${
                      tenant.restrictions.is_administrative_restricted
                        ? "bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60"
                        : "bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-700/60"
                    }`}
                  >
                    {tenant.restrictions.is_administrative_restricted ? (
                      <>
                        <Unlock className="w-3 h-3" />
                        Release
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3" />
                        Apply Hold
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Subscription & Plan Governance Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Subscription & Plan Governance
              </h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 capitalize">
                Current: {tenant.planName}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Subscription Tier</span>
                <span className="text-white font-semibold text-sm mt-0.5 block capitalize">{tenant.planName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Account Lifecycle Status</span>
                <div className="mt-1">
                  {tenant.status === "ACTIVE" ? (
                    <span className="text-emerald-400 font-medium">Active & Accessible</span>
                  ) : (
                    <span className="text-rose-400 font-medium">Suspended (Access blocked)</span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-slate-500 block">Trial Start Date</span>
                <span className="text-slate-300 font-mono mt-0.5 block">
                  {tenant.trialStartDate ? new Date(tenant.trialStartDate).toLocaleString() : "N/A"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Trial Expiration Date</span>
                <span className="text-slate-300 font-mono mt-0.5 block">
                  {tenant.trialEndDate ? new Date(tenant.trialEndDate).toLocaleString() : "N/A"}
                </span>
              </div>
            </div>

            {tenant.planId === "trial" && (
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Trial Period Status:</span>
                {tenant.isTrialExpired ? (
                  <span className="font-semibold text-rose-400">Evaluation Window Expired</span>
                ) : tenant.isTrialNearingExpiry ? (
                  <span className="font-semibold text-amber-400">
                    Nearing Expiry ({tenant.trialDaysRemaining} days remaining)
                  </span>
                ) : (
                  <span className="font-semibold text-emerald-400">
                    Active ({tenant.trialDaysRemaining} days remaining)
                  </span>
                )}
              </div>
            )}

            {/* Plan Override Form */}
            <form action={updateTenantPlanAction} className="bg-slate-950/60 border border-slate-800 rounded-lg p-3.5 space-y-3">
              <div className="text-xs font-medium text-slate-300">Administrative Plan Override</div>
              <input type="hidden" name="tenantId" value={tenant.id} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Target Plan</label>
                  <select
                    name="planId"
                    defaultValue={tenant.planId}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 capitalize"
                  >
                    <option value="trial">Trial (7 Day Standard)</option>
                    <option value="basic">Basic ($49/mo)</option>
                    <option value="professional">Professional ($199/mo)</option>
                    <option value="enterprise">Enterprise ($499/mo)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Mandatory Justification</label>
                  <input
                    type="text"
                    name="reason"
                    placeholder="E.g. Sales team manual plan upgrade approval"
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <span className="text-[11px] text-slate-500">
                  Plan overrides update platform financial and subscription telemetry immediately. Overrides do not charge credit cards.
                </span>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors shrink-0"
                >
                  Update Plan
                </button>
              </div>
            </form>

            {/* Trial Extension Controls */}
            {tenant.planId === "trial" && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3.5 space-y-3">
                <div className="text-xs font-medium text-slate-300">Extend Trial Evaluation Window</div>
                <p className="text-[11px] text-slate-400">
                  Extends evaluation period from current expiration (or from today if expired).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[7, 14, 30].map((days) => (
                    <form key={days} action={extendTenantTrialAction} className="space-y-2">
                      <input type="hidden" name="tenantId" value={tenant.id} />
                      <input type="hidden" name="days" value={days} />
                      <input
                        type="text"
                        name="reason"
                        placeholder={`Reason for +${days}d...`}
                        required
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="submit"
                        className="w-full px-2.5 py-1.5 rounded bg-slate-800 hover:bg-indigo-600/30 hover:border-indigo-500/40 text-slate-200 border border-slate-700/60 text-xs font-medium transition-colors"
                      >
                        +{days} Days
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Administrator Invitations Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-purple-400" />
                Administrator Invitations & Onboarding
              </h2>
              <span className="text-xs text-slate-500">Single-use Cryptographic Tokens</span>
            </div>

            {/* Issue Invitation Form */}
            <form action={inviteTenantAdminAction} className="bg-slate-950/60 border border-slate-800 rounded-lg p-3.5 space-y-3">
              <div className="text-xs font-medium text-slate-300">Invite New / Additional Tenant Administrator</div>
              <input type="hidden" name="tenantId" value={tenant.id} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <input
                    type="email"
                    name="email"
                    placeholder="administrator@tenant-domain.com"
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <select
                    name="role"
                    className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="ADMIN">ADMIN (Least-Privilege)</option>
                    <option value="OWNER">OWNER (Full Ownership)</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <div className="space-y-0.5">
                  <span className="text-[11px] text-slate-500 block">
                    Generates an expiring single-use token hashed with SHA-256 at rest. Zero plaintext exposure.
                  </span>
                  <span className="text-[11px] text-amber-400/90 font-medium block">
                    Email delivery is not configured. Creating an invitation generates the token record, but no email is dispatched.
                  </span>
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors shrink-0"
                >
                  Generate Invitation Record
                </button>
              </div>
            </form>

            {/* List of existing invitations */}
            {tenant.invitations.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">
                No active or historical administrator invitations recorded for this tenant.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {tenant.invitations.map((inv) => (
                  <div key={inv.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-medium text-slate-200">{inv.email}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Role: {inv.role} • Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          inv.status === "ACCEPTED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : inv.status === "EXPIRED"
                            ? "bg-slate-800 text-slate-500"
                            : inv.status === "REVOKED"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {inv.status}
                      </span>
                      {inv.status === "PENDING" && (
                        <form action={revokeTenantAdminInvitationAction}>
                          <input type="hidden" name="invitationId" value={inv.id} />
                          <input type="hidden" name="tenantId" value={tenant.id} />
                          <button
                            type="submit"
                            className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                            title="Revoke invitation"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Administrators & Privacy Guard Notice */}
        <div className="space-y-6">
          {/* Active Administrators Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              Tenant Administrators
            </h2>

            {tenant.administrators.length === 0 ? (
              <div className="text-xs text-slate-500">
                No active administrators found. Account may be in initial invitation status.
              </div>
            ) : (
              <div className="space-y-3">
                {tenant.administrators.map((admin) => (
                  <div key={admin.userId} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{admin.name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {admin.role}
                      </span>
                    </div>
                    <div className="text-slate-400 font-mono text-[11px]">{admin.email}</div>
                    <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                      Joined: {new Date(admin.joinedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mandatory Privacy Notice Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Privacy Assurance
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              VEYRA enforces mandatory tenant data confidentiality. Platform administration staff have zero
              visibility into this organization&apos;s:
            </p>
            <ul className="text-xs text-slate-400 space-y-1 list-disc pl-4">
              <li>Customers, leads & CRM contacts</li>
              <li>Quotations, pricing & project pipelines</li>
              <li>Products, inventory & supplier pricing</li>
              <li>Service tickets & client communications</li>
            </ul>
          </div>

          {/* Audit History for this Tenant */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Calendar className="w-4 h-4 text-amber-400" />
              Tenant Administrative Audit Log
            </h2>

            {tenant.recentAuditEvents.length === 0 ? (
              <div className="text-xs text-slate-500">No administrative events recorded.</div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {tenant.recentAuditEvents.map((evt) => (
                  <div key={evt.id} className="text-xs pb-2 border-b border-slate-800/60 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-300 font-mono text-[11px]">{evt.action}</span>
                      <span className="text-[10px] text-slate-500">{new Date(evt.createdAt).toLocaleDateString()}</span>
                    </div>
                    {typeof evt.details?.reason === "string" && (
                      <div className="text-slate-400 text-[11px] italic mt-0.5">&ldquo;{evt.details.reason}&rdquo;</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
