"use client";

import React, { useActionState } from "react";
import { PublicHeader } from "../../components/layout/PublicHeader";
import { PublicFooter } from "../../components/layout/PublicFooter";
import { submitContactSalesAction, ContactSalesState } from "./actions";
import { CheckCircle2, Building, ShieldCheck, Mail, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function ContactSalesPage() {
  const [state, formAction, isPending] = useActionState<ContactSalesState | null, FormData>(
    submitContactSalesAction,
    null
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicHeader theme="light" />
      <main className="flex-1 py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left Column: Context & Enterprise Pillars */}
            <div className="lg:col-span-5 space-y-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                Enterprise Solutions
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Scale Your Operations with VEYRA Enterprise
              </h1>
              <p className="text-base text-slate-600 leading-relaxed">
                Connect with our product specialists to explore high-volume licensing,
                multi-entity tenant topologies, custom workflows, or enterprise SLA support.
              </p>

              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700 shrink-0">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Custom Multi-Branch Hierarchy</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Structure independent branches, divisions, and department roles with unified oversight.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-teal-100 text-teal-700 shrink-0">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Strict Data Isolation & Security</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Robust cryptographic sessions, tenant boundary enforcement, and detailed audit trails.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-200 text-slate-800 shrink-0">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Dedicated Implementation</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tailored onboarding assistance and priority support for enterprise migrations.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Form or Confirmation */}
            <div className="lg:col-span-7">
              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                {state?.success ? (
                  <div className="text-center py-8 space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">
                      Enquiry Received
                    </h2>
                    <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                      Thank you for contacting VEYRA. Your inquiry has been registered in our system.
                      Our sales team will review your requirements and reach out via your business email.
                    </p>
                    <div className="p-3 bg-slate-50 rounded-lg inline-block border border-slate-200 text-xs font-mono text-slate-700">
                      Reference ID: <span className="font-bold text-slate-900">{state.enquiryId}</span>
                    </div>
                    <div className="pt-4">
                      <Link
                        href="/"
                        className="inline-flex items-center px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-500 transition-colors"
                      >
                        Return to Home
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-1">
                      Speak with Our Sales Team
                    </h2>
                    <p className="text-xs text-slate-500 mb-6">
                      Fill out this form and a solution architect will get in touch.
                    </p>

                    <form action={formAction} className="space-y-4">
                      {state?.error && (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                          {state.error}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-1">
                            Full Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            id="name"
                            name="name"
                            required
                            disabled={isPending}
                            defaultValue={state?.fields?.name || ""}
                            placeholder="John Smith"
                            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1">
                            Work Email <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="email"
                            id="email"
                            name="email"
                            required
                            disabled={isPending}
                            defaultValue={state?.fields?.email || ""}
                            placeholder="john@company.com"
                            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="organization" className="block text-xs font-semibold text-slate-700 mb-1">
                            Organisation Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            id="organization"
                            name="organization"
                            required
                            disabled={isPending}
                            defaultValue={state?.fields?.organization || ""}
                            placeholder="Acme Global Inc"
                            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label htmlFor="phone" className="block text-xs font-semibold text-slate-700 mb-1">
                            Phone Number <span className="text-slate-400 font-normal">(optional)</span>
                          </label>
                          <input
                            type="tel"
                            id="phone"
                            name="phone"
                            disabled={isPending}
                            defaultValue={state?.fields?.phone || ""}
                            placeholder="+91 98765 43210"
                            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="userCount" className="block text-xs font-semibold text-slate-700 mb-1">
                          Estimated Team Size / Users
                        </label>
                        <select
                          id="userCount"
                          name="userCount"
                          disabled={isPending}
                          defaultValue={state?.fields?.userCount || "50-200"}
                          className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="10-50">10 – 50 users</option>
                          <option value="50-200">50 – 200 users</option>
                          <option value="200-500">200 – 500 users</option>
                          <option value="500+">500+ users (Large Enterprise)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                          Modules of Interest
                        </label>
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                          <label className="flex items-center gap-2">
                            <input type="checkbox" name="modules" value="CRM" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span>CRM & Sales Pipelines</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" name="modules" value="Projects" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span>Project Delivery</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" name="modules" value="Service" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span>Service & Tickets</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" name="modules" value="Procurement" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span>Procurement & Inventory</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" name="modules" value="RBAC" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span>Governance & RBAC</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" name="modules" value="CustomIntegrations" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span>Custom Integrations</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="message" className="block text-xs font-semibold text-slate-700 mb-1">
                          Project Context or Requirements
                        </label>
                        <textarea
                          id="message"
                          name="message"
                          rows={3}
                          disabled={isPending}
                          defaultValue={state?.fields?.message || ""}
                          placeholder="Tell us about your organization's workflow needs, timeline, or deployment requirements..."
                          className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isPending}
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        {isPending ? "Submitting Enquiry..." : "Submit Enterprise Enquiry"}
                      </button>

                      <p className="text-[11px] text-slate-400 text-center">
                        We respect your privacy. Inquiries are handled confidentially in accordance with our Privacy Policy.
                      </p>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
