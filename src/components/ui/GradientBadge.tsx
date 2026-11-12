import type { ReactNode } from "react";

export function GradientBadge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-caption font-semibold text-cyan-300 shadow-[inset_0_1px_0_rgba(34,211,238,0.15)] ${className}`.trim()}
    >
      {children}
    </span>
  );
}
