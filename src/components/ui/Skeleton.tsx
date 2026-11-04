import type { ReactNode } from "react";

/** A grey placeholder block that pulses while the real content loads. Hidden from screen readers. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-fill-strong motion-reduce:animate-none ${className}`} />;
}

/**
 * Wraps a page's placeholder so assistive technology hears one "Loading" message instead of a
 * wall of empty boxes.
 */
export function LoadingRegion({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
