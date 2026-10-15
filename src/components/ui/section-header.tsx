import { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, description, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6", className)}>
      <div>
        <h2 className="text-lg font-semibold leading-6 text-gray-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && (
        <div className="mt-4 sm:ml-4 sm:mt-0 flex gap-3">
          {actions}
        </div>
      )}
    </div>
  );
}
