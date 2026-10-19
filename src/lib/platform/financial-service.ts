/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "../../prisma/db";
import { getModel } from "../db/legacy-adapter";
import { requirePlatformPermission } from "../auth/platform";
import { PRICING_PLANS } from "../../config/pricing";
import { getTenantSubscriptionMeta, isTenantSuspended } from "./tenant-service";

export interface PlanFinancialSummary {
  planId: string;
  planName: string;
  count: number;
  activeCount: number;
  sharePct: number;
  monthlyUnitPrice: number | null;
  displayPrice: string;
  projectedMonthlyRevenue: number;
  isCustomQuote: boolean;
}

export interface TrialAgingSummary {
  freshTrials: number; // 4-7 days remaining
  midTrials: number; // 3-4 days remaining
  nearingExpiry: number; // 1-2 days remaining
  expired: number; // <= 0 days remaining
}

export interface UnavailableMetric {
  key: string;
  label: string;
  status: "PENDING_INTEGRATION" | "UNAVAILABLE";
  reason: string;
}

export interface PlatformFinancialMetrics {
  actual: {
    totalTenants: number;
    activeTenants: number;
    suspendedTenants: number;
    paidTenants: number;
    activePaidTenants: number;
    trialTenants: number;
  };
  projected: {
    mrr: number; // Monthly Recurring Revenue
    arr: number; // Annual Run Rate (MRR * 12)
    currency: string;
    displayMrr: string;
    displayArr: string;
  };
  planBreakdown: PlanFinancialSummary[];
  trialAging: TrialAgingSummary;
  pendingMetrics: UnavailableMetric[];
  metadata: {
    calculatedAt: string;
    calculationMethod: string;
    assumptions: string[];
    missingDataTreatment: string;
  };
}

/**
 * Computes platform financial KPIs and subscription distribution without fabricating data.
 * Clearly separates actual database counts, calculated projected run rates,
 * and pending billing integration indicators.
 * Fail-closed: Requires platform.financials.view authorization.
 */
