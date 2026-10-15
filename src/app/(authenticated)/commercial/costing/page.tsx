/* eslint-disable @typescript-eslint/no-explicit-any */
import { CostingSimulatorClient } from "./CostingSimulatorClient";
import { getCostingSettings, calculateCommercialCost, CostCalculationInput } from "../../../../lib/commercial/costing-service";
import { listCurrencies } from "../../../../lib/commercial/currency-service";
import { requirePermission, checkPermissionForUI } from "../../../../lib/auth/boundary";
import { getTenantDb } from "../../../../lib/db/tenant-db";

export default async function CostingSimulatorPage() {
  await requirePermission("costing.calculate");

  const settings = await getCostingSettings();
  const currencies = await listCurrencies();

  const tdb = await getTenantDb();
  const pvModel = (tdb as any).ProductVendor || (tdb as any).productVendor;
  const productVendors = await pvModel.findMany({
    where: { is_active: true },
    include: { product: true, vendor: true },
    orderBy: [{ product: { name: 'asc' } }, { is_preferred: 'desc' }]
  });
  const canEditSettings = await checkPermissionForUI("costing.settings.update");

  async function calculateAction(input: CostCalculationInput) {
    "use server";
    return await calculateCommercialCost(input);
  }

  return (
    <CostingSimulatorClient
      currencies={currencies.filter((c: any) => c.is_active)}
      productVendors={productVendors.filter((pv: any) => pv.is_active)}
      defaultSettings={settings}
      onCalculate={calculateAction}
      canEditSettings={canEditSettings}
    />
  );
}
