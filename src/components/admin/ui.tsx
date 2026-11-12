import Link from "next/link";
import type { ReactNode } from "react";
import { ROLE_LABELS } from "@/lib/audit-labels";
import type { AppointmentStatus, UserAccount } from "@/lib/clinic-types";
import { findDoctor } from "@/lib/data";
import { formatMoney } from "@/lib/fees";
import { STATE_LABELS, type PaymentState } from "@/lib/payments";

/* ---------- Badges ---------- */

export type Tone = "success" | "warn" | "danger" | "info" | "neutral";

// Every pair exceeds WCAG AA 4.5:1 on the dark surface.
const TONES: Record<Tone, string> = {
  success: "border border-emerald-400/25 bg-emerald-400/12 text-emerald-300",
  warn: "border border-amber-400/25 bg-amber-400/12 text-amber-300",
  danger: "border border-red-400/25 bg-red-400/12 text-red-300",
  info: "border border-cyan-400/25 bg-cyan-400/12 text-cyan-300",
  neutral: "border border-white/10 bg-white/[0.05] text-zinc-300",
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
  pending_payment: { label: "Awaiting payment", tone: "warn" },
  expired: { label: "Hold expired", tone: "neutral" },
  displaced: { label: "Displaced", tone: "warn" },
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
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-surface p-4">
          <dt className="text-[13px] font-medium text-zinc-400">{item.label}</dt>
          <dd
            className={`mt-1 text-xl font-semibold tabular-nums ${
              item.tone === "danger" ? "text-red-300" : item.tone === "warn" ? "text-amber-300" : "text-zinc-50"
            }`}
          >
            {item.value}
          </dd>
          {item.sub ? <dd className="mt-0.5 text-[13px] text-zinc-400">{item.sub}</dd> : null}
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
    <section
      aria-labelledby={headingId}
      className={`min-w-0 rounded-xl border border-hairline bg-surface [box-shadow:inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-semibold text-ink">
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-[13px] text-zinc-400">{description}</p> : null}
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
            <span className="ml-2 text-sm font-normal text-zinc-400 tabular-nums">
              <span className="sr-only">, </span>
              {count}
            </span>
          ) : null}
        </h2>
        {description ? <p className="mt-0.5 text-sm text-zinc-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-hairline bg-surface/50 px-4 py-8 text-center text-sm text-zinc-400">{children}</p>;
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
    <section aria-label={label} tabIndex={0} className="relative overflow-x-auto rounded-xl border border-hairline bg-surface [box-shadow:inset_0_1px_0_rgba(255,255,255,0.04)] contain-inline-size">
      {children}
    </section>
  );
}

export const tableClass = "w-full border-collapse text-left text-sm";
export const theadClass = "bg-zinc-900/90 text-[13px] text-zinc-300 border-b border-hairline";
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
    <Link href={href} aria-label={label} className="inline-flex min-h-6 items-center font-medium text-cyan-300 hover:underline underline-offset-4">
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
  primary:
    "bg-cyan-400 bg-gradient-to-r from-cyan-400 to-blue-500 text-zinc-950 font-semibold hover:from-cyan-300 hover:to-blue-400 shadow-[0_0_14px_rgba(34,211,238,0.2)]",
  secondary: "border border-white/12 bg-white/[0.04] font-medium text-zinc-100 hover:bg-white/[0.08]",
  danger: "bg-red-600 font-medium text-white hover:bg-red-700",
  ghost: "font-medium text-cyan-300 hover:bg-cyan-400/10",
};

export function adminButton(variant: AdminButtonVariant = "secondary", extra = ""): string {
  return `inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm whitespace-nowrap no-underline transition-colors aria-disabled:cursor-wait aria-disabled:opacity-70 ${BUTTONS[variant]} ${extra}`.trim();
}

export const inputClass =
  "block h-9 w-full rounded-md border border-control bg-surface-2 px-3 text-sm text-ink placeholder:text-zinc-400 [color-scheme:dark] transition-colors hover:border-zinc-400 focus-visible:border-cyan-400";

export const textareaClass =
  "block min-h-20 w-full rounded-md border border-control bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-zinc-400 [color-scheme:dark] transition-colors hover:border-zinc-400 focus-visible:border-cyan-400";

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
        <p id={`${id}-hint`} className="mt-0.5 text-[13px] text-zinc-400">
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
          <dt className="text-[13px] font-medium text-zinc-400">{item.term}</dt>
          <dd className="mt-0.5 text-sm break-words text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
