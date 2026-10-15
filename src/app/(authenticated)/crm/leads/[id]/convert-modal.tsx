"use client";

import { useState } from "react";
import { convertLeadAction } from "../actions";
import {
  TrendingUp,
  X,
  Building2,
  UserCheck,
  AlertCircle,
  Loader2,
  Sparkles,
  Calendar,
  DollarSign
} from "lucide-react";

export interface CustomerOption {
  id: string;
  display_name: string;
  legal_name?: string | null;
}

export interface ConvertLeadProps {
  lead: {
    id: string;
    lead_number: string;
    company_name: string;
    contact_name: string;
    email?: string | null;
    phone?: string | null;
    requirement?: string | null;
    estimated_value?: number | null;
    currency?: string | null;
    expected_close_date?: Date | string | null;
    status: string;
  };
  customers: CustomerOption[];
  canConvert: boolean;
  defaultOpen?: boolean;
  buttonText?: string;
  buttonVariant?: "primary" | "secondary" | "outline";
  inline?: boolean;
}

export function ConvertLeadModal({
  lead,
  customers,
  canConvert,
  defaultOpen = false,
  buttonText = "Convert to Opportunity",
  buttonVariant = "primary",
  inline = false,
}: ConvertLeadProps) {
  // Check if an existing customer matches the lead company name
  const matchedCustomer = customers.find(
    (c) =>
      c.display_name?.toLowerCase().trim() === lead.company_name?.toLowerCase().trim() ||
      c.legal_name?.toLowerCase().trim() === lead.company_name?.toLowerCase().trim()
  );

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [customerMode, setCustomerMode] = useState<"existing" | "new">(
    matchedCustomer ? "existing" : "new"
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    matchedCustomer?.id || (customers.length > 0 ? customers[0].id : "")
  );

  // Opportunity details confirmation
  const defaultOppName = `${lead.company_name} - ${lead.requirement || "New Opportunity"}`;
  const [opportunityName, setOpportunityName] = useState(defaultOppName);
  const [estimatedValue, setEstimatedValue] = useState(
    lead.estimated_value !== null && lead.estimated_value !== undefined
      ? lead.estimated_value.toString()
      : ""
  );
  const defaultDateStr = lead.expected_close_date
    ? new Date(lead.expected_close_date).toISOString().split("T")[0]
    : "";
  const [expectedCloseDate, setExpectedCloseDate] = useState(defaultDateStr);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canConvert || lead.status === "CONVERTED") {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (customerMode === "existing" && !selectedCustomerId) {
      setError("Please select an existing customer to continue.");
      return;
    }

    if (!opportunityName.trim()) {
      setError("Please provide an opportunity name.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("create_customer", customerMode === "new" ? "true" : "false");
    if (customerMode === "existing" && selectedCustomerId) {
      formData.append("customer_id", selectedCustomerId);
    }
    formData.append("opportunity_name", opportunityName.trim());
    if (estimatedValue) {
      formData.append("estimated_value", estimatedValue);
    }
    if (expectedCloseDate) {
      formData.append("expected_close_date", expectedCloseDate);
    }

    try {
      await convertLeadAction(lead.id, formData);
    } catch (err: unknown) {
      const errorObj = err as { message?: string; digest?: string };
      if (
        errorObj?.message?.includes("NEXT_REDIRECT") ||
        errorObj?.digest?.includes("NEXT_REDIRECT")
      ) {
        // Let Next.js handle the server action redirect
        throw err;
      }
      setError(errorObj?.message || "An unexpected error occurred during conversion.");
      setIsSubmitting(false);
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-md flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {/* Customer Selection Section */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            Customer & Account Association
          </h4>
        </div>

        {matchedCustomer && (
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Matching customer <strong>{matchedCustomer.display_name}</strong> found in your
              organization. Reusing this account avoids duplicate records.
            </span>
          </div>
        )}

        <div className="space-y-3">
          <label className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-md cursor-pointer hover:border-blue-300 transition-colors">
            <input
              type="radio"
              name="customer_mode_choice"
              checked={customerMode === "existing"}
              onChange={() => {
                setCustomerMode("existing");
                if (!selectedCustomerId && customers.length > 0) {
                  setSelectedCustomerId(customers[0].id);
                }
              }}
              disabled={customers.length === 0 || isSubmitting}
              className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-gray-600" />
                Reuse existing Customer
              </span>
              <p className="text-xs text-gray-500 mt-0.5">
                Link the new Opportunity to an already registered Customer account.
              </p>

              {customerMode === "existing" && (
                <div className="mt-3">
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select an existing customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.display_name} {c.legal_name && c.legal_name !== c.display_name ? `(${c.legal_name})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-md cursor-pointer hover:border-blue-300 transition-colors">
            <input
              type="radio"
              name="customer_mode_choice"
              checked={customerMode === "new"}
              onChange={() => setCustomerMode("new")}
              disabled={isSubmitting}
              className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-600" />
                Create new Customer record
              </span>
              <p className="text-xs text-gray-500 mt-0.5">
                Automatically generate a new Customer account using the lead details.
              </p>

              {customerMode === "new" && (
                <div className="mt-2.5 p-2.5 bg-gray-50 rounded border border-gray-200 text-xs text-gray-700 grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-medium text-gray-500">Company Name:</span>{" "}
                    <span className="font-semibold text-gray-900">{lead.company_name}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Primary Contact:</span>{" "}
                    <span className="font-semibold text-gray-900">{lead.contact_name}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Email:</span>{" "}
                    <span>{lead.email || "-"}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Phone:</span>{" "}
                    <span>{lead.phone || "-"}</span>
                  </div>
                </div>
              )}
            </div>
          </label>
        </div>
      </div>

      {/* Opportunity Details Section */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 space-y-4">
        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-600" />
          Opportunity Information
        </h4>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Opportunity Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={opportunityName}
              onChange={(e) => setOpportunityName(e.target.value)}
              required
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-gray-500" />
                Estimated Value ({lead.currency || "USD"})
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                disabled={isSubmitting}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-500" />
                Expected Close Date
              </label>
              <input
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        {!inline && (
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || (customerMode === "existing" && !selectedCustomerId)}
          className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Converting to Opportunity...
            </>
          ) : (
            <>
              <TrendingUp className="w-4 h-4" />
              Convert to Opportunity
            </>
          )}
        </button>
      </div>
    </form>
  );

  if (inline) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium border-b pb-2 mb-4 flex items-center gap-2 text-gray-900">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Convert Lead to Opportunity
        </h3>
        {formContent}
      </div>
    );
  }

  const buttonClasses =
    buttonVariant === "secondary"
      ? "inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium transition-colors"
      : buttonVariant === "outline"
      ? "inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors shadow-sm"
      : "inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors shadow-sm";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setIsOpen(true);
        }}
        className={buttonClasses}
      >
        <TrendingUp className="w-4 h-4" />
        {buttonText}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/50">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Convert Lead to Opportunity
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Convert <strong>{lead.company_name}</strong> ({lead.lead_number}) into an active Opportunity.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isSubmitting && setIsOpen(false)}
                disabled={isSubmitting}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[80vh] overflow-y-auto">
              {formContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
