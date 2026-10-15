/* eslint-disable @typescript-eslint/no-explicit-any */
import { requirePermission } from "../../../../../lib/auth/boundary";
import { getTenantContext } from "../../../../../lib/tenant/context";
import { getTenantDb } from "../../../../../lib/db/tenant-db";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "../../../../../components/ui/page-header";
import { ContentContainer } from "../../../../../components/ui/content-container";
import { createSupplierPurchaseOrder } from "../../../../../lib/commercial/procurement-service";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export const instant = false;

export default async function NewSupplierPOPage() {
  await requirePermission("procurement.create");
  const ctx = await getTenantContext();
  const tdb: any = await getTenantDb();

  const vendors = await tdb.Vendor.findMany({
    where: { tenant_id: ctx.tenantId, status: "ACTIVE" },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" }
  });

  const currencies = await tdb.Currency.findMany({
    where: { tenant_id: ctx.tenantId, is_active: true },
    select: { id: true, code: true, symbol: true, is_default: true },
    orderBy: { code: "asc" }
  });

  async function createSPOAction(formData: FormData) {
    "use server";
    const vendor_id = formData.get("vendor_id") as string;
    const currency_id = formData.get("currency_id") as string;
    const expected_date = (formData.get("expected_date") as string) || undefined;
    const delivery_destination = (formData.get("delivery_destination") as string) || undefined;

    if (!vendor_id) {
      throw new Error("Vendor is required");
    }
    if (!currency_id) {
      throw new Error("Currency is required");
    }

    const spo = await createSupplierPurchaseOrder({
      vendor_id,
      currency_id,
      expected_date,
      delivery_destination
    });

    revalidatePath("/procurement/purchase-orders");
    redirect(`/procurement/purchase-orders/${spo.id}`);
  }

  return (
    <ContentContainer>
      <PageHeader
        title="Create Supplier Purchase Order"
        description="Draft a new supplier purchase order for vendor procurement."
        actions={
          <Link
            href="/procurement/purchase-orders"
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to List
          </Link>
        }
      />

      <div className="bg-white shadow border border-gray-200 rounded-xl p-6 max-w-3xl mt-6">
        <form action={createSPOAction} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="vendor_id" className="block text-sm font-medium text-gray-700">
                Vendor <span className="text-red-500">*</span>
              </label>
              <select
                id="vendor_id"
                name="vendor_id"
                required
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
              >
                <option value="">Select Vendor...</option>
                {vendors.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="currency_id" className="block text-sm font-medium text-gray-700">
                Currency <span className="text-red-500">*</span>
              </label>
              <select
                id="currency_id"
                name="currency_id"
                required
                defaultValue={currencies.find((c: any) => c.is_default)?.id || currencies[0]?.id || ""}
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
              >
                <option value="">Select Currency...</option>
                {currencies.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="expected_date" className="block text-sm font-medium text-gray-700">
                Expected Delivery Date
              </label>
              <input
                type="date"
                id="expected_date"
                name="expected_date"
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
              />
            </div>

            <div>
              <label htmlFor="delivery_destination" className="block text-sm font-medium text-gray-700">
                Delivery Destination
              </label>
              <input
                type="text"
                id="delivery_destination"
                name="delivery_destination"
                placeholder="e.g. Central Warehouse / Site 1"
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
            <Link
              href="/procurement/purchase-orders"
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition"
            >
              <Save className="w-4 h-4" />
              Create Draft PO
            </button>
          </div>
        </form>
      </div>
    </ContentContainer>
  );
}
