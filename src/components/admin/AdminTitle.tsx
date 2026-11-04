import type { ReactNode } from "react";
import { PageHeading } from "@/components/shell/PageHeading";
import { dayOfMonth, yearOf } from "@/lib/clock";
import { practice } from "@/lib/data";
import { monthShort, weekdayShort } from "@/lib/format";

/** "Tue 27 Oct 2026" */
export function longDate(iso: string): string {
  return `${weekdayShort(iso)} ${dayOfMonth(iso)} ${monthShort(iso)} ${yearOf(iso)}`;
}

export function AdminTitle({
  title,
  today,
  description,
  actions,
}: {
  title: ReactNode;
  today: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <PageHeading className="text-2xl font-semibold tracking-tight text-ink">{title}</PageHeading>
        <p className="mt-1 text-sm text-muted">
          {practice.name} · {longDate(today)} · times in UK time
        </p>
        {description ? <p className="mt-2 max-w-2xl text-sm text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div> : null}
    </div>
  );
}
