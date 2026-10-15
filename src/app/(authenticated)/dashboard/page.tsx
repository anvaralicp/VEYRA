import { PageHeader } from "../../../components/ui/page-header";
import { ContentContainer } from "../../../components/ui/content-container";
import { requireAuthenticatedUser } from "../../../lib/auth/boundary";
import * as Icons from "lucide-react";

import { db } from "../../../prisma/db";
import { getModel } from "../../../lib/db/legacy-adapter";

export const instant = false;

export default async function DashboardPage() {
  const sessionUser = await requireAuthenticatedUser();
  const User = getModel(db, "User");
  const user = User
    ? await User.findUnique({ where: { id: sessionUser.userId } })
    : null;
  const firstName = user?.name ? user.name.split(' ')[0] : sessionUser.email.split('@')[0];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={`Good morning, ${firstName}`}
        description="Here is what's happening today."
      />
      <ContentContainer className="flex-1 overflow-auto bg-gray-50/50 p-6 space-y-6">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          <div className="col-span-1 md:col-span-2 space-y-6">
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Icons.Briefcase className="h-5 w-5 mr-2 text-blue-600" />
                My Work
              </h2>
              <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-100 rounded-lg bg-gray-50/50 text-gray-500">
                <Icons.CheckCircle className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm">No pending tasks or approvals.</p>
              </div>
            </section>

            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Icons.Activity className="h-5 w-5 mr-2 text-blue-600" />
                Recent Activity
              </h2>
              <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-100 rounded-lg bg-gray-50/50 text-gray-500">
                <p className="text-sm">Activity feed placeholder.</p>
              </div>
            </section>
          </div>

          <div className="col-span-1 space-y-6">
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <button className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors text-left group">
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Create New Ticket</span>
                  <Icons.Plus className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
                </button>
                <button className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors text-left group">
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">New Opportunity</span>
                  <Icons.Plus className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
                </button>
                <button className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors text-left group">
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Invite User</span>
                  <Icons.Plus className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
                </button>
              </div>
            </section>

            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Module Summary</h2>
              <ul className="space-y-4">
                <li className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                    Open Tickets
                  </span>
                  <span className="font-semibold text-gray-900">0</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                    Active Opportunities
                  </span>
                  <span className="font-semibold text-gray-900">0</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
                    Pending Approvals
                  </span>
                  <span className="font-semibold text-gray-900">0</span>
                </li>
              </ul>
            </section>
          </div>

        </div>
      </ContentContainer>
    </div>
  );
}
