/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVIGATION_CONFIG, NAVIGATION_SECTIONS } from "../../config/navigation";
import { useState } from "react";
import * as Icons from "lucide-react";
import { cn } from "../../lib/utils"; // Shadcn utility
import { BrandLogo } from "../ui/BrandLogo";

export interface SidebarProps {
  userPermissions: string[];
  isOwner: boolean;
}

export function Sidebar({ userPermissions, isOwner }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Filter items based on permissions
  const permittedItems = NAVIGATION_CONFIG.filter((item) => {
    if (!item.permission) return true;
    if (isOwner) return true;
    return userPermissions.includes(item.permission);
  }).sort((a, b) => a.order - b.order);

  const renderIcon = (iconName: string) => {
    // Basic mapping for lucide-react (convert kebab-case to PascalCase generally)
    const IconComponent = (Icons as any)[
      iconName.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('')
    ] || Icons.Circle;

    return <IconComponent className="h-5 w-5" />;
  };

  return (
    <aside className={cn("bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 border-r border-slate-800", collapsed ? "w-16" : "w-64", "hidden md:flex h-full")}>
      <div className="h-14 flex items-center justify-between px-4 border-b border-slate-800">
        <div className="flex items-center overflow-hidden">
          {collapsed ? (
            <BrandLogo variant="mark" size="xs" linkToHome />
          ) : (
            <BrandLogo variant="full-dark" size="sm" linkToHome />
          )}
        </div>
        <button onClick={() => setCollapsed(!collapsed)} className="text-slate-400 hover:text-white" aria-label="Toggle Sidebar">
          {collapsed ? <Icons.Menu className="h-5 w-5 mx-auto" /> : <Icons.ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 scrollbar-thin">
        {NAVIGATION_SECTIONS.map((section) => {
          const sectionItems = permittedItems.filter(i => i.section === section.id);
          if (sectionItems.length === 0) return null;

          return (
            <div key={section.id} className="mb-6">
              {!collapsed && (
                <div className="px-4 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {section.label}
                </div>
              )}
              <ul className="space-y-1 px-2">
                {sectionItems.map((item) => {
                  const isActive = pathname.startsWith(item.route);
                  return (
                    <li key={item.route}>
                      <Link
                        href={item.route}
                        className={cn(
                          "flex items-center px-2 py-2 rounded-md transition-colors group",
                          isActive
                            ? "bg-blue-600 text-white"
                            : "hover:bg-slate-800 hover:text-white text-slate-300",
                          collapsed && "justify-center"
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <span className={cn("shrink-0", isActive ? "text-white" : "text-slate-400 group-hover:text-white")}>
                          {renderIcon(item.icon)}
                        </span>
                        {!collapsed && <span className="ml-3 truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
