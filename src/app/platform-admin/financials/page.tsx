/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import Link from "next/link";
import { getPlatformFinancialMetrics } from "../../../lib/platform/financial-service";
import {
  DollarSign,
  TrendingUp,
  Layers,
  Clock,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  CreditCard,
  Receipt,
  Scale,
} from "lucide-react";

export const instant = false;

export default async function PlatformFinancialsPage() {
  let data;
  let errorMsg: string | null = null;

  try {
    data = await getPlatformFinancialMetrics();
  } catch (err: any) {
    errorMsg = err?.message || "Failed to retrieve platform financial metrics.";
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <DollarSign className="w-6 h-6 text-emerald-400" />
            Financial Dashboard & Subscription Analytics
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Persisted tenant plan assignments, projected recurring revenue run rates, and payment integration readiness.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/platform-admin/sales"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-colors border border-slate-700"
          >
            Sales Pipeline
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {errorMsg ? (
        <div className="p-6 rounded-xl bg-red-950/40 border border-red-800/80 text-red-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-white">Financial Telemetry Unavailable</h3>
            <p className="text-xs mt-1 text-red-200">{errorMsg}</p>
          </div>
        </div>
      ) : data ? (
        <>
          {/* Key Metrics Grid: Actual vs Projected */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Projected MRR */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Projected MRR</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  PROJECTED
                </span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white">{data.projected.displayMrr}</span>
                <span className="text-xs text-slate-400">/month</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 pt-3 border-t border-slate-800/80">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Active plan allocations rate</span>
              </div>
            </div>

            {/* Projected ARR */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Projected ARR</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  PROJECTED
                </span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white">{data.projected.displayArr}</span>
                <span className="text-xs text-slate-400">annual run rate</span>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-slate-400 pt-3 border-t border-slate-800/80">
                <span>Annualized projected run rate (MRR × 12)</span>
              </div>
            </div>

            {/* Paid Organizations */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Paid Subscriptions</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ACTUAL
                </span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white">{data.actual.paidTenants}</span>
                <span className="text-xs text-slate-400">tenants</span>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-emerald-400 pt-3 border-t border-slate-800/80">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Basic, Professional & Enterprise</span>
              </div>
            </div>

            {/* Trial Evaluations */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Trials</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ACTUAL
                </span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white">{data.actual.trialTenants}</span>
                <span className="text-xs text-slate-400">in 7-day evaluation</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 pt-3 border-t border-slate-800/80">
                <span className="text-amber-400 font-medium">{data.trialAging.nearingExpiry} expiring soon</span>
                <span>•</span>
                <span className="text-slate-500">{data.trialAging.expired} expired</span>
              </div>
            </div>
          </div>

          {/* Pending Payment Integration Banner */}
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-900/50 text-xs text-amber-200 flex items-start gap-3">
            <CreditCard className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-white">Payment Gateway & Financial Ledger Status:</p>
              <p>
                Live card processing and direct bank payment integrations (e.g. Stripe, Razorpay) are not currently configured.
                The revenue figures displayed above represent <strong>calculated projections</strong> based on authoritative plan rates (<code className="font-mono text-amber-300">PRICING_PLANS</code>).
                Actual bank collections, settled disbursements, and receivables remain marked as <strong>Pending Payment Integration</strong> below.
              </p>
            </div>
          </div>

          {/* Two-Column Grid: Plan Distribution & Pending Integrations */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Plan Distribution Breakdown Table */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden space-y-4">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  Subscription Plan Breakdown
                </h2>
                <span className="text-xs text-slate-400 font-mono">
                  Total Tenants: {data.actual.totalTenants}
                </span>
              </div>

              <div className="overflow-x-auto px-6 pb-6">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-3">Plan Name</th>
                      <th className="py-3 px-3">Tenants</th>
                      <th className="py-3 px-3">Share</th>
                      <th className="py-3 px-3">Unit Price</th>
                      <th className="py-3 px-3 text-right">Projected Monthly</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {data.planBreakdown.map((plan) => (
                      <tr key={plan.planId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-white">{plan.planName}</div>
                          <div className="text-[10px] text-slate-500 font-mono uppercase">{plan.planId}</div>
                        </td>
                        <td className="py-3.5 px-3 font-mono font-medium">
                          {plan.count}
                          {plan.activeCount < plan.count ? (
                            <span className="text-[10px] text-amber-400 font-sans ml-1.5 font-normal">
                              ({plan.activeCount} active)
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-400">{plan.sharePct}%</span>
                            <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-indigo-500"
                                style={{ width: `${plan.sharePct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-slate-300">{plan.displayPrice}</td>
                        <td className="py-3.5 px-3 text-right font-mono font-semibold text-white">
                          {plan.isCustomQuote ? (
                            <span className="text-xs text-purple-400 font-sans font-medium">Bespoke Quote</span>
                          ) : (
                            `₹${plan.projectedMonthlyRevenue.toLocaleString("en-IN")}`
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-800 bg-slate-950/40 text-xs font-semibold">
                    <tr>
                      <td colSpan={4} className="py-3 px-3 text-slate-400 text-right">Total Projected MRR:</td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-400 text-sm">
                        {data.projected.displayMrr}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Trial Aging Funnel */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Trial Aging Funnel
                </h2>
                <span className="text-xs text-slate-500">7-Day Window</span>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-200">Fresh Trials (4–7 Days)</div>
                    <div className="text-[11px] text-slate-400">Recently registered organizations</div>
                  </div>
                  <span className="text-lg font-bold font-mono text-white">{data.trialAging.freshTrials}</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-200">Mid-Cycle (3–4 Days)</div>
                    <div className="text-[11px] text-slate-400">Optimal conversion engagement</div>
                  </div>
                  <span className="text-lg font-bold font-mono text-blue-400">{data.trialAging.midTrials}</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Nearing Expiry (1–2 Days)
                    </div>
                    <div className="text-[11px] text-slate-400">Urgent upgrade touchpoint</div>
                  </div>
                  <span className="text-lg font-bold font-mono text-amber-400">{data.trialAging.nearingExpiry}</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-400">Expired Evaluations</div>
                    <div className="text-[11px] text-slate-500">Awaiting plan upgrade or archive</div>
                  </div>
                  <span className="text-lg font-bold font-mono text-slate-500">{data.trialAging.expired}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Financial Metrics & Accounting Readiness */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-purple-400" />
                Accounting & Live Financial Telemetry Status
              </h2>
              <span className="text-xs text-slate-400">Audit Compliance</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.pendingMetrics.map((metric) => (
                <div key={metric.key} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">{metric.label}</span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-medium border ${
                        metric.status === "PENDING_INTEGRATION"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {metric.status === "PENDING_INTEGRATION" ? "PENDING GATEWAY" : "UNAVAILABLE"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{metric.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Transparency & Methodology Card */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-3">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Scale className="w-4 h-4 text-indigo-400" />
              Calculation Methodology & Truth in Telemetry
            </div>
            <div className="space-y-1.5 leading-relaxed">
              <p>
                <strong>Method: </strong>
                {data.metadata.calculationMethod}
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-400">
                {data.metadata.assumptions.map((assump, idx) => (
                  <li key={idx}>{assump}</li>
                ))}
              </ul>
              <p className="pt-1">
                <strong>Missing Data Handling: </strong>
                {data.metadata.missingDataTreatment}
              </p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
