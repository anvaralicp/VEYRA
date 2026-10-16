/**
 * Central Pricing and Subscription Configuration
 * Used for pricing cards, plan selection, feature matrices, and server-side validation.
 */

export type BillingCycle = "monthly" | "annually" | "perpetual";

export interface PricingPlan {
  id: "trial" | "basic" | "professional" | "enterprise";
  name: string;
  tagline: string;
  badge?: string;
  isTrial?: boolean;
  isEnterprise?: boolean;
  userAllowance: string;
  prices: {
    monthly: number | null;
    annually: number | null;
    perpetual: number | null;
  };
  displayPrices: {
    monthly: string;
    annually: string;
    perpetual: string;
  };
  effectiveMonthly?: {
    annually: string;
  };
  annualSavings?: string;
  perpetualLabel?: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  popular?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "trial",
    name: "7 Day Trial",
    tagline: "Explore all features free for 7 days.",
    badge: "Recommended",
    popular: true,
    isTrial: true,
    userAllowance: "Unlimited during trial",
    prices: {
      monthly: 0,
      annually: 0,
      perpetual: 0,
    },
    displayPrices: {
      monthly: "₹0",
      annually: "₹0",
      perpetual: "₹0",
    },
    features: [
      "Access to all available platform modules",
      "CRM, leads & sales opportunities",
      "Project & delivery tracking",
      "Service & ticket management",
      "Products, assets & inventory",
      "Vendor & procurement management",
      "Reports & analytics dashboards",
      "Organisation administration & RBAC",
      "No payment card required",
      "Upgrade anytime before expiry",
    ],
    ctaLabel: "Start Free Trial",
    ctaHref: "/register?plan=trial",
  },
  {
    id: "basic",
    name: "Basic",
    tagline: "For small teams getting started.",
    userAllowance: "Up to 10 active users",
    prices: {
      monthly: 999,
      annually: 9990,
      perpetual: 49999,
    },
    displayPrices: {
      monthly: "₹999",
      annually: "₹9,990",
      perpetual: "₹49,999",
    },
    effectiveMonthly: {
      annually: "₹833/mo",
    },
    annualSavings: "Save 16% annually",
    perpetualLabel: "Proposed — coming later",
    features: [
      "Core CRM and lead management",
      "Sales opportunity tracking",
      "Basic project management",
      "Service ticket management",
      "Product and vendor records",
      "Standard reports",
      "Email notifications where supported",
      "Basic roles and permissions",
      "Standard organisation administration",
    ],
    ctaLabel: "Choose Basic",
    ctaHref: "/register?plan=basic",
  },
  {
    id: "professional",
    name: "Professional",
    tagline: "For growing businesses.",
    badge: "Most Comprehensive",
    userAllowance: "Up to 50 active users",
    prices: {
      monthly: 2999,
      annually: 29990,
      perpetual: 149999,
    },
    displayPrices: {
      monthly: "₹2,999",
      annually: "₹29,990",
      perpetual: "₹1,49,999",
    },
    effectiveMonthly: {
      annually: "₹2,499/mo",
    },
    annualSavings: "Save 16% annually",
    perpetualLabel: "Proposed — coming later",
    features: [
      "Everything in Basic included",
      "Advanced CRM workflows & pipelines",
      "Enhanced project & delivery management",
      "Advanced service management",
      "Procurement & inventory workflows",
      "Advanced reporting and dashboards",
      "Workflow automation (planned)",
      "Expanded role and permission controls",
      "Granular organisation administration",
      "Priority support (planned)",
    ],
    ctaLabel: "Choose Professional",
    ctaHref: "/register?plan=professional",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For large organisations requiring custom scale.",
    isEnterprise: true,
    userAllowance: "Customisable capacity",
    prices: {
      monthly: null,
      annually: null,
      perpetual: null,
    },
    displayPrices: {
      monthly: "Contact Sales",
      annually: "Contact Sales",
      perpetual: "Contact Sales",
    },
    features: [
      "Custom user capacity",
      "Advanced organisation structures",
      "Multi-branch and multi-department support",
      "Advanced access and permission configuration",
      "Custom workflows, subject to technical scope",
      "Enterprise reporting & audit trails",
      "Integration options",
      "Custom onboarding and implementation",
      "Support & SLA options subject to agreement",
      "Custom commercial terms",
    ],
    ctaLabel: "Contact Sales",
    ctaHref: "/contact-sales",
  },
];

export const PRICING_DISCLAIMER =
  "Indicative development pricing only. Final subscription prices, taxes, included services and licence terms will be confirmed before commercial launch. Payment processing is currently disabled in this environment.";

export const PERPETUAL_DISCLAIMER =
  "Perpetual licence models are proposed concepts under commercial and technical evaluation and are not currently available for purchase.";

export interface FeatureComparisonRow {
  category: string;
  feature: string;
  trial: boolean | string;
  basic: boolean | string;
  professional: boolean | string;
  enterprise: boolean | string;
}

export const FEATURE_COMPARISON: FeatureComparisonRow[] = [
  // CRM & Sales
  { category: "CRM & Sales", feature: "Lead Management & Pipelines", trial: true, basic: true, professional: true, enterprise: true },
  { category: "CRM & Sales", feature: "Customer Contact Directory", trial: true, basic: true, professional: true, enterprise: true },
  { category: "CRM & Sales", feature: "Sales Opportunities Tracking", trial: true, basic: true, professional: true, enterprise: true },
  { category: "CRM & Sales", feature: "Quotation & Commercial Approvals", trial: true, basic: "Standard", professional: "Advanced", enterprise: "Customizable" },
  // Operations & Delivery
  { category: "Projects & Services", feature: "Project & Task Management", trial: true, basic: "Basic", professional: "Enhanced", enterprise: "Enterprise" },
  { category: "Projects & Services", feature: "Service Tickets & Support", trial: true, basic: true, professional: true, enterprise: true },
  { category: "Projects & Services", feature: "Activity & Interaction History", trial: true, basic: true, professional: true, enterprise: true },
  // Assets & Procurement
  { category: "Inventory & Procurement", feature: "Product & Service Catalog", trial: true, basic: true, professional: true, enterprise: true },
  { category: "Inventory & Procurement", feature: "Vendor & Supplier Profiles", trial: true, basic: true, professional: true, enterprise: true },
  { category: "Inventory & Procurement", feature: "Inventory Tracking & Adjustments", trial: true, basic: false, professional: true, enterprise: true },
  { category: "Inventory & Procurement", feature: "Purchase Order Workflows", trial: true, basic: false, professional: true, enterprise: true },
  // Governance & Security
  { category: "Administration & Security", feature: "Role-Based Access Control (RBAC)", trial: true, basic: "Standard", professional: "Granular", enterprise: "Custom Roles" },
  { category: "Administration & Security", feature: "Multi-branch / Multi-department", trial: true, basic: false, professional: false, enterprise: true },
  { category: "Administration & Security", feature: "Security & Audit Logging", trial: true, basic: "Basic", professional: "Standard", enterprise: "Comprehensive" },
  { category: "Administration & Security", feature: "Dedicated Implementation & SLA", trial: false, basic: false, professional: false, enterprise: true },
];

export function getPlanById(planId?: string | null): PricingPlan {
  if (!planId) return PRICING_PLANS[0];
  const found = PRICING_PLANS.find((p) => p.id.toLowerCase() === planId.toLowerCase());
  return found || PRICING_PLANS[0];
}
