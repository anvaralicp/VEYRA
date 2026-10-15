/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { getQuotation } from "../../../../../../lib/commercial/quotation-service";
import { requirePermission } from "../../../../../../lib/auth/boundary";
import { notFound } from "next/navigation";

export default async function PrintQuotationPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  await requirePermission("quotation.view");
  const resolvedParams = await Promise.resolve(params);
  const q = await getQuotation(resolvedParams.id);
  if (!q) notFound();

  const rev = q.currentRevision;

  return (
    <div className="bg-white text-black p-10 max-w-4xl mx-auto my-10 shadow-lg border border-gray-200">
      <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">QUOTATION</h1>
          <p className="text-sm text-gray-600 mt-1">Ref: {q.quotation_number}</p>
          <p className="text-sm text-gray-600">Rev: {rev?.revision_number} ({q.status})</p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-lg">{q.tenant.name}</p>
          {rev?.issue_date && (
            <p className="text-sm text-gray-600">Date: {new Date(rev.issue_date).toLocaleDateString()}</p>
          )}
          {rev?.valid_until && (
            <p className="text-sm text-gray-600">Valid Until: {new Date(rev.valid_until).toLocaleDateString()}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-sm font-bold text-gray-800 uppercase border-b border-gray-200 pb-1 mb-2">Customer</h3>
          <p className="font-semibold">{rev?.customer_name_snapshot}</p>
          <p className="text-sm whitespace-pre-line">{rev?.customer_address_snapshot}</p>
          {rev?.customer_gstin_snapshot && <p className="text-sm mt-1">Tax ID: {rev.customer_gstin_snapshot}</p>}
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800 uppercase border-b border-gray-200 pb-1 mb-2">Opportunity</h3>
          <p className="text-sm font-medium">{q.opportunity.name}</p>
          <p className="text-sm text-gray-600">{q.title}</p>
        </div>
      </div>

      <table className="w-full text-left border-collapse mb-8">
        <thead>
          <tr className="bg-gray-100 border-y border-gray-300">
            <th className="py-2 px-3 text-sm font-semibold">Item</th>
            <th className="py-2 px-3 text-sm font-semibold text-right">Qty</th>
            <th className="py-2 px-3 text-sm font-semibold text-right">Unit Price</th>
            <th className="py-2 px-3 text-sm font-semibold text-right">Tax</th>
            <th className="py-2 px-3 text-sm font-semibold text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rev?.lines.map((l: any, i: number) => (
            <tr key={l.id}>
              <td className="py-3 px-3">
                <p className="text-sm font-medium">{l.product_name_snapshot}</p>
                {l.description_snapshot && <p className="text-xs text-gray-500 mt-1">{l.description_snapshot}</p>}
              </td>
              <td className="py-3 px-3 text-sm text-right">{l.quantity} {l.unit_snapshot}</td>
              <td className="py-3 px-3 text-sm text-right">{rev.currency_symbol_snapshot} {l.unit_selling_price}</td>
              <td className="py-3 px-3 text-sm text-right">{rev.currency_symbol_snapshot} {l.tax_amount}</td>
              <td className="py-3 px-3 text-sm text-right font-medium">{rev.currency_symbol_snapshot} {l.line_total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end border-t-2 border-gray-800 pt-4">
        <div className="w-1/3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-gray-600">Subtotal</span>
            <span>{rev?.currency_symbol_snapshot} {rev?.subtotal}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-gray-600">Tax</span>
            <span>{rev?.currency_symbol_snapshot} {rev?.total_tax}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Grand Total</span>
            <span>{rev?.currency_symbol_snapshot} {rev?.grand_total}</span>
          </div>
        </div>
      </div>

      <div className="mt-12 text-xs text-gray-500 text-center border-t border-gray-200 pt-4">
        <p>This is a computer generated document.</p>
        <p className="mt-4 print:hidden text-gray-400">Press Ctrl+P to print or save to PDF.</p>
      </div>
    </div>
  );
}
