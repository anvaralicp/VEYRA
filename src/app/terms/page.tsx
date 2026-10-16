import React from "react";
import { PublicHeader } from "../../components/layout/PublicHeader";
import { PublicFooter } from "../../components/layout/PublicFooter";
import { AlertCircle } from "lucide-react";

export const metadata = {
  title: "Terms of Service — VEYRA",
  description: "Terms of Service for VEYRA SaaS Platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicHeader theme="light" />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Review-Ready Draft Placeholder: </span>
            This Terms of Service document is an operational draft prepared for software development and staging environments.
            It requires formal review and ratification by qualified legal counsel before commercial launch.
          </div>
        </div>

        <div className="bg-white p-8 sm:p-10 rounded-2xl border border-slate-200 shadow-xs space-y-6 text-slate-800 text-sm leading-relaxed">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Terms of Service
          </h1>
          <p className="text-xs text-slate-500">
            Last Updated: October 2026 • Version 1.0 (Pre-commercial draft)
          </p>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the VEYRA SaaS platform (&ldquo;Service&rdquo;), you agree to be bound by these Terms of Service.
              If you are registering on behalf of an organization, you confirm that you have the authority to bind that entity to these Terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">2. Free Trial & Subscriptions</h2>
            <p>
              VEYRA provides a 7-day free trial granting full functional access to available platform modules without requiring payment details.
              Following the trial, continued access may require choosing a commercial subscription plan. Indicative prices shown during development
              are subject to final commercial confirmation.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">3. Multi-Tenant Isolation & Account Security</h2>
            <p>
              Users are responsible for safeguarding their login credentials. VEYRA employs cryptographic session management and tenant isolation
              to ensure data confidentiality between distinct organizations. Users must not attempt to circumvent role-based permissions or tenant boundaries.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">4. Data Ownership & Customer Content</h2>
            <p>
              The customer retains all ownership rights, title, and interest in and to all data, records, opportunities, and assets uploaded to the Service.
              VEYRA will not sell, rent, or disclose tenant data except as necessary to provide the Service or comply with applicable law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">5. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, VEYRA is provided &ldquo;as is&rdquo; without warranties of any kind, whether express or implied.
              Final warranties, service level agreements (SLAs), and dispute resolution terms will be documented in enterprise customer contracts.
            </p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
