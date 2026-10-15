import { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, breadcrumbs, className }: PageHeaderProps) {
  return (
    <div className={cn("bg-white border-b border-gray-200 px-6 py-5 shrink-0", className)}>
      {breadcrumbs && <div className="mb-4">{breadcrumbs}</div>}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate tracking-tight">{title}</h1>
          {description && (
            <div className="mt-1 text-sm text-gray-500">{description}</div>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
