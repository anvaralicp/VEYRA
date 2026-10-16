import React from "react";
import { PublicHeader } from "../../components/layout/PublicHeader";
import { PricingSection } from "../../components/landing/PricingSection";
import { PublicFooter } from "../../components/layout/PublicFooter";
import Link from "next/link";


export const metadata = {
  title: "Subscription Plans & Pricing — VEYRA",
  description:
    "Explore transparent subscription tiers for VEYRA CRM and Service Management. Start your 7-day free trial today.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicHeader theme="light" />
      <main className="flex-1">
        {/* Pricing Header Banner */}
        <div className="bg-gradient-to-b from-slate-900 to-[#0A1A3A] text-white py-14 text-center px-4">
          <div className="max-w-4xl mx-auto">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-400 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
              Transparent & Scalable Plans
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white mt-4 tracking-tight">
              Invest in Operational Clarity
            </h1>
            <p className="text-base sm:text-lg text-slate-300 mt-3 max-w-2xl mx-auto">
              Choose the tier that matches your organization’s operational scale.
              Every plan starts with an unrestricted 7-day trial.
            </p>
          </div>
        </div>

        {/* Pricing Section with Full Comparison */}
        <PricingSection showFullComparisonByDefault={true} />

        {/* FAQ Section */}
        <section className="py-16 bg-white border-t border-slate-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-slate-900">
                Frequently Asked Questions
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Everything you need to know about our trial, billing, and plans.
              </p>
            </div>

            <div className="space-y-6">
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">
                  What is included in the 7-day free trial?
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                  The trial provides full access to all available modules: CRM, sales opportunities,
                  project delivery, service ticketing, inventory, procurement, and role-based administration.
                  There are no artificial feature or user restrictions during the 7 days.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">
                  Do I need to enter credit card details to start the trial?
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                  No credit card or payment information is required. You can register your organization
                  and immediately start using VEYRA in under a minute.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">
                  What happens when the 7-day trial concludes?
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                  Your tenant data remains completely safe and preserved. You will be prompted to select
                  a subscription plan once commercial billing is active. We never delete tenant records
                  without explicit customer notice.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">
                  Can we request a customized enterprise contract or on-premise deployment?
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                  Yes. Our Enterprise tier offers custom user capacity, multi-department or multi-branch
                  support, tailored onboarding, and dedicated commercial terms. Contact our sales team to discuss.
                </p>
              </div>
            </div>

            {/* Enterprise Banner */}
            <div className="mt-12 p-8 rounded-2xl bg-gradient-to-r from-blue-900 to-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md">
              <div>
                <h3 className="text-lg font-bold">Have unique enterprise requirements?</h3>
                <p className="text-xs text-slate-300 mt-1 max-w-md">
                  Discuss custom volume licenses, dedicated implementation, or advanced multi-entity hierarchies.
                </p>
              </div>
              <Link
                href="/contact-sales"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-sm transition-colors shrink-0"
              >
                Contact Enterprise Sales
              </Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
