"use client";

import { useState, useRef, useEffect } from "react";
import * as Icons from "lucide-react";
import Link from "next/link";
import { logoutAction } from "../../app/login/actions"; // use existing logout action

export function UserMenu({ userName, userEmail, organizationName }: { userName: string, userEmail: string, organizationName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:bg-gray-100 p-1.5 rounded-full transition-colors"
        aria-expanded={isOpen}
      >
        <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-700 font-medium">
          {userName.charAt(0).toUpperCase()}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg py-1 border border-gray-200 z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
            <p className="text-sm text-gray-500 truncate">{userEmail}</p>
            <div className="mt-1 flex items-center text-xs text-blue-600 font-medium">
              <Icons.Building className="h-3 w-3 mr-1" />
              <span className="truncate">{organizationName}</span>
            </div>
          </div>
          <div className="py-1">
            <Link href="/select-tenant" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <Icons.Building2 className="h-4 w-4 mr-3 text-gray-400" />
              Switch Organization
            </Link>
            <Link href="/profile" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <Icons.User className="h-4 w-4 mr-3 text-gray-400" />
              Profile
            </Link>
            <Link href="/preferences" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <Icons.Settings className="h-4 w-4 mr-3 text-gray-400" />
              Preferences
            </Link>
          </div>
          <div className="py-1 border-t border-gray-100">
            <form action={logoutAction}>
              <button type="submit" className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-gray-100">
                <Icons.LogOut className="h-4 w-4 mr-3 text-red-400" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
