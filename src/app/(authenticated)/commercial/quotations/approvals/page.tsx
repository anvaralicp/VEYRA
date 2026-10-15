/* eslint-disable @typescript-eslint/no-explicit-any */
import { ListPage } from "../../../../../components/templates/ListPage";
import { requirePermission } from "../../../../../lib/auth/boundary";
import { listPendingApprovals } from "../../../../../lib/commercial/quotation-approval-service";
import Link from "next/link";

export default async function ApprovalsQueuePage() {
  await requirePermission("quotation.approve");
  const approvals = await listPendingApprovals();

  const columns = [
    { key: "quotation_number", label: "Quotation #", render: (r: any) => (
      <Link href={`/commercial/quotations/${r.quotationRevision.quotation_id}`} className="text-blue-600 hover:underline font-medium">
        {r.quotationRevision.quotation.quotation_number}
      </Link>
    )},
    { key: "customer", label: "Customer", render: (r: any) => r.quotationRevision.customer_name_snapshot },
    { key: "revision", label: "Revision", render: (r: any) => `Rev ${r.quotationRevision.revision_number}` },
    { key: "grand_total", label: "Total", render: (r: any) => `${r.quotationRevision.currency_symbol_snapshot} ${r.quotationRevision.grand_total}` },
    { key: "submitted", label: "Submitted", render: (r: any) => new Date(r.created_at).toLocaleDateString() },
    { key: "reason", label: "Policy Trigger", render: (r: any) => {
        const policy = r.policy_snapshot as any;
        return <span className="text-sm text-gray-500" title={policy?.reason}>{policy?.reason?.substring(0, 50)}...</span>;
    }}
  ];

  return (
    <ListPage title="Quotation Approvals" description="Review quotations awaiting approval.">
      <div className="min-w-full inline-block align-middle overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/50">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {approvals.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500">
                  No quotations awaiting approval.
                </td>
              </tr>
            ) : (
              approvals.map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {col.render(r)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ListPage>
  );
}
