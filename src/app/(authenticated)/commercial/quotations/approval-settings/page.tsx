/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { requirePermission, checkPermissionForUI } from "../../../../../lib/auth/boundary";
import { getApprovalSettings } from "../../../../../lib/commercial/quotation-approval-service";
import { listCurrencies } from "../../../../../lib/commercial/currency-service";
import { updateApprovalSettingsAction } from '../../../actions';

export default async function ApprovalSettingsPage() {
  await requirePermission("quotation.approval_settings.view");
  const settings = await getApprovalSettings();
  const currencies = await listCurrencies();
  const canUpdate = await checkPermissionForUI("quotation.approval_settings.update");

  return (
    <RecordPage
      title="Quotation Approval Settings"
      breadcrumbs={[
        { label: "Commercial", href: "/commercial" },
        { label: "Quotations", href: "/commercial/quotations" },
        { label: "Approval Settings", href: "/commercial/quotations/approval-settings" }
      ]}
      activeTab="form"
      tabs={[{ id: "form", label: "Settings" }]}
    >
      <form action={updateApprovalSettingsAction} className="p-6 space-y-6 max-w-2xl bg-white rounded shadow-sm border mt-4">
        <div className="flex items-center justify-between bg-gray-50 p-4 rounded border">
          <div>
            <h3 className="text-sm font-medium text-gray-900">Enable Quotation Approvals</h3>
            <p className="text-sm text-gray-500">If disabled, quotations can be issued without an explicit approval step.</p>
          </div>
          <input type="checkbox" name="is_approval_enabled" defaultChecked={settings.is_approval_enabled} disabled={!canUpdate} className="h-4 w-4 text-blue-600 border-gray-300 rounded" value="true" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Minimum Margin Threshold (%)</label>
          <p className="text-xs text-gray-500 mb-1">Quotations with actual margin below this threshold require approval. (0 - 99.99)</p>
          <input type="number" step="0.01" name="min_margin_threshold" defaultValue={settings.min_margin_threshold || ""} disabled={!canUpdate} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border sm:text-sm" placeholder="e.g. 20" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Total Value Threshold</label>
          <p className="text-xs text-gray-500 mb-1">Quotations reaching or exceeding this grand total require approval.</p>
          <div className="flex space-x-2">
            <select name="currency_id" defaultValue={settings.currency_id || ""} disabled={!canUpdate} className="block w-1/3 rounded-md border-gray-300 shadow-sm p-2 border sm:text-sm">
              <option value="">No Currency (Disabled)</option>
              {currencies.map((c: any) => (
                <option key={c.id} value={c.id}>{c.code}</option>
              ))}
            </select>
            <input type="number" step="0.01" name="value_threshold" defaultValue={settings.value_threshold || ""} disabled={!canUpdate} className="block w-2/3 rounded-md border-gray-300 shadow-sm p-2 border sm:text-sm" placeholder="e.g. 50000" />
          </div>
          <p className="text-xs text-gray-500 mt-1">Both threshold and currency must be set to enforce this rule.</p>
        </div>

        <div className="flex items-center justify-between bg-gray-50 p-4 rounded border">
          <div>
            <h3 className="text-sm font-medium text-gray-900">Require Separation of Duties</h3>
            <p className="text-sm text-gray-500">If enabled, the requester cannot approve their own submission.</p>
          </div>
          <input type="checkbox" name="require_separation_of_duties" defaultChecked={settings.require_separation_of_duties} disabled={!canUpdate} className="h-4 w-4 text-blue-600 border-gray-300 rounded" value="true" />
        </div>

        {canUpdate && (
          <div className="pt-4 border-t flex justify-end">
             <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Settings</button>
          </div>
        )}
      </form>
    </RecordPage>
  );
}
