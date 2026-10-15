/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { RecordPage } from "../../../../../components/templates/RecordPage";
import { requirePermission, checkPermissionForUI, requireTenantContext } from "../../../../../lib/auth/boundary";
import { getQuotation } from "../../../../../lib/commercial/quotation-service";
import { issueQuotationAction, createQuotationRevisionAction, withdrawQuotationAction, submitQuotationForApprovalAction, decideQuotationApprovalAction } from '../../../actions';
import { notFound } from "next/navigation";
import { getTenantDb } from "../../../../../lib/db/tenant-db";

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  await requirePermission("quotation.view");
  const auth = await requireTenantContext();

  const resolvedParams = await Promise.resolve(params);
  const q = await getQuotation(resolvedParams.id);
  if (!q) notFound();

  const canUpdate = await checkPermissionForUI("quotation.update");
  const canIssue = await checkPermissionForUI("quotation.issue");
  const canRevise = await checkPermissionForUI("quotation.revise");
  const canWithdraw = await checkPermissionForUI("quotation.withdraw");
  const canSubmit = await checkPermissionForUI("quotation.submit_for_approval");
  const canApprove = await checkPermissionForUI("quotation.approve");

  const rev = q.currentRevision;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "lines", label: "Commercial Lines" },
    { id: "revisions", label: "Revisions" }
  ];

  const rawDb: any = await getTenantDb();
  const reqModel = rawDb.tdb ? rawDb.tdb.QuotationApprovalRequest || rawDb.tdb.quotationApprovalRequest : rawDb.QuotationApprovalRequest || rawDb.quotationApprovalRequest;

  let activeRequest = null;
  if (rev?.approval_status === "PENDING") {
      activeRequest = await reqModel.findFirst({
          where: { quotation_revision_id: rev.id, status: "PENDING" },
          orderBy: { created_at: "desc" }
      });
  }

  return (
    <RecordPage
      title={`${q.quotation_number} - ${q.title}`}
      breadcrumbs={[
        { label: "Commercial", href: "/commercial" },
        { label: "Quotations", href: "/commercial/quotations" },
        { label: q.quotation_number, href: `/commercial/quotations/${q.id}` }
      ]}
      activeTab="overview"
      tabs={tabs}
    >
      <div className="p-6 space-y-6">
        <a href={`/commercial/quotations/${q.id}/print`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 mr-2 inline-block shadow-sm">
          Print Quotation
        </a>

        {rev?.status === 'DRAFT' && canIssue && rev.approval_status !== "PENDING" && rev.approval_status !== "NOT_SUBMITTED" && rev.approval_status !== "REJECTED" && rev.approval_status !== "RETURNED" && (
          <form action={async () => {
            "use server";
            await issueQuotationAction(rev.id);
          }} className="inline-block">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2 shadow-sm">
              Issue Quotation to Customer
            </button>
          </form>
        )}

        {rev?.status === 'DRAFT' && canSubmit && (rev.approval_status === "NOT_SUBMITTED" || rev.approval_status === "RETURNED") && (
           <form action={async () => {
            "use server";
            await submitQuotationForApprovalAction(rev.id);
          }} className="inline-block">
            <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 mr-2 shadow-sm">
              Submit for Approval
            </button>
          </form>
        )}

        {rev?.status === 'ISSUED' && canRevise && (
          <form action={async () => {
            "use server";
            await createQuotationRevisionAction(q.id);
          }} className="inline-block">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 mr-2 shadow-sm">
              Create New Revision
            </button>
          </form>
        )}

        {rev?.status === 'ISSUED' && canWithdraw && (
          <form action={async () => {
            "use server";
            await withdrawQuotationAction(rev.id);
          }} className="inline-block">
            <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 shadow-sm">
              Withdraw Quotation
            </button>
          </form>
        )}

        {rev?.approval_status === "PENDING" && canApprove && activeRequest && activeRequest.requester_id !== auth.userId && (
           <div className="bg-yellow-50 border border-yellow-200 p-4 rounded mt-4">
             <h3 className="font-semibold text-yellow-800">Pending Approval</h3>
             <p className="text-sm text-yellow-700 mb-4 mt-1">This quotation requires commercial approval before issuance.</p>
             <form action={decideQuotationApprovalAction} className="space-y-4">
                <input type="hidden" name="revision_id" value={rev.id} />
                <textarea name="comments" placeholder="Comments (required for return/reject)" className="w-full rounded border-gray-300 p-2 text-sm shadow-sm" rows={2}></textarea>
                <div className="flex space-x-2">
                   <button type="submit" name="decision" value="APPROVED" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm shadow-sm">Approve</button>
                   <button type="submit" name="decision" value="RETURNED" className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm shadow-sm">Return for Edits</button>
                   <button type="submit" name="decision" value="REJECTED" className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm shadow-sm">Reject</button>
                </div>
             </form>
           </div>
        )}

        {rev?.approval_status === "PENDING" && activeRequest?.requester_id === auth.userId && (
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded mt-4">
             <h3 className="font-semibold text-yellow-800">Pending Approval</h3>
             <p className="text-sm text-yellow-700 mt-1">You have submitted this quotation for approval. Waiting for a reviewer.</p>
           </div>
        )}

        <div className="grid grid-cols-2 gap-6 bg-white p-6 border rounded shadow-sm mt-4">
          <div>
            <h3 className="text-gray-500 text-sm font-medium">Customer Snapshot</h3>
            <p className="mt-1 text-lg font-semibold">{rev?.customer_name_snapshot}</p>
            <p className="text-sm text-gray-600">{rev?.customer_address_snapshot}</p>
          </div>
          <div>
            <h3 className="text-gray-500 text-sm font-medium">Status & Revision</h3>
            <p className="mt-1 text-lg font-semibold">{q.status} (Rev {rev?.revision_number})</p>
            <p className="text-sm text-gray-600">Approval: <span className="font-semibold">{rev?.approval_status}</span></p>
          </div>
          <div>
            <h3 className="text-gray-500 text-sm font-medium">Grand Total</h3>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {rev?.currency_symbol_snapshot} {rev?.grand_total}
            </p>
            <p className="text-sm text-gray-600">Tax: {rev?.currency_symbol_snapshot} {rev?.total_tax}</p>
          </div>
        </div>

        {rev?.lines && rev.lines.length > 0 ? (
          <div className="bg-white border rounded shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tax</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rev.lines.map((l: any) => (
                  <tr key={l.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{l.product_name_snapshot}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{l.quantity} {l.unit_snapshot}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rev.currency_symbol_snapshot} {l.unit_selling_price}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rev.currency_symbol_snapshot} {l.tax_amount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{rev.currency_symbol_snapshot} {l.line_total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 italic">No lines added yet.</p>
        )}
      </div>
    </RecordPage>
  );
}
