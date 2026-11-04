"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The sign-in page is a focused, full-screen view with no site header or footer.
 * The admin console draws its own sidebar and top bar instead.
 */
export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/sign-in" || pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  return <>{children}</>;
}
