import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import { adminButton } from "@/components/admin/ui";

/**
 * Filters as a plain GET form: the choices live in the address, so a filtered list can be
 * bookmarked or shared, and it works before JavaScript loads.
 */
export function FilterBar({
  action,
  label,
  clearHref,
  hidden,
  children,
}: {
  action: string;
  label: string;
  clearHref: string;
  /** Values to keep, such as the tab you're on. */
  hidden?: Record<string, string>;
  children: ReactNode;
}) {
  return (
    <search aria-label={label} className="block print:hidden">
      <Form action={action} className="rounded-xl border border-hairline bg-surface p-4 [box-shadow:inset_0_1px_0_rgba(255,255,255,0.04)]">
        {Object.entries(hidden ?? {}).map(([name, value]) =>
          value ? <input key={name} type="hidden" name={name} value={value} /> : null,
        )}
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {children}
          <div className="flex gap-2 lg:col-span-1">
            <button type="submit" className={adminButton("primary", "flex-1")}>
              Apply
            </button>
            <Link href={clearHref} className={adminButton("secondary")}>
              Clear
            </Link>
          </div>
        </div>
      </Form>
    </search>
  );
}