export async function getPlatformFinancialMetrics(client: any = db): Promise<PlatformFinancialMetrics> {
  await requirePlatformPermission("platform.financials.view");

  const TenantModel = getModel(client, "Tenant");
  if (!TenantModel || typeof TenantModel.findMany !== "function") {
    throw new Error("SERVICE_UNAVAILABLE: Tenant storage service is unavailable");
  }

  let tenants: any[] = [];
  try {
    tenants = await TenantModel.findMany({
      select: {
        id: true,
        name: true,
        created_at: true,
      },
    });
  } catch (err: any) {
    throw new Error(`SERVICE_UNAVAILABLE: Failed to query tenants for financial metrics: ${err?.message || "Storage error"}`);
  }

  if (!Array.isArray(tenants)) {
    throw new Error("SERVICE_UNAVAILABLE: Invalid tenant response from storage");
  }

  const totalTenants = tenants.length;
  let activeTenants = 0;
  let suspendedTenants = 0;

  // Plan counting maps: total inventory vs active (non-suspended)
  const totalPlanCounts: Record<string, number> = {
    trial: 0,
    basic: 0,
    professional: 0,
    enterprise: 0,
  };

  const activePlanCounts: Record<string, number> = {
    trial: 0,
    basic: 0,
    professional: 0,
    enterprise: 0,
  };

  const trialAging: TrialAgingSummary = {
    freshTrials: 0,
    midTrials: 0,
    nearingExpiry: 0,
    expired: 0,
  };

  // Inspect subscription meta and lifecycle state for each tenant
  for (const t of tenants) {
    let suspended = false;
    try {
      suspended = await isTenantSuspended(t.id, client);
    } catch {
      // Conservative handling: if lifecycle check fails, do not assume active
      suspended = true;
    }

    if (suspended) {
      suspendedTenants++;
    } else {
      activeTenants++;
    }

    let subMeta;
    try {
      subMeta = await getTenantSubscriptionMeta(t.id, t.created_at, client);
    } catch {
      subMeta = {
        status: "UNAVAILABLE" as const,
        planId: "unavailable",
        planName: "Subscription Unavailable",
        isTrialExpired: false,
        isTrialNearingExpiry: false,
        trialDaysRemaining: 0,
      };
    }

    const rawPlanId = subMeta.planId || "trial";
    const isValidPlan = Object.prototype.hasOwnProperty.call(totalPlanCounts, rawPlanId);
    // If metadata is invalid, missing or unavailable, default conservatively to trial (billed at ₹0)
    const planId = isValidPlan ? rawPlanId : "trial";

    // Track total plan inventory
    totalPlanCounts[planId]++;

    // Only active (non-suspended) tenants contribute to active counts and revenue run rates
    if (!suspended) {
      activePlanCounts[planId]++;
    }

    // Tally trial aging only for valid available trial evaluations
    if (planId === "trial" && subMeta.status === "AVAILABLE") {
      const days = typeof subMeta.trialDaysRemaining === "number" ? subMeta.trialDaysRemaining : 0;
      if (subMeta.isTrialExpired || days <= 0) {
        trialAging.expired++;
      } else if (days <= 2) {
        trialAging.nearingExpiry++;
      } else if (days <= 4) {
        trialAging.midTrials++;
      } else {
        trialAging.freshTrials++;
      }
    }
  }

  const paidTenants = totalPlanCounts.basic + totalPlanCounts.professional + totalPlanCounts.enterprise;
  const activePaidTenants = activePlanCounts.basic + activePlanCounts.professional + activePlanCounts.enterprise;
  const trialTenants = totalPlanCounts.trial;

  // Compute projected MRR strictly from active (non-suspended) tenants using PRICING_PLANS
  let totalProjectedMrr = 0;
  const planBreakdown: PlanFinancialSummary[] = [];

  for (const plan of PRICING_PLANS) {
    const totalCount = totalPlanCounts[plan.id] || 0;
    const activeCount = activePlanCounts[plan.id] || 0;
    const sharePct = totalTenants > 0 ? Math.round((totalCount / totalTenants) * 100) : 0;
    const monthlyPrice = plan.prices.monthly;
    const isCustom = plan.isEnterprise === true || monthlyPrice === null;
    // Suspended tenants are strictly excluded from projected revenue
    const projectedRevenue = !isCustom && typeof monthlyPrice === "number" ? activeCount * monthlyPrice : 0;

    totalProjectedMrr += projectedRevenue;

    planBreakdown.push({
      planId: plan.id,
      planName: plan.name,
      count: totalCount,
      activeCount,
      sharePct,
      monthlyUnitPrice: monthlyPrice,
      displayPrice: plan.displayPrices.monthly,
      projectedMonthlyRevenue: projectedRevenue,
      isCustomQuote: isCustom,
    });
  }

  const projectedArr = totalProjectedMrr * 12;

  const pendingMetrics: UnavailableMetric[] = [
    {
      key: "collections",
      label: "Actual Collections",
      status: "PENDING_INTEGRATION",
      reason: "Live payment gateway (Stripe/Razorpay) is pending configuration. Real bank disbursements and settled card transactions are not currently captured in the database.",
    },
    {
      key: "outstandingReceivables",
      label: "Outstanding Receivables",
      status: "PENDING_INTEGRATION",
      reason: "Automated dunning and invoicing schedules require the billing integration module to be connected.",
    },
    {
      key: "recognizedRevenue",
      label: "Recognized GAAP/IFRS Revenue",
      status: "PENDING_INTEGRATION",
      reason: "Accrual and revenue recognition schedules require immutable transaction ledger entries.",
    },
    {
      key: "netChurnRate",
      label: "Net Churn Rate",
      status: "UNAVAILABLE",
      reason: "Historical subscription cancellation timestamps will be computed once multi-period subscription renewals are activated.",
    },
    {
      key: "customerAcquisitionCost",
      label: "Customer Acquisition Cost (CAC)",
      status: "UNAVAILABLE",
      reason: "Marketing expenditure and ad campaign telemetry are not integrated with platform administration.",
    },
  ];

  return {
    actual: {
      totalTenants,
      activeTenants,
      suspendedTenants,
      paidTenants,
      activePaidTenants,
      trialTenants,
    },
    projected: {
      mrr: totalProjectedMrr,
      arr: projectedArr,
      currency: "INR",
      displayMrr: `₹${totalProjectedMrr.toLocaleString("en-IN")}`,
      displayArr: `₹${projectedArr.toLocaleString("en-IN")}`,
    },
    planBreakdown,
    trialAging,
    pendingMetrics,
    metadata: {
      calculatedAt: new Date().toISOString(),
      calculationMethod: "Projected MRR = Σ (Active, non-suspended Tenants on Paid Plan × Monthly Plan Rate from PRICING_PLANS).",
      assumptions: [
        "Monthly billing cycle assumption for standard self-serve tiers (Basic: ₹999/mo, Professional: ₹2,999/mo).",
        "Enterprise plans are bespoke contracts and excluded from standard run rate calculation until bespoke contract values are assigned.",
        "Trial accounts are billed at ₹0 during their 7-day evaluation window.",
        "Suspended tenants are strictly excluded from projected MRR and ARR calculations regardless of assigned plan.",
      ],
      missingDataTreatment: "Tenants without explicit subscription audit events default to standard 7-day trial evaluation as defined in Phase 1 security specifications. Malformed or unavailable records are assigned ₹0 and excluded from revenue projection.",
    },
  };
}
