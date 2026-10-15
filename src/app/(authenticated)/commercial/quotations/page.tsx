/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { ListPage } from "../../../../components/templates/ListPage";
import { requirePermission, checkPermissionForUI } from "../../../../lib/auth/boundary";
import { listQuotations } from "../../../../lib/commercial/quotation-service";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function QuotationsListPage() {
  await requirePermission("quotation.view");
  const quotations = await listQuotations();
  const canCreate = await checkPermissionForUI("quotation.create");

  const actions = canCreate ? (
    <Link
      href="/commercial/quotations/new"
      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
    >
      <Plus className="w-4 h-4 mr-2" />
      New Quotation
    </Link>
  ) : undefined;

  const columns = [
    { key: "quotation_number", label: "Quotation #", render: (q: any) => (
      <Link href={`/commercial/quotations/${q.id}`} className="text-blue-600 hover:underline font-medium">
        {q.quotation_number}
      </Link>
    )},
    { key: "title", label: "Title" },
    { key: "customer", label: "Customer", render: (q: any) => q.customer?.name },
    { key: "status", label: "Status", render: (q: any) => (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        q.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
        q.status === 'ISSUED' ? 'bg-blue-100 text-blue-800' :
        q.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        {q.status}
      </span>
    )},
    { key: "revision", label: "Revision", render: (q: any) => `Rev ${q.currentRevision?.revision_number || 1}` },
    { key: "grand_total", label: "Total", render: (q: any) => q.currentRevision ? `${q.currentRevision.currency_symbol_snapshot} ${q.currentRevision.grand_total}` : '-' }
  ];

  return (
    <ListPage title="Quotations" description="Manage commercial quotations and CPQ." actions={actions}>
      <div className="p-6">
        <p className="text-gray-500 mb-4">List UI to be implemented</p>
        <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-64">
          {JSON.stringify(quotations || [], null, 2)}
        </pre>
      </div>
    </ListPage>
  );
}
