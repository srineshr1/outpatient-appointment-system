import type { Metadata } from "next";
import type { ReactNode } from "react";
import { practice } from "@/lib/data";

export const metadata: Metadata = {
  title: { default: "Admin", template: `%s · Admin · ${practice.shortName}` },
  robots: { index: false, follow: false },
};

/** Each page checks the admin itself (see requireAdminPage) and draws its own shell, so counts stay fresh. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
