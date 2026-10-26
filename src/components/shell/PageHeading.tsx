"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

let hasNavigated = false;

/** Whether this render follows a client-side navigation (not the first page load). */
export function useIsNavigation(): boolean {
  const [value] = useState(() => hasNavigated);
  useEffect(() => {
    hasNavigated = true;
  }, []);
  return value;
}

/**
 * The page's h1. After a client-side navigation it takes focus, so screen-reader
 * and keyboard users land at the top of the new step instead of on a stale button.
 */
export function PageHeading({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const navigated = useIsNavigation();

  useEffect(() => {
    if (navigated) ref.current?.focus({ preventScroll: true });
  }, [navigated]);

  return (
    <h1 ref={ref} tabIndex={-1} className={`scroll-mt-32 outline-none ${className}`}>
      {children}
    </h1>
  );
}
