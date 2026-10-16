import React from "react";
import { PublicHeader } from "../../components/layout/PublicHeader";
import { PublicFooter } from "../../components/layout/PublicFooter";
import { AlertCircle } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — VEYRA",
  description: "Privacy Policy for VEYRA SaaS Platform.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicHeader theme="light" />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Review-Ready Draft Placeholder: </span>
            This Privacy Policy is an operational draft prepared for software development and staging environments.
            It requires formal review and compliance certification (e.g. GDPR, local data protection laws) prior to production deployment.
          </div>
        </div>

        <div className="bg-white p-8 sm:p-10 rounded-2xl border border-slate-200 shadow-xs space-y-6 text-slate-800 text-sm leading-relaxed">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-xs text-slate-500">
            Last Updated: October 2026 • Version 1.0 (Pre-commercial draft)
          </p>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">1. Information We Collect</h2>
            <p>
              When registering an account or contacting sales, we collect contact information such as your name, business email address,
              organization name, and phone number. We store authentication tokens and encrypted password hashes necessary to manage secure sessions.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">2. How We Use Information</h2>
            <p>
              Information is used exclusively to provide, maintain, and support your organization’s workspace in VEYRA.
              We do not share, monetize, or sell customer contact information or business data to external marketing vendors.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">3. Multi-Tenant Data Protection</h2>
            <p>
              Tenant datasets are strictly partitioned. Data uploaded by your organization is accessible only to users authorized by your
              organization administrators via role-based access controls.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">4. Cookies and Sessions</h2>
            <p>
              VEYRA uses HTTP-only, secure cookies for session authentication and active tenant context. We do not use third-party tracking cookies
              for advertising purposes within the authenticated platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">5. Contact and Inquiries</h2>
            <p>
              For questions concerning data privacy or to request data removal upon trial completion, please contact our administrative team via
              the Contact Sales channel.
            </p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
