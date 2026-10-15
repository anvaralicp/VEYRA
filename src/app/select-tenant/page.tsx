/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { getSession } from "../../lib/auth/session";
import { db } from "../../prisma/db";
import { getModel } from "../../lib/db/legacy-adapter";
import { switchTenantAction } from "./actions";
import { logoutAction } from "../login/actions";

export const instant = false;

export default async function SelectTenantPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const TenantMember = getModel(db, "TenantMember");
  const Tenant = getModel(db, "Tenant");

  let memberships: any[] = [];
  try {
    if (TenantMember && typeof TenantMember.findMany === "function") {
      memberships = await TenantMember.findMany({
        where: { user_id: session.userId, status: "ACTIVE" },
      });
    }
  } catch {
    memberships = [];
  }

  // Fetch tenant metadata for each membership
  const tenantList: Array<{ id: string; name: string; role: string }> = [];
  for (const m of memberships) {
    try {
      const t = await Tenant.findUnique({ where: { id: m.tenant_id } });
      if (t) {
        tenantList.push({
          id: t.id,
          name: t.name || "Unnamed Organization",
          role: m.role || "MEMBER",
        });
      }
    } catch {
      // Continue resolving remaining tenants
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-2 mb-2">
          <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm">
            V
          </div>
          <span className="text-2xl font-bold tracking-tight text-gray-900">VEYRA</span>
        </div>
        <h2 className="text-center text-2xl font-semibold text-gray-900 mt-4">
          Select Organization
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Signed in as <span className="font-medium text-gray-900">{session.email}</span>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-xl sm:px-10 border border-gray-200">
          {tenantList.length === 0 ? (
            <div className="text-center py-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 mb-4">
                <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">No Active Organizations</h3>
              <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
                You do not have active membership in any organization. Please contact your administrator or accept an invitation to join.
              </p>
              <div className="mt-6">
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 mb-2">
                Choose the organization you want to access:
              </p>
              <div className="divide-y divide-gray-100">
                {tenantList.map((t) => (
                  <form
                    key={t.id}
                    action={switchTenantAction.bind(null, t.id)}
                    className="py-3 flex items-center justify-between hover:bg-gray-50 p-3 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center font-bold text-base flex-shrink-0">
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {t.role}
                        </span>
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="ml-4 inline-flex items-center px-3.5 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                    >
                      Enter
                    </button>
                  </form>
                ))}
              </div>

              <div className="pt-6 border-t border-gray-200 flex justify-end">
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="text-xs text-gray-500 hover:text-red-600 font-medium"
                  >
                    Sign out of VEYRA
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
