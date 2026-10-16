import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Building2,
  Layers,
  Search,
  Bell,
  CheckCircle2,
} from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#07132B] via-[#091838] to-[#0A1A3A] text-white pt-10 pb-20 lg:pt-16 lg:pb-28 border-b border-slate-800">
      {/* Subtle decorative background light blooms */}
      <div className="absolute top-[-15%] left-[20%] w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Value Prop & CTAs */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              SaaS CRM & Service Management
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
              One Platform for a Smarter Business
            </h1>

            <p className="text-lg text-slate-300 leading-relaxed font-normal">
              Unify your customers, sales, projects and service operations in one connected platform.
              Simplify work, improve visibility and grow with VEYRA.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <Link
                href="/register?plan=trial"
                className="inline-flex items-center justify-center px-6 py-3.5 text-base font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all active:scale-[0.98]"
              >
                Start Your 7-Day Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>

              <Link
                href="#capabilities"
                className="inline-flex items-center justify-center px-6 py-3.5 text-base font-medium rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 transition-colors"
              >
                Explore Features
              </Link>
            </div>

            <div className="flex items-center gap-6 pt-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-teal-400" />
                No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-teal-400" />
                Full module access
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-teal-400" />
                Instant setup
              </span>
            </div>
          </div>

          {/* Right Column: Realistic Product Dashboard Preview Inspired by Mockup */}
          <div className="lg:col-span-7">
            <div className="relative mx-auto w-full max-w-2xl rounded-2xl bg-gradient-to-tr from-blue-600/20 via-teal-500/10 to-transparent p-1 shadow-2xl backdrop-blur-sm">
              <div className="rounded-xl bg-white text-slate-900 shadow-2xl overflow-hidden border border-slate-100">
                {/* Mockup Window Top Navigation */}
                <div className="bg-slate-900 text-slate-200 px-4 py-3 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-white tracking-wider text-sm">VEYRA</span>
                    <div className="hidden sm:flex items-center gap-2 bg-slate-800/80 px-2.5 py-1 rounded text-xs text-slate-300">
                      <Search className="h-3 w-3 text-slate-400" />
                      <span>Search CRM, tickets, projects...</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Bell className="h-4 w-4 text-slate-400" />
                    <div className="h-6 w-6 rounded-full bg-blue-600 text-[10px] font-bold text-white flex items-center justify-center">
                      JD
                    </div>
                  </div>
                </div>

                {/* Dashboard Inner Canvas */}
                <div className="p-5 bg-slate-50/80 space-y-4">
                  {/* Greeting */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Good morning</h3>
                    <p className="text-xs text-slate-500">Here is what is happening today across your organization.</p>
                  </div>

                  {/* 3 Metric Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-xs">
                      <span className="text-[11px] font-medium text-slate-500 block">Open Opportunities</span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-xl font-bold text-slate-900">24</span>
                        <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                          ↑ 12%
                        </span>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-xs">
                      <span className="text-[11px] font-medium text-slate-500 block">Active Projects</span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-xl font-bold text-slate-900">18</span>
                        <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          ↑ 8%
                        </span>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-xs">
                      <span className="text-[11px] font-medium text-slate-500 block">Open Tickets</span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-xl font-bold text-slate-900">32</span>
                        <span className="text-[11px] font-semibold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">
                          ↓ 5%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Charts Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                    {/* Revenue Trend Area Chart */}
                    <div className="sm:col-span-3 bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-800">Revenue & Pipeline Trend</span>
                        <span className="text-[10px] text-slate-400">Past 6 months</span>
                      </div>
                      <div className="h-28 w-full flex items-end">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 300 100" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#0B5FFF" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#0B5FFF" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M0,80 Q50,45 100,55 T200,30 T300,15 L300,100 L0,100 Z"
                            fill="url(#revenueGrad)"
                          />
                          <path
                            d="M0,80 Q50,45 100,55 T200,30 T300,15"
                            fill="none"
                            stroke="#0B5FFF"
                            strokeWidth="2.5"
                          />
                        </svg>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                        <span>Jan</span>
                        <span>Feb</span>
                        <span>Mar</span>
                        <span>Apr</span>
                        <span>May</span>
                        <span>Jun</span>
                      </div>
                    </div>

                    {/* Service Requests Ring */}
                    <div className="sm:col-span-2 bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-xs flex flex-col justify-between">
                      <span className="text-xs font-semibold text-slate-800">Service Requests</span>
                      <div className="flex items-center justify-center my-2">
                        <div className="relative flex items-center justify-center">
                          <svg className="w-20 h-20 transform -rotate-90">
                            <circle
                              cx="40"
                              cy="40"
                              r="30"
                              stroke="#E2E8F0"
                              strokeWidth="7"
                              fill="transparent"
                            />
                            <circle
                              cx="40"
                              cy="40"
                              r="30"
                              stroke="#0B5FFF"
                              strokeWidth="7"
                              fill="transparent"
                              strokeDasharray="188"
                              strokeDashoffset="60"
                              strokeLinecap="round"
                            />
                            <circle
                              cx="40"
                              cy="40"
                              r="30"
                              stroke="#00E5DB"
                              strokeWidth="7"
                              fill="transparent"
                              strokeDasharray="188"
                              strokeDashoffset="130"
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute text-center">
                            <span className="text-base font-bold text-slate-900">125</span>
                            <span className="block text-[8px] text-slate-500 uppercase tracking-wider">Total</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1 text-[10px] text-slate-500">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" /> New
                          </span>
                          <span className="font-semibold text-slate-700">45</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" /> In Progress
                          </span>
                          <span className="font-semibold text-slate-700">58</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Resolved
                          </span>
                          <span className="font-semibold text-slate-700">22</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom capability quick modules bar */}
                  <div className="grid grid-cols-5 gap-2 pt-1 border-t border-slate-200/60">
                    <div className="bg-slate-50 p-2 rounded text-center">
                      <span className="block text-[11px] font-semibold text-slate-800">CRM</span>
                      <span className="text-[9px] text-slate-500">Leads & deals</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded text-center">
                      <span className="block text-[11px] font-semibold text-slate-800">Projects</span>
                      <span className="text-[9px] text-slate-500">Delivery tasks</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded text-center">
                      <span className="block text-[11px] font-semibold text-slate-800">Service</span>
                      <span className="text-[9px] text-slate-500">Support tickets</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded text-center">
                      <span className="block text-[11px] font-semibold text-slate-800">Inventory</span>
                      <span className="text-[9px] text-slate-500">Products & stock</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded text-center">
                      <span className="block text-[11px] font-semibold text-slate-800">Reports</span>
                      <span className="text-[9px] text-slate-500">KPI analytics</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Core Platform Pillars (from mockup) */}
        <div className="mt-16 pt-10 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="p-2.5 rounded-lg bg-blue-600/20 text-blue-400">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">All-in-One Platform</h3>
              <p className="text-xs text-slate-400 mt-1">
                CRM, Sales, Projects, Service, Products, and Assets consolidated under one roof.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="p-2.5 rounded-lg bg-teal-500/20 text-teal-400">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Built for Growing Businesses</h3>
              <p className="text-xs text-slate-400 mt-1">
                From startup to multi-branch enterprise with scalable multi-tenant isolation.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Secure and Governed</h3>
              <p className="text-xs text-slate-400 mt-1">
                Granular role-based access control, cryptographic sessions, and full audit logs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
