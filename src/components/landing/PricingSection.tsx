"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Check,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  PRICING_PLANS,
  PRICING_DISCLAIMER,
  PERPETUAL_DISCLAIMER,
  FEATURE_COMPARISON,
  BillingCycle,
} from "../../config/pricing";

export interface PricingSectionProps {
  showFullComparisonByDefault?: boolean;
}

export function PricingSection({
  showFullComparisonByDefault = false,
}: PricingSectionProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [showComparison, setShowComparison] = useState(
    showFullComparisonByDefault
  );

  return (
    <section id="pricing" className="py-20 lg:py-28 bg-slate-50 text-slate-900 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-100/60 px-3 py-1 rounded-full border border-blue-200">
            Subscription Plans & Transparent Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-4 tracking-tight">
            Choose the Right Plan for Your Business
          </h2>
          <p className="text-base sm:text-lg text-slate-600 mt-3 leading-relaxed">
            Start with our full-featured 7-day free trial. No credit card required. Upgrade or transition to a paid plan when ready.
          </p>

          {/* Billing Cycle Switcher */}
          <div className="mt-8 inline-flex items-center p-1.5 rounded-xl bg-white border border-slate-300 shadow-xs">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                billingCycle === "monthly"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("annually")}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                billingCycle === "annually"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Annually</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  billingCycle === "annually"
                    ? "bg-teal-400 text-slate-950"
                    : "bg-teal-50 text-teal-700"
                }`}
              >
                Save 16%
              </span>
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("perpetual")}
              className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center gap-1 ${
                billingCycle === "perpetual"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <span>Perpetual</span>
              <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                Proposed
              </span>
            </button>
          </div>

          {billingCycle === "perpetual" && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg max-w-xl mx-auto text-xs text-amber-800">
              <span className="font-semibold">Note: </span>
              {PERPETUAL_DISCLAIMER}
            </div>
          )}
        </div>

        {/* 4 Responsive Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {PRICING_PLANS.map((plan) => {
            const isTrial = plan.isTrial;
            const isEnterprise = plan.isEnterprise;

            let priceText: string;
            let periodText: string;
            let secondaryPriceInfo: string | null = null;

            if (isTrial) {
              priceText = "₹0";
              periodText = "7 days free trial";
            } else if (isEnterprise) {
              priceText = "Contact Sales";
              periodText = "Custom terms";
            } else if (billingCycle === "monthly") {
              priceText = plan.displayPrices.monthly;
              periodText = "per month";
            } else if (billingCycle === "annually") {
              priceText = plan.displayPrices.annually;
              periodText = "per year";
              if (plan.effectiveMonthly?.annually) {
                secondaryPriceInfo = `Equivalent to ~${plan.effectiveMonthly.annually} billed annually`;
              }
            } else {
              priceText = plan.displayPrices.perpetual;
              periodText = "one-time (proposed)";
              secondaryPriceInfo = "Proposed one-time licence (not yet available)";
            }

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col justify-between rounded-2xl bg-white transition-all duration-200 ${
                  isTrial
                    ? "border-2 border-blue-600 shadow-xl shadow-blue-600/10"
                    : "border border-slate-200/90 shadow-sm hover:border-slate-300 hover:shadow-md"
                } p-6`}
              >
                {/* Popular or Recommended Badge */}
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-600 text-white shadow-xs flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                  </div>

                  <p className="text-xs text-slate-500 min-h-[32px]">{plan.tagline}</p>

                  {/* Pricing Box */}
                  <div className="my-5 pb-5 border-b border-slate-100">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                        {priceText}
                      </span>
                      {periodText && (
                        <span className="text-xs font-medium text-slate-500">
                          {periodText}
                        </span>
                      )}
                    </div>

                    {secondaryPriceInfo && (
                      <span className="block text-[11px] text-blue-600 font-medium mt-1">
                        {secondaryPriceInfo}
                      </span>
                    )}

                    <div className="mt-2 text-xs font-semibold text-slate-700 bg-slate-50 px-2.5 py-1 rounded border border-slate-200/60 inline-block">
                      {plan.userAllowance}
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <div className="space-y-2.5 mb-6">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Included Capabilities
                    </span>
                    <ul className="space-y-2">
                      {plan.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2 text-xs text-slate-600">
                          <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Card CTA */}
                <div className="pt-2">
                  <Link
                    href={plan.ctaHref}
                    className={`w-full py-2.5 px-4 text-sm font-semibold rounded-xl text-center transition-all inline-flex items-center justify-center ${
                      isTrial
                        ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 active:scale-[0.98]"
                        : isEnterprise
                        ? "bg-slate-900 hover:bg-slate-800 text-white"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300/80"
                    }`}
                  >
                    {plan.ctaLabel}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Comparison Table Toggle */}
        <div className="mt-12 text-center">
          <button
            type="button"
            onClick={() => setShowComparison(!showComparison)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/70 px-4 py-2 rounded-xl transition-colors"
          >
            {showComparison ? (
              <>
                Hide feature comparison matrix
                <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                Compare all features side-by-side
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        {/* Feature Comparison Matrix Table */}
        {showComparison && (
          <div className="mt-8 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Detailed Plan & Capability Comparison
              </h3>
              <span className="text-xs text-slate-500">
                All 4 subscription tiers
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="py-3 px-4 font-semibold text-slate-700 w-2/5">Capability</th>
                    <th className="py-3 px-4 font-semibold text-blue-600 text-center w-[15%]">7-Day Trial</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-center w-[15%]">Basic</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-center w-[15%]">Professional</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-center w-[15%]">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {FEATURE_COMPARISON.map((row) => (
                    <tr key={`${row.category}-${row.feature}`} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-slate-800">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                          {row.category}
                        </span>
                        <span className="font-medium text-slate-900">{row.feature}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {typeof row.trial === "boolean" ? (
                          row.trial ? (
                            <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )
                        ) : (
                          <span className="font-semibold text-blue-600">{row.trial}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {typeof row.basic === "boolean" ? (
                          row.basic ? (
                            <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )
                        ) : (
                          <span className="font-medium text-slate-700">{row.basic}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {typeof row.professional === "boolean" ? (
                          row.professional ? (
                            <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )
                        ) : (
                          <span className="font-medium text-slate-700">{row.professional}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {typeof row.enterprise === "boolean" ? (
                          row.enterprise ? (
                            <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )
                        ) : (
                          <span className="font-medium text-slate-700">{row.enterprise}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pricing Disclaimers (Section 6 requirement) */}
        <div className="mt-12 max-w-3xl mx-auto text-center space-y-2">
          <p className="text-xs text-slate-500 leading-relaxed">
            <span className="font-semibold">Disclaimer: </span>
            {PRICING_DISCLAIMER}
          </p>
          <p className="text-xs text-slate-400">
            Need a customised deployment, multi-entity setup or on-premise governance?{" "}
            <Link href="/contact-sales" className="text-blue-600 font-semibold hover:underline">
              Speak with our Enterprise Sales Team
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
