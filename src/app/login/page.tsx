"use client";

import React, { useState, Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction } from "./actions";
import { getSafeRedirectUrl } from "../../lib/auth/redirect";
import { BrandLogo } from "../../components/ui/BrandLogo";
import {
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const rawRedirectTo = searchParams.get("redirectTo");
  const safeRedirectTo = getSafeRedirectUrl(rawRedirectTo, "/dashboard");

  const [state, formAction, isPending] = useActionState(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMsg, setForgotMsg] = useState(false);

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50" suppressHydrationWarning>
      {/* Left/Form Panel */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-16 max-w-2xl mx-auto w-full">
        <div>
          {/* Header Brand */}
          <div className="mb-10 flex items-center justify-between">
            <BrandLogo variant="full" size="md" linkToHome priority />
            <Link
              href="/"
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              ← Back to Overview
            </Link>
          </div>

          <div className="max-w-md">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome Back
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Sign in to your VEYRA account and workspace.
            </p>

            <form action={formAction} className="mt-8 space-y-4" suppressHydrationWarning>
              <input type="hidden" name="redirectTo" value={safeRedirectTo} />
              {state?.error && (
                <div
                  className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-200"
                  suppressHydrationWarning
                >
                  {state.error}
                </div>
              )}

              {forgotMsg && (
                <div className="p-3 bg-blue-50 text-blue-800 text-xs rounded-lg border border-blue-200">
                  Password reset assistance has been logged. Please contact your organization owner or system administrator to reset credentials.
                </div>
              )}

              <div suppressHydrationWarning>
                <label
                  className="block text-xs font-semibold text-slate-700 mb-1"
                  htmlFor="email"
                >
                  Email address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  autoComplete="email"
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="name@yourcompany.com"
                />
              </div>

              <div suppressHydrationWarning>
                <div className="flex items-center justify-between mb-1">
                  <label
                    className="block text-xs font-semibold text-slate-700"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setForgotMsg(!forgotMsg)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-500"
                  >
                    Forgot password?
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    required
                    autoComplete="current-password"
                    disabled={isPending}
                    className="w-full px-3.5 py-2.5 pr-10 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isPending ? "Signing in..." : "Sign In"}
              </button>

              {/* SSO Section clearly indicating future availability without misleading fake clicks */}
              <div className="pt-2">
                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-[11px] uppercase">
                    <span className="bg-slate-50 px-2 text-slate-400 font-semibold">
                      or enterprise authentication
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    disabled
                    title="Enterprise Single Sign-On (SAML/OAuth) is planned for commercial rollout"
                    className="py-2.5 px-3 border border-slate-200 rounded-xl text-slate-400 bg-white flex items-center justify-center gap-2 cursor-not-allowed text-[11px]"
                  >
                    <span>Sign in with Microsoft</span>
                    <span className="text-[9px] px-1 py-0.2 bg-slate-100 rounded text-slate-500">Soon</span>
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Enterprise Single Sign-On (Google Workspace) is planned for commercial rollout"
                    className="py-2.5 px-3 border border-slate-200 rounded-xl text-slate-400 bg-white flex items-center justify-center gap-2 cursor-not-allowed text-[11px]"
                  >
                    <span>Sign in with Google</span>
                    <span className="text-[9px] px-1 py-0.2 bg-slate-100 rounded text-slate-500">Soon</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200/80 text-center space-y-2">
                <p className="text-xs text-slate-600">
                  New to VEYRA?{" "}
                  <Link
                    href="/register?plan=trial"
                    className="font-bold text-blue-600 hover:text-blue-500 inline-flex items-center gap-1"
                  >
                    Start your 7-day free trial
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </p>
                <p className="text-xs text-slate-500">
                  Need to set up a new company workspace?{" "}
                  <Link
                    href="/register"
                    className="font-medium text-slate-700 hover:underline"
                  >
                    Register organization
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-8 text-xs text-slate-400 flex items-center justify-between">
          <span>© 2026 VEYRA SaaS</span>
          <div className="space-x-4">
            <Link href="/terms" className="hover:underline">Terms</Link>
            <Link href="/privacy" className="hover:underline">Privacy</Link>
          </div>
        </div>
      </div>

      {/* Right Brand & Value Panel (matching mockup layout) */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#07132B] via-[#091838] to-[#0A1A3A] text-white p-16 flex-col justify-between relative overflow-hidden border-l border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <BrandLogo variant="full-dark" size="lg" linkToHome priority />
        </div>

        <div className="relative z-10 max-w-lg space-y-6">
          <h2 className="text-3xl font-extrabold tracking-tight leading-tight">
            Transform the way you work
          </h2>

          <div className="space-y-3.5">
            <div className="flex items-center gap-3 text-sm text-slate-200">
              <CheckCircle2 className="h-5 w-5 text-teal-400 shrink-0" />
              <span>Manage your customers and sales pipelines with full context</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-200">
              <CheckCircle2 className="h-5 w-5 text-teal-400 shrink-0" />
              <span>Deliver client projects on time with clear accountability</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-200">
              <CheckCircle2 className="h-5 w-5 text-teal-400 shrink-0" />
              <span>Streamline service operations, ticket triaging, and issue resolution</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-200">
              <CheckCircle2 className="h-5 w-5 text-teal-400 shrink-0" />
              <span>Unify product catalogs, inventory receipts, and vendor records</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-200">
              <CheckCircle2 className="h-5 w-5 text-teal-400 shrink-0" />
              <span>Gain real-time executive visibility with unified KPI analytics</span>
            </div>
          </div>

          {/* Statement card */}
          <div className="mt-8 p-5 rounded-2xl bg-slate-800/60 border border-slate-700/80 backdrop-blur-sm">
            <p className="text-xs italic text-slate-300 leading-relaxed">
              &ldquo;VEYRA brings customer relationships, delivery, and support together so teams spend less time chasing status and more time delivering value.&rdquo;
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-teal-400">
              <ShieldCheck className="h-4 w-4" />
              <span>Enterprise-Grade Tenant Isolation & Security</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-400">
          Cryptographically signed sessions • Multi-tenant role-based governance
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
          <div className="text-sm font-semibold text-slate-600">
            Loading VEYRA sign-in...
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
