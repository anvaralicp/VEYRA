import React from "react";
import Link from "next/link";
import { BrandLogo } from "../../components/ui/BrandLogo";
import { requireTenantContext } from "../../lib/auth/boundary";
import { db } from "../../prisma/db";
import { getModel } from "../../lib/db/legacy-adapter";
import { CheckCircle2, ArrowRight, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Welcome to VEYRA — 7-Day Free Trial Activated",
  description: "Your VEYRA organization and 7-day free trial are ready.",
};

export const instant = false;

export default async function WelcomePage() {
  const context = await requireTenantContext();
  const Tenant = getModel(db, "Tenant");
  const tenant = Tenant
    ? await Tenant.findUnique({ where: { id: context.tenantId } })
    : null;

  const organizationName = tenant?.name || "Your Organisation";
  const planName = "7 Day Trial";

  // Calculate authoritative trial dates directly from database record in UTC
  const trialStart = tenant?.created_at ? new Date(tenant.created_at) : new Date();
  const expiryDate = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const formattedExpiry = expiryDate.toLocaleDateString("en-US", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto w-full">
        {/* Top Brand Logo */}
        <div className="text-center mb-8">
          <BrandLogo variant="full" size="md" className="mx-auto" priority />
        </div>

        {/* Welcome Card Inspired by Mockup Screen 3 */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-blue-600/5 p-8 sm:p-10 text-center relative overflow-hidden">
          {/* Subtle Confetti-like ambient gradient dots */}
          <div className="absolute top-4 left-6 w-2 h-2 rounded-full bg-blue-500 opacity-60 animate-ping" />
          <div className="absolute top-8 right-12 w-2 h-2 rounded-full bg-teal-400 opacity-60 animate-pulse" />
          <div className="absolute top-14 left-16 w-2.5 h-2.5 rounded-full bg-amber-400 opacity-70" />
          <div className="absolute top-10 right-24 w-1.5 h-1.5 rounded-full bg-purple-500 opacity-50" />

          {/* Big Green Success Checkmark */}
          <div className="mx-auto w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-100 text-emerald-600 flex items-center justify-center mb-5 shadow-sm">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome to VEYRA!
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            Your 7-day free trial has been activated for{" "}
            <strong className="text-slate-800">{organizationName}</strong>.
          </p>

          {/* Details Table Card matching Mockup */}
          <div className="mt-8 bg-slate-50 rounded-2xl border border-slate-200/80 p-5 text-left text-xs divide-y divide-slate-200/70">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500 font-medium">Organisation</span>
              <span className="font-bold text-slate-900">{organizationName}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500 font-medium">Plan</span>
              <span className="font-bold text-blue-600">{planName}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500 font-medium">Access</span>
              <span className="font-semibold text-slate-800">All Modules Unlocked</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500 font-medium">Valid Until</span>
              <span className="font-semibold text-slate-900">{formattedExpiry}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500 font-medium">Users</span>
              <span className="font-semibold text-slate-800">Unlimited during trial</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500 font-medium">Payment</span>
              <span className="font-semibold text-emerald-700">No credit card required</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-6 leading-relaxed">
            You can invite teammates, explore CRM, manage projects, and test ticket workflows immediately.
            You can upgrade to a paid subscription plan anytime from Settings.
          </p>

          {/* Action Buttons */}
          <div className="mt-8 space-y-3">
            <Link
              href="/dashboard"
              className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2"
            >
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/dashboard"
              className="w-full py-2.5 px-6 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors inline-block"
            >
              Explore Platform Features
            </Link>
          </div>
        </div>

        {/* Security badge note */}
        <div className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-slate-400" />
          <span>Tenant boundary securely established and cryptographically isolated.</span>
        </div>
      </div>
    </div>
  );
}
