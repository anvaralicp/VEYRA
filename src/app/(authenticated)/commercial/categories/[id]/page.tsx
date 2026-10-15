
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { getCategoryById } from "../../../../../lib/commercial/category-service";
import { notFound } from "next/navigation";
import { deactivateCategoryAction } from '../../../actions';

export default async function CategoryDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = await Promise.resolve(params);
  const category = await getCategoryById(resolvedParams.id);

  if (!category) {
    notFound();
  }

  return (
    <RecordPage
      title={category.name}
      breadcrumbs={[{ label: "Commercial", href: "/commercial" }, { label: "Categories", href: "/commercial/categories" }]} activeTab="overview" tabs={[{ id: "overview", label: "Overview" }]}
    >
      <div className="flex justify-end p-4 border-b">
        {category.is_active && (
          <form action={async () => {
            "use server";
            await deactivateCategoryAction(category.id);
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
              <dt className="text-sm font-medium text-gray-500">Code</dt>
              <dd className="mt-1 text-sm text-gray-900">{category.code}</dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Parent Category</dt>
              <dd className="mt-1 text-sm text-gray-900">{category.parent?.name || '-'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500">Description</dt>
              <dd className="mt-1 text-sm text-gray-900">{category.description || '-'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </RecordPage>
  );
}
