/* eslint-disable @typescript-eslint/no-explicit-any */


import { RecordPage } from "../../../../../components/templates/RecordPage";
import { requirePermission } from "../../../../../lib/auth/boundary";
import { getTenantDb } from "../../../../../lib/db/tenant-db";
import { listCurrencies } from "../../../../../lib/commercial/currency-service";
import { createQuotationFromBOQAction } from '../../../actions';

export default async function NewQuotationPage() {
  await requirePermission("quotation.create");

  const tdb: any = await getTenantDb();
  const boqModel = tdb.BOQ || tdb.bOQ;

  // List approved BOQs
  const boqs = await boqModel.findMany({
    include: {
      opportunity: { include: { customer: true } },
      currentRevision: true
    }
  });

  const validBoqs = boqs.filter((b: any) => b.currentRevision?.status === "APPROVED");
  const currencies = await listCurrencies();

  return (
    <RecordPage
      title="Create Quotation from BOQ"
      breadcrumbs={[
        { label: "Commercial", href: "/commercial" },
        { label: "Quotations", href: "/commercial/quotations" },
        { label: "New", href: "/commercial/quotations/new" }
      ]}
      activeTab="form"
      tabs={[{ id: "form", label: "Details" }]}
    >
      <form action={createQuotationFromBOQAction} className="p-6 space-y-6 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-gray-700">Source Presales BOQ (Approved)</label>
          <select name="boq_id" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border">
            {validBoqs.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.boq_number} - {b.name} (Opp: {b.opportunity.name}, Customer: {b.opportunity.customer.name})
              </option>
            ))}
          </select>
          {validBoqs.length === 0 && <p className="text-red-500 text-sm mt-1">No approved BOQs available.</p>}
        </div>

        {validBoqs.map((b: any) => (
          <input key={`rev-${b.id}`} type="hidden" name="boq_revision_id" value={b.current_revision_id} disabled={false} /> // Simplified
        ))}

        <div>
          <label className="block text-sm font-medium text-gray-700">Quotation Currency</label>
          <select name="currency_id" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border">
            {currencies.map((c: any) => (
              <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
            ))}
          </select>
        </div>

        <div className="pt-4 border-t border-gray-200 flex justify-end">
          <button type="submit" disabled={validBoqs.length === 0} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
            Create Quotation Draft
          </button>
        </div>
      </form>
    </RecordPage>
  );
}
