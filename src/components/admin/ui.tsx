import Link from "next/link";
import type { ReactNode } from "react";
import { ROLE_LABELS } from "@/lib/audit-labels";
import type { AppointmentStatus, UserAccount } from "@/lib/clinic-types";
import { findDoctor } from "@/lib/data";
import { formatMoney } from "@/lib/fees";
import { STATE_LABELS, type PaymentState } from "@/lib/payments";

/* ---------- Badges ---------- */

export type Tone = "success" | "warn" | "danger" | "info" | "neutral";

// Every pair is at least 6.6:1 (WCAG AA needs 4.5:1).
const TONES: Record<Tone, string> = {
  success: "bg-[#e2f1e6] text-[#215631]",
  warn: "bg-[#fff0d5] text-[#774b06]",
  danger: "bg-[#fdeded] text-[#a51c22]",
  info: "bg-[#e8f1fb] text-[#0b4f8a]",
  neutral: "bg-fill text-ink-2",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]}`}>
      {children}
    </span>
  );
}

const PAYMENT_TONES: Record<PaymentState, Tone> = {
  none: "neutral",
  unpaid: "warn",
  part_paid: "warn",
  paid: "success",
  part_refunded: "info",
  refunded: "neutral",
  refund_due: "danger",
  waived: "neutral",
  void: "neutral",
};

export function PaymentBadge({ state }: { state: PaymentState }) {
  return <Badge tone={PAYMENT_TONES[state]}>{STATE_LABELS[state]}</Badge>;
}

const STATUS: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  booked: { label: "Booked", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>;
}

export function roleText(account: Pick<UserAccount, "role" | "doctorId">): string {
  const doctor = account.doctorId ? findDoctor(account.doctorId) : null;
  const label = ROLE_LABELS[account.role] ?? account.role;
  return doctor && account.role === "doctor" ? `${label} · ${doctor.short}’s book` : label;
}

export function AccountBadge({ account }: { account: Pick<UserAccount, "disabledAt"> }) {
  return account.disabledAt ? <Badge tone="danger">Turned off</Badge> : <Badge tone="success">Active</Badge>;
}

/* ---------- Layout ---------- */

export interface KpiItem {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "warn" | "danger";
}

export function Kpis({ items }: { items: readonly KpiItem[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-surface p-4">
          <dt className="text-[13px] font-medium text-muted">{item.label}</dt>
          <dd
            className={`mt-1 text-xl font-semibold tabular-nums ${
              item.tone === "danger" ? "text-[#a51c22]" : item.tone === "warn" ? "text-[#774b06]" : "text-ink"
            }`}
          >
            {item.value}
          </dd>
          {item.sub ? <dd className="mt-0.5 text-[13px] text-muted">{item.sub}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  id,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section aria-labelledby={headingId} className={`min-w-0 rounded-lg border border-hairline bg-surface ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-semibold text-ink">
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function SectionHeading({
  id,
  title,
  count,
  description,
  actions,
}: {
  id: string;
  title: string;
  count?: number;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id={id} className="text-lg font-semibold text-ink">
          {title}
          {count !== undefined ? (
            <span className="ml-2 text-sm font-normal text-muted tabular-nums">
              <span className="sr-only">, </span>
              {count}
            </span>
          ) : null}
        </h2>
        {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-hairline px-4 py-8 text-center text-sm text-muted">{children}</p>;
}

/* ---------- Tables ---------- */

/**
 * A table that can scroll sideways on a phone. Focusable, so keyboard users can scroll it too (WCAG 2.1.1).
 * Inline-size containment keeps a wide table from widening the page around it (WCAG 1.4.10), and
 * `relative` keeps screen-reader-only text (absolutely positioned) inside the box rather than off the page.
 */
export function TableWrap({ label, children }: { label: string; children: ReactNode }) {
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be reachable by keyboard
    <section aria-label={label} tabIndex={0} className="relative overflow-x-auto rounded-lg border border-hairline bg-surface contain-inline-size">
      {children}
    </section>
  );
}

export const tableClass = "w-full border-collapse text-left text-sm";
export const theadClass = "bg-[#f6f8fa] text-[13px] text-ink-2";
export const tbodyClass = "divide-y divide-hairline";

export function Th({ children, align = "left", className = "" }: { children?: ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <th scope="col" className={`px-3 py-2.5 font-medium whitespace-nowrap ${align === "right" ? "text-right" : "text-left"} ${className}`}>
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className = "",
  colSpan,
}: {
  children?: ReactNode;
  align?: "left" | "right";
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`px-3 py-3 align-top ${align === "right" ? "text-right tabular-nums" : ""} ${className}`}>
      {children}
    </td>
  );
}

/** A link in a table row: at least 24px tall (WCAG 2.5.8). */
export function RowLink({ href, children, label }: { href: string; children: ReactNode; label?: string }) {
  return (
    <Link href={href} aria-label={label} className="inline-flex min-h-6 items-center font-medium text-accent hover:underline underline-offset-4">
      {children}
    </Link>
  );
}

export function Money({ pence, signed = false }: { pence: number; signed?: boolean }) {
  return <span className="tabular-nums">{signed && pence > 0 ? `+${formatMoney(pence)}` : formatMoney(pence)}</span>;
}

/* ---------- Buttons and fields ---------- */

export type AdminButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTONS: Record<AdminButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary: "border border-hairline bg-surface text-ink hover:bg-fill",
  danger: "bg-danger text-white hover:bg-[#a51c22]",
  ghost: "text-accent hover:bg-accent-soft",
};

export function adminButton(variant: AdminButtonVariant = "secondary", extra = ""): string {
  return `inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap no-underline transition-colors aria-disabled:cursor-wait aria-disabled:opacity-70 ${BUTTONS[variant]} ${extra}`.trim();
}

export const inputClass =
  "block h-9 w-full rounded-md border border-control bg-surface px-3 text-sm text-ink transition-colors hover:border-ink-2 focus-visible:border-accent";

export const textareaClass =
  "block min-h-20 w-full rounded-md border border-control bg-surface px-3 py-2 text-sm text-ink transition-colors hover:border-ink-2 focus-visible:border-accent";

export function AdminField({
  id,
  label,
  hint,
  children,
  className = "",
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="mt-0.5 text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/** Label and value pairs for a record's details. */
export function Facts({ items }: { items: readonly { term: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.term} className="min-w-0">
          <dt className="text-[13px] font-medium text-muted">{item.term}</dt>
          <dd className="mt-0.5 text-sm break-words text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
