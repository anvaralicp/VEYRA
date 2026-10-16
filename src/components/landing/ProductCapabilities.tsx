import React from "react";
import {
  Users2,
  FolderGit2,
  Headphones,
  PackageCheck,
  ShoppingCart,
  BarChart3,
  Building,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface Capability {
  title: string;
  category: string;
  description: string;
  icon: React.ElementType;
  status: "Available" | "Roadmap";
  features: string[];
}

const CAPABILITIES: Capability[] = [
  {
    title: "CRM & Sales Operations",
    category: "Revenue & Growth",
    description:
      "Manage customer accounts, track presales requirements, navigate sales pipelines, and drive conversion with complete customer history.",
    icon: Users2,
    status: "Available",
    features: ["Leads & Opportunities", "Customer Directory", "Quotation Approvals", "Pipeline Funnel"],
  },
  {
    title: "Project Management",
    category: "Execution & Delivery",
    description:
      "Organize delivery milestones, assign owner roles, coordinate tasks across teams, and monitor on-time completion status.",
    icon: FolderGit2,
    status: "Available",
    features: ["Project Tracking", "Task Allocation", "Team Ownership", "Milestone Tracking"],
  },
  {
    title: "Service & Ticket Management",
    category: "Support & SLA",
    description:
      "Capture customer service issues, triage support tickets, track resolutions, and optimize incident response times.",
    icon: Headphones,
    status: "Available",
    features: ["Ticket Logging", "Status Queues", "Customer Issue History", "Resolution Tracking"],
  },
  {
    title: "Product & Asset Management",
    category: "Commercial Catalog",
    description:
      "Maintain a unified product and service catalog with categories, manufacturers, pricing rules, and multi-currency valuation.",
    icon: PackageCheck,
    status: "Available",
    features: ["Product Catalog", "Category Hierarchies", "Multi-Currency Rules", "Manufacturer Records"],
  },
  {
    title: "Procurement & Vendor Management",
    category: "Supply Chain",
    description:
      "Track supplier quotations, issue purchase orders, manage vendor relationships, and log inventory receipts seamlessly.",
    icon: ShoppingCart,
    status: "Available",
    features: ["Vendor Records", "Purchase Orders", "Goods Receipts", "Inventory Adjustments"],
  },
  {
    title: "Reports & Business Analytics",
    category: "Intelligence & KPIs",
    description:
      "Gain operational visibility with summary KPI boards, revenue progression, team workload summaries, and exportable reports.",
    icon: BarChart3,
    status: "Available",
    features: ["Executive Dashboards", "Module Summaries", "Financial Insights", "Activity Logs"],
  },
  {
    title: "Organisation Administration",
    category: "Governance & Scale",
    description:
      "Multi-tenant organisation management with support for business units, departments, branches, and tenant member invitations.",
    icon: Building,
    status: "Available",
    features: ["Tenant Isolation", "Departments & Branches", "Member Directory", "Invitation Flow"],
  },
  {
    title: "Security & Role-Based Access Control",
    category: "Enterprise Trust",
    description:
      "Enforce granular role permissions, cryptographic session cookies, strict tenant isolation, and detailed audit trail logs.",
    icon: ShieldAlert,
    status: "Available",
    features: ["Custom RBAC Roles", "JWT Session Governance", "Strict Tenant Isolation", "Audit Trail Logging"],
  },
];

export function ProductCapabilities() {
  return (
    <section id="capabilities" className="py-20 lg:py-28 bg-white text-slate-900 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200/60">
            Comprehensive Platform Scope
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-4 tracking-tight">
            Engineered for Every Dimension of Your Business
          </h2>
          <p className="text-base sm:text-lg text-slate-600 mt-3 leading-relaxed">
            Eliminate fragmented tools. VEYRA integrates CRM, project delivery, service desk, inventory, and enterprise governance into one cohesive platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.title}
                className="group relative flex flex-col justify-between p-6 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:bg-white hover:border-blue-300 hover:shadow-xl hover:shadow-blue-600/5 transition-all duration-200"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-xl bg-blue-600/10 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        cap.status === "Available"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          : "bg-amber-50 text-amber-700 border border-amber-200/60"
                      }`}
                    >
                      {cap.status}
                    </span>
                  </div>

                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    {cap.category}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1 mb-2 group-hover:text-blue-600 transition-colors">
                    {cap.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4">
                    {cap.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-200/60">
                  <ul className="space-y-1.5 mb-3">
                    {cap.features.map((feat) => (
                      <li key={feat} className="text-xs text-slate-600 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-14 text-center">
          <Link
            href="/register?plan=trial"
            className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700 group"
          >
            Experience all 8 modules during your 7-day free trial
            <ArrowRight className="ml-1.5 h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}
