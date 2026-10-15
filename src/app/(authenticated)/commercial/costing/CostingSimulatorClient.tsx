/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { Plus, Trash2, Settings, Calculator } from "lucide-react";
import Link from "next/link";
import { CostCalculationInput } from "../../../../lib/commercial/costing-service";

type Props = {
  currencies: any[];
  productVendors: any[];
  defaultSettings: any;
  onCalculate: (input: CostCalculationInput) => Promise<any>;
  canEditSettings: boolean;
};

export function CostingSimulatorClient({ currencies, productVendors, defaultSettings, onCalculate, canEditSettings }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [components, setComponents] = useState<CostCalculationInput["components"]>([]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData(e.currentTarget);
      const input: CostCalculationInput = {
        product_vendor_id: formData.get("product_vendor_id") as string,
        currency_id: formData.get("currency_id") as string,
        quantity: formData.get("quantity") as string,
        effective_date: new Date(formData.get("effective_date") as string),
        pricing_method: formData.get("pricing_method") as "MARGIN" | "MARKUP",
        target_percentage: formData.get("target_percentage") as string,
        components: components
      };

      const res = await onCalculate(input);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "An error occurred during calculation");
    } finally {
      setLoading(false);
    }
  };

  const addComponent = () => {
    setComponents([...components, { type: "FREIGHT", description: "", method: "FIXED_AMOUNT", amount: 0 }]);
  };

  const removeComponent = (idx: number) => {
    setComponents(components.filter((_, i) => i !== idx));
  };

  const updateComponent = (idx: number, field: string, value: any) => {
    const updated = [...components];
    (updated[idx] as any)[field] = value;
    setComponents(updated);
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Commercial Costing Simulator</h1>
          <p className="text-sm text-gray-500">Calculate landed costs, margins, and selling prices safely.</p>
        </div>
        {canEditSettings && (
          <Link href="/commercial/costing/settings" className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium shadow-sm">
            <Settings className="w-4 h-4 mr-2" /> Configure Rules
          </Link>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Calculation Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-1/2 space-y-6">
          <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 border border-gray-200 space-y-6">

            <h3 className="text-lg font-medium leading-6 text-gray-900 border-b pb-2">Base Parameters</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Product - Vendor *</label>
                <select name="product_vendor_id" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border">
                  <option value="">Select a mapping...</option>
                  {productVendors.map(pv => (
                    <option key={pv.id} value={pv.id}>
                      {pv.product.name} (from {pv.vendor.name}) {pv.is_preferred ? 'â­' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Currency *</label>
                <select name="currency_id" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border">
                  {currencies.map(c => (
                    <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Quantity *</label>
                <input type="number" name="quantity" required min="1" defaultValue="1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Effective Date *</label>
                <input type="date" name="effective_date" required defaultValue={today} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
              </div>
            </div>

            <div className="flex justify-between items-center border-b pb-2 pt-4">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Cost Components</h3>
              <button type="button" onClick={addComponent} className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500">
                <Plus className="w-4 h-4 mr-1" /> Add Component
              </button>
            </div>

            {components.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No additional cost components.</p>
            ) : (
              <div className="space-y-4">
                {components.map((c, i) => (
                  <div key={i} className="flex items-center space-x-2 bg-gray-50 p-3 rounded border">
                    <select value={c.type} onChange={(e) => updateComponent(i, 'type', e.target.value)} className="block w-1/4 rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border">
                      <option value="FREIGHT">Freight</option>
                      <option value="INSURANCE">Insurance</option>
                      <option value="CUSTOMS">Customs</option>
                      <option value="HANDLING">Handling</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <input type="text" placeholder="Description" value={c.description} onChange={(e) => updateComponent(i, 'description', e.target.value)} className="block w-1/4 rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
                    <select value={c.method} onChange={(e) => updateComponent(i, 'method', e.target.value)} className="block w-1/4 rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border">
                      <option value="FIXED_AMOUNT">Fixed (Line Total)</option>
                      <option value="PERCENTAGE_OF_BASE_COST">% of Base Cost</option>
                    </select>
                    <input type="number" step="0.01" value={c.amount} onChange={(e) => updateComponent(i, 'amount', e.target.value)} className="block w-1/5 rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
                    <button type="button" onClick={() => removeComponent(i)} className="text-red-500 hover:text-red-700 p-1">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <h3 className="text-lg font-medium leading-6 text-gray-900 border-b pb-2 pt-4">Pricing Rules</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Method *</label>
                <select name="pricing_method" defaultValue={defaultSettings.default_pricing_method} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border">
                  <option value="MARGIN">Margin %</option>
                  <option value="MARKUP">Markup %</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Target % *</label>
                <input type="number" name="target_percentage" step="0.01" min="0" required defaultValue={defaultSettings.default_target_percentage.toString()} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 flex justify-end">
              <button type="submit" disabled={loading} className="inline-flex items-center justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50">
                <Calculator className="w-4 h-4 mr-2" /> {loading ? "Calculating..." : "Calculate Price"}
              </button>
            </div>
          </form>
        </div>

        <div className="lg:w-1/2">
          {result ? (
            <div className="bg-gray-900 text-white shadow rounded-lg p-6 space-y-6">
              <h2 className="text-xl font-bold border-b border-gray-700 pb-2">Calculation Results</h2>

              <div className="space-y-2">
                <h4 className="text-gray-400 text-sm uppercase font-semibold">1. Base Vendor Cost</h4>
                <div className="flex justify-between items-center text-lg">
                  <span>Base Unit Cost</span>
                  <span>{result.currency.symbol} {result.base_unit_cost.toFixed(result.currency.decimal_places)}</span>
                </div>
                <div className="flex justify-between items-center text-lg">
                  <span>Base Line Total (Qty: {result.quantity})</span>
                  <span>{result.currency.symbol} {result.base_line_total.toFixed(result.currency.decimal_places)}</span>
                </div>
              </div>

              {result.evaluated_components.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-700">
                  <h4 className="text-gray-400 text-sm uppercase font-semibold">2. Components</h4>
                  {result.evaluated_components.map((c: any, i: number) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span>{c.type} {c.description ? `- ${c.description}` : ''}</span>
                      <span>+ {result.currency.symbol} {c.calculated_amount.toFixed(result.currency.decimal_places)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center font-semibold pt-1">
                    <span>Total Components Cost</span>
                    <span>{result.currency.symbol} {result.total_component_cost.toFixed(result.currency.decimal_places)}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-gray-700">
                <h4 className="text-gray-400 text-sm uppercase font-semibold">3. Landed Cost</h4>
                <div className="flex justify-between items-center text-xl font-semibold text-yellow-400">
                  <span>Landed Unit Cost</span>
                  <span>{result.currency.symbol} {result.landed_unit_cost.toFixed(result.currency.decimal_places)}</span>
                </div>
                <div className="flex justify-between items-center text-lg">
                  <span>Landed Line Total</span>
                  <span>{result.currency.symbol} {result.landed_cost_line_total.toFixed(result.currency.decimal_places)}</span>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-700">
                <h4 className="text-gray-400 text-sm uppercase font-semibold">4. Selling Price ({result.pricing_method} @ {result.target_percentage}%)</h4>
                <div className="flex justify-between items-center text-2xl font-bold text-green-400">
                  <span>Selling Unit Price</span>
                  <span>{result.currency.symbol} {result.selling_price_unit.toFixed(result.currency.decimal_places)}</span>
                </div>
                <div className="flex justify-between items-center text-xl">
                  <span>Selling Line Total</span>
                  <span>{result.currency.symbol} {result.selling_price_line_total.toFixed(result.currency.decimal_places)}</span>
                </div>

                <div className="flex justify-between items-center text-sm text-gray-300 pt-2">
                  <span>Actual Margin Yield</span>
                  <span>{result.actual_margin_percentage.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center text-sm text-gray-300">
                  <span>Actual Markup Yield</span>
                  <span>{result.actual_markup_percentage.toFixed(2)}%</span>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg h-full flex flex-col items-center justify-center p-12 text-gray-400">
              <Calculator className="w-16 h-16 mb-4 text-gray-300" />
              <p className="text-lg">Fill out the parameters and click Calculate.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
