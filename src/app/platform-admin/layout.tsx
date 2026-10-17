import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "../../lib/auth/session";
import { isPlatformAdmin } from "../../lib/auth/platform";
import { BrandLogo } from "../../components/ui/BrandLogo";
import {
  LayoutDashboard,
  Building2,
  MailCheck,
  ShieldAlert,
  LogOut,
  Shield,
  Lock,
} from "lucide-react";

export const metadata = {
  title: "Platform Administration | VEYRA",
  description: "Privacy-first platform operations and tenant lifecycle management",
};

export default async function PlatformAdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirectTo=/platform-admin");
  }

  const authorized = await isPlatformAdmin(session);

  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-red-900/40 border border-red-500/40 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Access Restricted</h1>
          <p className="text-sm text-slate-400 mb-6">
            Your account (<span className="text-slate-200 font-mono">{session.email}</span>) does not have
            Platform Administrator privileges.
          </p>
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 mb-6 text-xs text-slate-400 text-left space-y-2">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <Shield className="w-4 h-4 text-indigo-400" />
              Privacy-First Platform Isolation
            </div>
            <p>
              Platform administration is strictly separated from tenant workspaces. Ordinary tenant users and
              tenant owners cannot access the platform control plane.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors"
            >
              Return to Application
            </Link>
            <form action="/login/actions" method="POST">
              <button
                type="submit"
                formAction={async () => {
                  "use server";
                  const { logoutAction } = await import("../login/actions");
                  await logoutAction();
                }}
                className="w-full inline-flex items-center justify-center px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* Top Banner: Privacy Protection Notice */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-b border-indigo-900/40 px-4 py-2 text-xs flex flex-wrap items-center justify-between text-indigo-300 gap-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-white">Privacy-First Architecture:</span>
          <span>Zero access to tenant-owned business data (CRM records, quotes, documents, tickets).</span>
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <span>Operator: <span className="font-mono text-slate-200">{session.email}</span></span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            AUDITED
          </span>
        </div>
      </div>

      {/* Main Header / Navigation */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <BrandLogo variant="full-dark" size="sm" linkToHome={false} />
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 tracking-wide uppercase">
                Platform Admin
              </span>
            </div>

            <nav className="hidden md:flex items-center space-x-1">
              <Link
                href="/platform-admin"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <LayoutDashboard className="w-4 h-4 text-indigo-400" />
                Overview
              </Link>
              <Link
                href="/platform-admin/tenants"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <Building2 className="w-4 h-4 text-blue-400" />
                Tenants
              </Link>
              <Link
                href="/platform-admin/invitations"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <MailCheck className="w-4 h-4 text-purple-400" />
                Admin Invites
              </Link>
              <Link
                href="/platform-admin/audit"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Platform Audit
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <form action="/login/actions" method="POST">
              <button
                type="submit"
                formAction={async () => {
                  "use server";
                  const { logoutAction } = await import("../login/actions");
                  await logoutAction();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-red-300 hover:bg-red-950/30 border border-slate-800 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>VEYRA Platform Administration Console • Phase 1 Operational Governance • Privacy Architecture Active</p>
      </footer>
    </div>
  );
}
