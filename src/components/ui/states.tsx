import * as Icons from "lucide-react";
import { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface EmptyStateProps {
  icon?: keyof typeof Icons;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon = "FolderOpen", title, description, action, className }: EmptyStateProps) {
  const IconComponent = Icons[icon] as React.ElementType || Icons.FolderOpen;

  return (
    <div className={cn("text-center py-12 px-4 sm:px-6 lg:px-8 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/50", className)}>
      <IconComponent className="mx-auto h-12 w-12 text-gray-400 mb-4" />
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// --- LoadingState.tsx ---
export function LoadingState({ message = "Loading...", className }: { message?: string, className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-12 text-gray-500", className)}>
      <Icons.Loader2 className="h-8 w-8 animate-spin mb-4 text-blue-600" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

// --- ErrorState.tsx ---
export function ErrorState({ title = "Something went wrong", message = "An error occurred while loading this content.", onRetry, className }: { title?: string, message?: string, onRetry?: () => void, className?: string }) {
  return (
    <div className={cn("text-center py-12 px-4 border border-red-200 rounded-lg bg-red-50", className)}>
      <Icons.AlertTriangle className="mx-auto h-12 w-12 text-red-400 mb-4" />
      <h3 className="text-sm font-semibold text-red-800">{title}</h3>
      <p className="mt-1 text-sm text-red-600 max-w-sm mx-auto">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-6 inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 transition-colors">
          Try again
        </button>
      )}
    </div>
  );
}
