"use client";

import * as Icons from "lucide-react";
import { UserMenu } from "./UserMenu";
import { GlobalSearch } from "./GlobalSearch";
import { Notifications } from "./Notifications";
import { MobileNavigation } from "./MobileNavigation";

export interface TopBarProps {
  userEmail: string;
  userName: string;
  organizationName: string;
  userPermissions: string[];
  isOwner: boolean;
}

export function TopBar({ userEmail, userName, organizationName, userPermissions, isOwner }: TopBarProps) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        {/* Mobile menu toggle */}
        <MobileNavigation userPermissions={userPermissions} isOwner={isOwner} />

        {/* Branding */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold">
            {organizationName.charAt(0).toUpperCase()}
          </div>
          <span className="font-semibold text-gray-900 hidden sm:block truncate max-w-[200px]">
            {organizationName}
          </span>
        </div>
      </div>

      <div className="flex-1 max-w-2xl px-4 hidden md:block">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="md:hidden">
          <button className="p-2 text-gray-500 hover:text-gray-900" aria-label="Search">
            <Icons.Search className="h-5 w-5" />
          </button>
        </div>
        <Notifications />
        <UserMenu userName={userName} userEmail={userEmail} organizationName={organizationName} />
      </div>
    </header>
  );
}
