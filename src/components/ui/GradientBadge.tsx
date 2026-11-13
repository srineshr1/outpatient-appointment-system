import type { ReactNode } from "react";

export function GradientBadge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-2 px-3 py-1 text-caption font-medium text-ink-2 ${className}`.trim()}
    >
      {children}
    </span>
  );
}
