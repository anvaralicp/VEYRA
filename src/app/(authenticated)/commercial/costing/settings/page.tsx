
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { requirePermission, checkPermissionForUI } from "../../../../../lib/auth/boundary";
import { getCostingSettings } from "../../../../../lib/commercial/costing-service";
import { updateCostingSettingsAction } from '../../../actions';

export default async function CostingSettingsPage() {
  await requirePermission("costing.settings.view");
  const settings = await getCostingSettings();
  const canEdit = await checkPermissionForUI("costing.settings.update");

  return (
    <RecordPage
      title="Commercial Costing Settings"
      breadcrumbs={[
        { label: "Commercial", href: "/commercial" },
        { label: "Costing Simulator", href: "/commercial/costing" },
        { label: "Settings", href: "/commercial/costing/settings" }
      ]}
      activeTab="form"
      tabs={[{ id: "form", label: "Settings" }]}
    >
      <form action={updateCostingSettingsAction} className="p-6 space-y-8 max-w-4xl">
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 border-b pb-2">Pricing Methodology</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Default Pricing Method</label>
              <select
                name="default_pricing_method"
                defaultValue={settings.default_pricing_method}
                disabled={!canEdit}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border disabled:bg-gray-100"
              >
                <option value="MARGIN">Margin (Target Price = Cost / (1 - %))</option>
                <option value="MARKUP">Markup (Target Price = Cost * (1 + %))</option>
              </select>
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Default Target Percentage</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="default_target_percentage"
                defaultValue={settings.default_target_percentage.toString()}
                disabled={!canEdit}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border disabled:bg-gray-100"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 border-b pb-2">Guardrails</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Minimum Margin Percentage (Optional)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="99.99"
                name="min_margin_percentage"
                defaultValue={settings.min_margin_percentage?.toString() || ""}
                disabled={!canEdit}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border disabled:bg-gray-100"
                placeholder="e.g. 15.00"
              />
              <p className="text-xs text-gray-500 mt-1">If set, any margin-based calculation below this limit will be rejected.</p>
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">Maximum Markup Percentage (Optional)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="max_markup_percentage"
                defaultValue={settings.max_markup_percentage?.toString() || ""}
                disabled={!canEdit}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border disabled:bg-gray-100"
                placeholder="e.g. 100.00"
              />
              <p className="text-xs text-gray-500 mt-1">If set, any markup-based calculation above this limit will be rejected.</p>
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="pt-5 border-t border-gray-200">
            <div className="flex justify-end">
              <button type="submit" className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                Save Settings
              </button>
            </div>
          </div>
        )}
      </form>
    </RecordPage>
  );
}
