/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { getManufacturerById } from "../../../../../lib/commercial/manufacturer-service";
import { notFound } from "next/navigation";
import { deactivateManufacturerAction } from '../../../actions';

export default async function ManufacturerDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = await Promise.resolve(params);
  const manufacturer = await getManufacturerById(resolvedParams.id);

  if (!manufacturer) {
    notFound();
  }

  return (
    <RecordPage
      title={manufacturer.name}
      breadcrumbs={[{ label: "Commercial", href: "/commercial" }, { label: "Manufacturers", href: "/commercial/manufacturers" }]} activeTab="overview" tabs={[{ id: "overview", label: "Overview" }]}
    >
      <div className="flex justify-end p-4 border-b">
        {manufacturer.is_active && (
          <form action={async () => {
            "use server";
            await deactivateManufacturerAction(manufacturer.id);
          }}>
            <button type="submit" className="px-4 py-2 bg-red-100 text-red-700 rounded-md text-sm font-medium hover:bg-red-200">
              Deactivate
            </button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Overview</h3>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{manufacturer.name}</dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Code</dt>
              <dd className="mt-1 text-sm text-gray-900">{manufacturer.code || '-'}</dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Website</dt>
              <dd className="mt-1 text-sm text-blue-600">
                {manufacturer.website ? <a href={manufacturer.website} target="_blank" rel="noreferrer">{manufacturer.website}</a> : '-'}
              </dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Related Products</dt>
              <dd className="mt-1 text-sm text-gray-900">{(manufacturer as any)._count?.products || 0}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500">Description</dt>
              <dd className="mt-1 text-sm text-gray-900">{manufacturer.description || '-'}</dd>
            </div>
          </dl>
        </div>

        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Contact Information</h3>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-1">
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-sm text-gray-900">{manufacturer.contact_email || '-'}</dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Phone</dt>
              <dd className="mt-1 text-sm text-gray-900">{manufacturer.contact_phone || '-'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </RecordPage>
  );
}
