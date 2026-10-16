"use client";

import React, { useState, Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { registerAction, RegisterFormState } from "./actions";
import { BrandLogo } from "../../components/ui/BrandLogo";
import {
  PRICING_PLANS,
  getPlanById,
  BillingCycle,
} from "../../config/pricing";
import {
  Check,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Building,
} from "lucide-react";

function RegisterContent() {
  const searchParams = useSearchParams();
  const initialPlanId = searchParams.get("plan") || "trial";

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(initialPlanId);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  // Form field state to preserve across steps
  const [formData, setFormData] = useState({
    organizationName: "",
    name: "",
    email: "",
    phone: "",
    country: "India",
    password: "",
    agreeTerms: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const [serverState, formAction, isPending] = useActionState<RegisterFormState | null, FormData>(
    registerAction,
    null
  );

  const selectedPlan = getPlanById(selectedPlanId);

  const validateStep2 = () => {
    const errors: Record<string, string> = {};
    if (!formData.organizationName.trim() || formData.organizationName.trim().length < 2) {
      errors.organizationName = "Organisation name must be at least 2 characters.";
    }
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errors.name = "Your full name is required.";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      errors.email = "Please enter a valid work email address.";
    }
    if (!formData.password || formData.password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }
    if (!formData.agreeTerms) {
      errors.agreeTerms = "You must accept the Terms of Service and Privacy Policy.";
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextToStep2 = () => {
    setCurrentStep(2);
  };

  const handleNextToStep3 = () => {
    if (validateStep2()) {
      setCurrentStep(3);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8" suppressHydrationWarning>
      <div className="max-w-4xl mx-auto w-full">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-200">
          <BrandLogo variant="full" size="md" linkToHome priority />
          <div className="text-xs text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-500">
              Sign In
            </Link>
          </div>
        </div>

        {/* Stepper Progress Indicator */}
        <div className="py-8">
          <div className="flex items-center justify-center space-x-3 sm:space-x-8 text-xs sm:text-sm font-semibold">
            {/* Step 1 */}
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className={`flex items-center gap-2 cursor-pointer ${
                currentStep === 1
                  ? "text-blue-600"
                  : currentStep > 1
                  ? "text-emerald-600"
                  : "text-slate-400"
              }`}
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  currentStep === 1
                    ? "bg-blue-600 text-white"
                    : currentStep > 1
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {currentStep > 1 ? "✓" : "1"}
              </span>
              <span>Select Plan</span>
            </button>

            <span className="h-0.5 w-6 sm:w-12 bg-slate-200" />

            {/* Step 2 */}
            <button
              type="button"
              onClick={() => {
                if (currentStep > 2 || validateStep2()) setCurrentStep(2);
              }}
              className={`flex items-center gap-2 ${
                currentStep === 2
                  ? "text-blue-600"
                  : currentStep > 2
                  ? "text-emerald-600"
                  : "text-slate-400"
              }`}
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  currentStep === 2
                    ? "bg-blue-600 text-white"
                    : currentStep > 2
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {currentStep > 2 ? "✓" : "2"}
              </span>
              <span>Your Details</span>
            </button>

            <span className="h-0.5 w-6 sm:w-12 bg-slate-200" />

            {/* Step 3 */}
            <div
              className={`flex items-center gap-2 ${
                currentStep === 3 ? "text-blue-600" : "text-slate-400"
              }`}
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  currentStep === 3
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                3
              </span>
              <span>Confirm & Start</span>
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {serverState?.error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm">
            {serverState.error}
          </div>
        )}

        {/* Form Container */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10">
          {/* STEP 1: Plan Selection */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center max-w-xl mx-auto">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  Choose the right plan for your business
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Start with a 7-day free trial. No credit card required.
                </p>

                {/* Billing Cycle Switcher */}
                <div className="mt-5 inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setBillingCycle("monthly")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      billingCycle === "monthly"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle("annually")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                      billingCycle === "annually"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>Annually</span>
                    <span className="text-[9px] bg-teal-100 text-teal-800 px-1 py-0.2 rounded font-bold">
                      Save 16%
                    </span>
                  </button>
                </div>
              </div>

              {/* 4 Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                {PRICING_PLANS.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  const isTrial = plan.isTrial;
                  const isEnterprise = plan.isEnterprise;

                  let displayPrice = plan.displayPrices.monthly;
                  let period = "/mo";
                  if (isTrial) {
                    displayPrice = "₹0";
                    period = "7 days";
                  } else if (isEnterprise) {
                    displayPrice = "Contact Sales";
                    period = "";
                  } else if (billingCycle === "annually") {
                    displayPrice = plan.displayPrices.annually;
                    period = "/yr";
                  }

                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`relative flex flex-col justify-between p-5 rounded-2xl cursor-pointer transition-all ${
                        isSelected
                          ? "border-2 border-blue-600 bg-blue-50/20 shadow-md ring-2 ring-blue-600/10"
                          : "border border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      {plan.badge && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded-full">
                          {plan.badge}
                        </span>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-bold text-slate-900 text-base">{plan.name}</h3>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && <span className="text-[10px]">✓</span>}
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 min-h-[28px]">{plan.tagline}</p>

                        <div className="my-3 pb-3 border-b border-slate-100">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-extrabold text-slate-900">
                              {displayPrice}
                            </span>
                            {period && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                {period}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-600 font-medium block mt-0.5">
                            {plan.userAllowance}
                          </span>
                        </div>

                        <ul className="space-y-1.5 text-[11px] text-slate-600">
                          {plan.features.slice(0, 4).map((f) => (
                            <li key={f} className="flex items-start gap-1.5">
                              <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-4">
                        <button
                          type="button"
                          className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold ${
                            isSelected
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {isSelected ? "Selected" : "Select"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!selectedPlan.isTrial && !selectedPlan.isEnterprise && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Initial 7-Day Free Trial: </span>
                    You selected the <strong>{selectedPlan.name}</strong> tier. You will receive an unrestricted 7-day free trial first.
                    Paid subscription billing is currently disabled in this environment and no credit card is required.
                  </div>
                </div>
              )}

              {selectedPlan.isEnterprise && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                  <Building className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Enterprise Request: </span>
                    You can either test drive the platform immediately with our 7-day trial or connect with our enterprise specialists.
                  </div>
                </div>
              )}

              <div className="pt-4 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleNextToStep2}
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-sm transition-all"
                >
                  Continue to Your Details
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Organisation & Owner Details */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Create your VEYRA account
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Start your 7-day free trial on the {selectedPlan.name} tier. No credit card required.
                </p>
              </div>

              <div className="space-y-4">
                {/* Org Name */}
                <div>
                  <label htmlFor="organizationName" className="block text-xs font-semibold text-slate-700 mb-1">
                    Organisation Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="organizationName"
                    value={formData.organizationName}
                    onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                    placeholder="Acme Technologies Ltd"
                    className={`w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      clientErrors.organizationName ? "border-red-400 bg-red-50/20" : "border-slate-300"
                    }`}
                  />
                  {clientErrors.organizationName && (
                    <span className="text-[11px] text-red-600 mt-1 block">
                      {clientErrors.organizationName}
                    </span>
                  )}
                </div>

                {/* Owner Name */}
                <div>
                  <label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Doe"
                    className={`w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      clientErrors.name ? "border-red-400 bg-red-50/20" : "border-slate-300"
                    }`}
                  />
                  {clientErrors.name && (
                    <span className="text-[11px] text-red-600 mt-1 block">
                      {clientErrors.name}
                    </span>
                  )}
                </div>

                {/* Work Email */}
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1">
                    Work Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@company.com"
                    className={`w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      clientErrors.email ? "border-red-400 bg-red-50/20" : "border-slate-300"
                    }`}
                  />
                  {clientErrors.email && (
                    <span className="text-[11px] text-red-600 mt-1 block">
                      {clientErrors.email}
                    </span>
                  )}
                </div>

                {/* Phone & Country (from mockup) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="phone" className="block text-xs font-semibold text-slate-700 mb-1">
                      Phone Number <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-300 bg-slate-50 text-slate-500 text-xs font-medium">
                        +91
                      </span>
                      <input
                        type="tel"
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="98765 43210"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="country" className="block text-xs font-semibold text-slate-700 mb-1">
                      Country
                    </label>
                    <select
                      id="country"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="India">India</option>
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="United Arab Emirates">United Arab Emirates</option>
                      <option value="Singapore">Singapore</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Password with Eye Toggle */}
                <div>
                  <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1">
                    Create Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Minimum 8 characters"
                      className={`w-full px-3.5 py-2 pr-10 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        clientErrors.password ? "border-red-400 bg-red-50/20" : "border-slate-300"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {clientErrors.password && (
                    <span className="text-[11px] text-red-600 mt-1 block">
                      {clientErrors.password}
                    </span>
                  )}
                </div>

                {/* Agree Checkbox */}
                <div className="pt-2">
                  <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.agreeTerms}
                      onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
                      className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      I agree to the{" "}
                      <Link href="/terms" target="_blank" className="text-blue-600 font-semibold hover:underline">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" target="_blank" className="text-blue-600 font-semibold hover:underline">
                        Privacy Policy
                      </Link>
                      .
                    </span>
                  </label>
                  {clientErrors.agreeTerms && (
                    <span className="text-[11px] text-red-600 mt-1 block">
                      {clientErrors.agreeTerms}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Plans
                </button>

                <button
                  type="button"
                  onClick={handleNextToStep3}
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-sm transition-all"
                >
                  Review & Confirm
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Review & Final Account Submission */}
          {currentStep === 3 && (
            <form action={formAction} className="space-y-6">
              {/* Hidden inputs to transmit completed state through server action */}
              <input type="hidden" name="organizationName" value={formData.organizationName} />
              <input type="hidden" name="name" value={formData.name} />
              <input type="hidden" name="email" value={formData.email} />
              <input type="hidden" name="phone" value={formData.phone} />
              <input type="hidden" name="country" value={formData.country} />
              <input type="hidden" name="password" value={formData.password} />
              <input type="hidden" name="planId" value={selectedPlan.id} />
              <input type="hidden" name="billingCycle" value={billingCycle} />
              <input type="hidden" name="agreeTerms" value={formData.agreeTerms ? "true" : ""} />

              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Review & Confirm Account Setup
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Please review your details before launching your workspace.
                </p>
              </div>

              {/* Review summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Org & Owner info */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                  <span className="font-bold text-slate-900 uppercase tracking-wider text-[10px] block">
                    Workspace & Admin Details
                  </span>
                  <div>
                    <span className="text-slate-500 block">Organisation:</span>
                    <span className="font-semibold text-slate-900 text-sm">
                      {formData.organizationName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Owner Name:</span>
                    <span className="font-medium text-slate-800">{formData.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Work Email:</span>
                    <span className="font-medium text-slate-800">{formData.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Country:</span>
                    <span className="font-medium text-slate-800">{formData.country}</span>
                  </div>
                </div>

                {/* Plan & Trial summary */}
                <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-200/80 space-y-2.5 text-xs">
                  <span className="font-bold text-blue-900 uppercase tracking-wider text-[10px] block">
                    Selected Tier & Entitlements
                  </span>
                  <div>
                    <span className="text-slate-500 block">Plan:</span>
                    <span className="font-bold text-blue-700 text-sm">{selectedPlan.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Immediate Trial Period:</span>
                    <span className="font-semibold text-slate-800">7 Days Unrestricted Access</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Trial User Allowance:</span>
                    <span className="font-medium text-slate-800">Unlimited during trial</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Payment Due Today:</span>
                    <span className="font-bold text-emerald-700">₹0 (No credit card required)</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Instant Activation: </span>
                  Submitting will create your tenant workspace, establish your administrative owner role,
                  activate all 8 platform modules, and log you in immediately.
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-200">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setCurrentStep(2)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Edit Details
                </button>

                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? (
                    "Bootstrapping Organisation..."
                  ) : (
                    <>
                      Create Organisation & Start Free Trial
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-sm font-semibold text-slate-600">
            Loading VEYRA registration...
          </div>
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
