/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import * as Icons from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVIGATION_CONFIG, NAVIGATION_SECTIONS } from "../../config/navigation";
import { cn } from "../../lib/utils";

export interface MobileNavigationProps {
  userPermissions: string[];
  isOwner: boolean;
}

export function MobileNavigation({ userPermissions, isOwner }: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const permittedItems = NAVIGATION_CONFIG.filter((item) => {
    if (!item.permission) return true;
    if (isOwner) return true;
    return userPermissions.includes(item.permission);
  }).sort((a, b) => a.order - b.order);

  const renderIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[
      iconName.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('')
    ] || Icons.Circle;
    return <IconComponent className="h-5 w-5" />;
  };

  return (
    <div className="md:hidden">
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 -ml-2 text-gray-500 hover:text-gray-900 rounded-md"
        aria-label="Open Menu"
      >
        <Icons.Menu className="h-6 w-6" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-gray-900/80" onClick={() => setIsOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 text-slate-300">
            <div className="h-14 flex items-center justify-between px-4 border-b border-slate-800">
              <span className="font-bold text-white text-lg tracking-wider">VEYRA</span>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
                <Icons.X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 scrollbar-thin">
              {NAVIGATION_SECTIONS.map((section) => {
                const sectionItems = permittedItems.filter(i => i.section === section.id);
                if (sectionItems.length === 0) return null;

                return (
                  <div key={section.id} className="mb-6">
                    <div className="px-4 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {section.label}
                    </div>
                    <ul className="space-y-1 px-2">
                      {sectionItems.map((item) => {
                        const isActive = pathname.startsWith(item.route);
                        return (
                          <li key={item.route}>
                            <Link
                              href={item.route}
                              onClick={() => setIsOpen(false)}
                              className={cn(
                                "flex items-center px-3 py-2.5 rounded-md transition-colors",
                                isActive
                                  ? "bg-blue-600 text-white"
                                  : "hover:bg-slate-800 text-slate-300"
                              )}
                            >
                              <span className={cn(isActive ? "text-white" : "text-slate-400")}>
                                {renderIcon(item.icon)}
                              </span>
                              <span className="ml-3 font-medium">{item.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
