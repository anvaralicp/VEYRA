import { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface ContentContainerProps {
  children: ReactNode;
  className?: string;
}

export function ContentContainer({ children, className }: ContentContainerProps) {
  return (
    <div className={cn("max-w-7xl mx-auto w-full", className)}>
      {children}
    </div>
  );
}
