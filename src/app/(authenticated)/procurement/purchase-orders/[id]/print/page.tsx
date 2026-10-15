
import { requirePermission } from "../../../../../../lib/auth/boundary";

export default async function SupplierPOPrintPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  await requirePermission("procurement.view");
  const resolvedParams = await Promise.resolve(params);

  return (
    <div className="p-10 max-w-4xl mx-auto bg-white min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">PURCHASE ORDER</h1>
      <p className="text-sm text-gray-500">Printable Supplier PO document UI to be fully implemented in a future update.</p>
      <p className="text-sm text-gray-500 mt-2">SPO ID: {resolvedParams.id}</p>
    </div>
  );
}
