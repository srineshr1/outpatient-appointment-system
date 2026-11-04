import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { requireAdminPage } from "@/lib/admin-page";
import { practice } from "@/lib/data";

export const metadata: Metadata = {
  title: { default: "Admin", template: `%s · Admin · ${practice.shortName}` },
  robots: { index: false, follow: false },
};

/**
 * Defence in depth: the layout refuses anyone who isn't a signed-in admin before a page renders.
 * Each page still checks again (see requireAdminPage) and draws its own shell, so counts stay fresh,
 * and every admin server action and the CSV export check on their own.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const path = (await headers()).get("x-pathname") ?? "/admin";
  await requireAdminPage(path);
  return children;
}
