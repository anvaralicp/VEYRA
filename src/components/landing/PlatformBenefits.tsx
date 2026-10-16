import React from "react";
import {
  GitMerge,
  Database,
  Lock,
  Eye,
  CreditCard,
  Server,
} from "lucide-react";

const BENEFITS = [
  {
    icon: GitMerge,
    title: "Connected Business Workflows",
    description:
      "Bridge the disconnect between sales handoffs, project milestones, support ticketing, and procurement in one uninterrupted pipeline.",
  },
  {
    icon: Database,
    title: "Centralised Organisational Data",
    description:
      "Maintain a single trusted source of truth for customer accounts, contacts, vendor directories, products, and activity histories.",
  },
  {
    icon: Lock,
    title: "Role-Based Access Governance",
    description:
      "Protect sensitive records with granular role permissions tailored to executives, sales reps, project managers, and finance officers.",
  },
  {
    icon: Eye,
    title: "Visibility Across Teams",
    description:
      "Deliver unified visibility to leadership and operational staff with real-time KPI boards, activity summaries, and status tracking.",
  },
  {
    icon: CreditCard,
    title: "Flexible Subscription Options",
    description:
      "Get started immediately on a 7-day trial with full access, then choose predictable monthly, annual, or custom enterprise terms.",
  },
  {
    icon: Server,
    title: "Scalable Multi-Tenant Architecture",
    description:
      "Architected with isolated tenant boundaries, PostgreSQL row security principles, and cryptographic session protection.",
  },
];

export function PlatformBenefits() {
  return (
    <section id="benefits" className="py-20 lg:py-24 bg-slate-900 text-white relative overflow-hidden">
      {/* Background glow accents */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-semibold uppercase tracking-wider text-teal-400 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
            Platform Advantage
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-4 tracking-tight">
            Built for Modern Operational Excellence
          </h2>
          <p className="text-base sm:text-lg text-slate-300 mt-3 leading-relaxed">
            Discover why growing organizations and enterprise teams choose VEYRA to coordinate their mission-critical business functions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {BENEFITS.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div
                key={benefit.title}
                className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/70 hover:border-blue-500/50 hover:bg-slate-800/90 transition-all duration-200"
              >
                <div className="p-3 rounded-xl bg-blue-600/20 text-blue-400 w-fit mb-4">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{benefit.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
