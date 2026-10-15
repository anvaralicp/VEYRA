/* eslint-disable @typescript-eslint/no-explicit-any */
import { ListPage } from "../../../../components/templates/ListPage";
import { getRequirements } from "../../../../lib/presales/requirement-service";
import Link from "next/link";
import * as Icons from "lucide-react";

export const instant = false;

export default async function RequirementsListPage({ searchParams }: { searchParams?: Promise<{ q?: string }> | { q?: string } }) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const query = resolvedSearchParams?.q;
  const requirements = await getRequirements(query);

  const { checkPermissionForUI } = await import("../../../../lib/auth/boundary");
  const canCreate = await checkPermissionForUI("requirement.create");

  const actions = canCreate ? (
    <Link
      href="/presales/requirements/new"
      className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
    >
      <Icons.Plus className="mr-2 h-4 w-4" />
      New Requirement
    </Link>
  ) : null;

  return (
    <ListPage
      title="Requirements"
      description="Manage business and technical requirements."
      actions={actions}
    >
      <div className="min-w-full inline-block align-middle overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opportunity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {requirements.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No requirements found.
                </td>
              </tr>
            ) : (
              requirements.map((req: any) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    <Link href={`/presales/requirements/${req.id}`}>{req.requirement_number}</Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{req.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {req.opportunity?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{req.priority}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      {req.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link href={`/presales/requirements/${req.id}`} className="text-gray-400 hover:text-blue-600">
                      <Icons.ChevronRight className="h-5 w-5 ml-auto" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ListPage>
  );
}
