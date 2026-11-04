"use client";

import { PrintIcon } from "@/components/admin/icons";
import { adminButton } from "@/components/admin/ui";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={adminButton("secondary", "print:hidden")}>
      <PrintIcon size={16} />
      {label}
    </button>
  );
}
