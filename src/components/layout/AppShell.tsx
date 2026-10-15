"use client";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ReactNode } from "react";

export interface AppShellProps {
  children: ReactNode;
  user: {
    name: string;
    email: string;
  };
  organization: {
    name: string;
  };
  permissions: {
    isOwner: boolean;
    permissions: string[];
  };
}

export function AppShell({ children, user, organization, permissions }: AppShellProps) {
  return (
    <div className="h-screen w-full flex bg-gray-50 overflow-hidden font-sans">
      <Sidebar userPermissions={permissions.permissions} isOwner={permissions.isOwner} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          userEmail={user.email}
          userName={user.name}
          organizationName={organization.name}
          userPermissions={permissions.permissions}
          isOwner={permissions.isOwner}
        />

        <main className="flex-1 overflow-auto bg-gray-50">
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
