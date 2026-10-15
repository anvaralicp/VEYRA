/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { updatePlanningActionApi, markReadyActionApi, holdActionApi, resumeActionApi, cancelActionApi } from "./actions";
import { requirePermission } from "../../../../../../lib/auth/boundary";
import { getTenantDb } from "../../../../../../lib/db/tenant-db";
import { getTenantContext } from "../../../../../../lib/tenant/context";
import { redirect } from "next/navigation";
import {
  updateFulfilmentPlanning,
  updateFulfilmentOrderLinePlanning,
  markFulfilmentReady,
  holdFulfilmentOrder,
  resumeFulfilmentOrder,
  cancelFulfilmentOrder
} from "../../../../../../lib/commercial/fulfilment-service";
import Link from "next/link";

export default async function FulfilmentPlanningPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  await requirePermission("fulfilment.plan");
  const ctx = await getTenantContext();
  const tdb: any = await getTenantDb();

  const resolvedParams = await Promise.resolve(params);
  const order = await tdb.FulfilmentOrder.findUnique({
    where: { id: resolvedParams.id, tenant_id: ctx.tenantId },
    include: {
      customerPurchaseOrder: { include: { customer: true, customerSite: true, quotation: true } },
      lines: { include: { productService: true } }
    }
  });

  if (!order) redirect("/commercial/fulfilment");

  // Get users for assignment scoped to the current tenant
  const members = await tdb.TenantMember.findMany({
    where: { tenant_id: ctx.tenantId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { created_at: 'asc' }
  });
  const users = members.map((m: any) => m.user).filter(Boolean);

  const customerId = order.customer_id || order.customerPurchaseOrder?.customer_id;
  const customerSites = customerId ? await tdb.CustomerSite.findMany({
    where: { customer_id: customerId, tenant_id: ctx.tenantId }
  }) : [];



  async function updatePlanningAction(formData: FormData) {
    "use server";
    await updatePlanningActionApi(resolvedParams.id, formData);
    redirect(`/commercial/fulfilment/${resolvedParams.id}/planning`);
  }



  async function markReadyAction() {
    "use server";
    await markReadyActionApi(resolvedParams.id);
    redirect(`/commercial/fulfilment/${resolvedParams.id}/planning`);
  }

  async function holdAction(formData: FormData) {
    "use server";
    const reason = formData.get("reason") as string;
    await holdActionApi(resolvedParams.id, formData);
    redirect(`/commercial/fulfilment/${resolvedParams.id}/planning`);
  }

  async function resumeAction() {
    "use server";
    await resumeActionApi(resolvedParams.id);
    redirect(`/commercial/fulfilment/${resolvedParams.id}/planning`);
  }

  async function cancelAction(formData: FormData) {
    "use server";
    const reason = formData.get("reason") as string;
    await cancelActionApi(resolvedParams.id, formData);
    redirect(`/commercial/fulfilment`);
  }

  const isEditable = order.status === "OPEN" || order.status === "PLANNING" || order.status === "ON_HOLD";

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Planning: {order.id.substring(0,8).toUpperCase()}</h1>
        <div className="flex space-x-3">
          <Link href={`/commercial/fulfilment/${order.id}`} className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm font-medium">
            Back to Order
          </Link>
          <span className={`px-3 py-2 inline-flex text-sm leading-5 font-bold rounded-md ${order.status === 'READY' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {order.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-2 space-y-6">
          <form action={updatePlanningAction} className="bg-white shadow sm:rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Planning Details</h3>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Target Site</label>
                  <select name="customer_site_id" defaultValue={order.customer_site_id || ""} disabled={!isEditable} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    <option value="">Select Site...</option>
                    {customerSites.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Target Date</label>
                  <input type="date" name="target_date" defaultValue={order.target_date ? order.target_date.toISOString().split('T')[0] : ""} disabled={!isEditable} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Responsible User</label>
                  <select name="responsible_user_id" defaultValue={order.responsible_user_id || ""} disabled={!isEditable} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    <option value="">Select User...</option>
                    {users.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.name || u.email}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700">General Notes</label>
                  <textarea name="notes" defaultValue={order.notes || ""} rows={2} disabled={!isEditable} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"></textarea>
                </div>
              </div>

              <h4 className="text-md font-medium text-gray-900 mb-2">Order Lines</h4>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Required</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Planned</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {order.lines.map((line: any) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        <input type="hidden" name="line_id" value={line.id} />
                        {line.productService?.name}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                        {line.required_quantity?.toString()}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <input type="number" name={`planned_${line.id}`} defaultValue={line.planned_quantity?.toString() || line.required_quantity?.toString()} min="0" step="any" disabled={!isEditable} className="w-20 text-right rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <input type="text" name={`notes_${line.id}`} defaultValue={line.notes || ""} disabled={!isEditable} className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isEditable && (
              <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
                <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                  Save Planning
                </button>
              </div>
            )}
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-white shadow sm:rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Lifecycle Actions</h3>

            <div className="space-y-4">
              {['OPEN', 'PLANNING', 'ON_HOLD'].includes(order.status) && (
                <form action={markReadyAction}>
                  <button type="submit" className="w-full justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700">
                    Mark as READY
                  </button>
                  <p className="mt-1 text-xs text-gray-500">Requires User, Target Date, and lines to have planned quantities &gt; 0.</p>
                </form>
              )}

              {['OPEN', 'PLANNING', 'READY'].includes(order.status) && (
                <form action={holdAction}>
                  <input type="text" name="reason" placeholder="Hold reason..." required className="mb-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                  <button type="submit" className="w-full justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200">
                    Place ON HOLD
                  </button>
                </form>
              )}

              {order.status === 'ON_HOLD' && (
                <form action={resumeAction}>
                  <button type="submit" className="w-full justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-indigo-800 bg-indigo-100 hover:bg-indigo-200">
                    Resume Order
                  </button>
                </form>
              )}

              {['OPEN', 'PLANNING', 'READY', 'ON_HOLD'].includes(order.status) && (
                <form action={cancelAction} className="pt-4 border-t border-gray-200">
                  <input type="text" name="reason" placeholder="Cancellation reason..." required className="mb-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                  <button type="submit" className="w-full justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-red-800 bg-red-100 hover:bg-red-200">
                    Cancel Order
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="bg-white shadow sm:rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Reference Info</h3>
            <div className="text-sm text-gray-500 space-y-2">
              <p><span className="font-medium text-gray-700">Customer PO:</span> {order.customerPO?.po_number}</p>
              <p><span className="font-medium text-gray-700">Quotation:</span> {order.customerPO?.quotation?.quotation_number || 'N/A'}</p>
              <p><span className="font-medium text-gray-700">Created:</span> {new Date(order.created_at).toISOString().substring(0,10)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
