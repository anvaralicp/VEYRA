/* eslint-disable @typescript-eslint/no-explicit-any */
import { ListPage } from "../../../../components/templates/ListPage";
import { getSolutions } from "../../../../lib/presales/solution-service";
import Link from "next/link";
import * as Icons from "lucide-react";

export const instant = false;

export default async function SolutionsListPage({ searchParams }: { searchParams?: Promise<{ q?: string }> | { q?: string } }) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const query = resolvedSearchParams?.q;
  const solutions = await getSolutions(query);

  const { checkPermissionForUI } = await import("../../../../lib/auth/boundary");
  const canCreate = await checkPermissionForUI("solution.create");

  const actions = canCreate ? (
    <Link
      href="/presales/solutions/new"
      className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
    >
      <Icons.Plus className="mr-2 h-4 w-4" />
      New Solution
    </Link>
  ) : null;

  return (
    <ListPage
      title="Solutions"
      description="Manage technical solution designs and architectures."
      actions={actions}
    >
      <div className="min-w-full inline-block align-middle overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opportunity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {solutions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No solutions found.
                </td>
              </tr>
            ) : (
              solutions.map((sol: any) => (
                <tr key={sol.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    <Link href={`/presales/solutions/${sol.id}`}>{sol.solution_number}</Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sol.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sol.opportunity?.name || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      {sol.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link href={`/presales/solutions/${sol.id}`} className="text-gray-400 hover:text-blue-600">
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
