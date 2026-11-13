"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The sign-in page is a focused, full-screen view with no site header or footer.
 * The admin console draws its own sidebar and top bar instead.
 * The landing page (/) has its own floating CardNav, so the upper SiteHeader is hidden.
 */
export function SiteChrome({
  children,
  slot,
}: {
  children: ReactNode;
  slot?: "header" | "footer";
}) {
  const pathname = usePathname();
  if (pathname === "/sign-in" || pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  if (slot === "header" && pathname === "/") return null;
  return <>{children}</>;
}
