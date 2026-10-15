/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecordPage } from "../../../../../components/templates/RecordPage";
import { createCategoryAction } from '../../../actions';
import { getCategories } from "../../../../../lib/commercial/category-service";
import { requirePermission } from "../../../../../lib/auth/boundary";

export default async function NewCategoryPage() {
  await requirePermission("category.create");

  const categories = await getCategories();

  return (
    <RecordPage
      title="New Category"
      breadcrumbs={[{ label: "Commercial", href: "/commercial" }, { label: "Categories", href: "/commercial/categories" }]} activeTab="overview" tabs={[{ id: "overview", label: "Overview" }]}
    >
      <form action={createCategoryAction} className="p-6 space-y-6 max-w-2xl">
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Code *</label>
            <input type="text" name="code" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" placeholder="HW-NET" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Name *</label>
            <input type="text" name="name" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Parent Category</label>
            <select name="parent_id" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border">
              <option value="">-- No Parent (Root Category) --</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea name="description" rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" />
          </div>
        </div>
        <div className="pt-5 border-t border-gray-200">
          <div className="flex justify-end">
            <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              Create Category
            </button>
          </div>
        </div>
      </form>
    </RecordPage>
  );
}
