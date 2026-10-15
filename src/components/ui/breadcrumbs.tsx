import Link from "next/link";
import * as Icons from "lucide-react";
import { cn } from "../../lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[], className?: string }) {
  return (
    <nav className={cn("flex", className)} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="flex items-center">
              {index > 0 && <Icons.ChevronRight className="h-4 w-4 text-gray-400 mx-1 shrink-0" />}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="text-sm font-medium text-gray-500 hover:text-gray-700 truncate max-w-[150px] sm:max-w-[200px]"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-sm font-medium text-gray-900 truncate max-w-[150px] sm:max-w-[200px]" aria-current="page">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
