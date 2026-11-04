import Link from "next/link";
import {
  Badge,
  Empty,
  Money,
  PaymentBadge,
  RowLink,
  StatusBadge,
  TableWrap,
  Td,
  Th,
  tableClass,
  tbodyClass,
  theadClass,
} from "@/components/admin/ui";
import type { VisitRow } from "@/lib/admin-data";
import { instantLabel, slotLabel } from "@/lib/admin-format";
import { actionLabel, ROLE_LABELS } from "@/lib/audit-labels";
import type { AuditEvent } from "@/lib/clinic-types";
import { findDoctor } from "@/lib/data";
import { METHOD_LABELS, type LedgerRow } from "@/lib/payments";

function doctorShort(id: string): string {
  return findDoctor(id)?.short ?? "Unknown doctor";
}

export function VisitTable({
  rows,
  today,
  label,
  empty,
  showDate = true,
}: {
  rows: readonly VisitRow[];
  today: string;
  label: string;
  empty: string;
  showDate?: boolean;
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <TableWrap label={label}>
      <table className={tableClass}>
        <caption className="sr-only">{label}</caption>
        <thead className={theadClass}>
          <tr>
            <Th>{showDate ? "When" : "Time"}</Th>
            <Th>Patient</Th>
            <Th>Doctor</Th>
            <Th>Reason</Th>
            <Th>Visit</Th>
            <Th align="right">Fee</Th>
            <Th>Payment</Th>
          </tr>
        </thead>
        <tbody className={tbodyClass}>
          {rows.map((row) => (
            <tr key={row.visit.id} className="hover:bg-[#f9fbfc]">
              <Td className="whitespace-nowrap tabular-nums">
                {showDate ? slotLabel(row.visit.date, row.visit.time, today) : row.visit.time}
              </Td>
              <Td>
                <RowLink href={`/admin/appointments/${row.visit.id}`}>{row.visit.patientName}</RowLink>
                <span className="block text-[13px] text-muted tabular-nums">{row.visit.reference}</span>
              </Td>
              <Td className="whitespace-nowrap">{doctorShort(row.visit.doctorId)}</Td>
              <Td className="min-w-36">{row.reasonLabel}</Td>
              <Td>
                <StatusBadge status={row.visit.status} />
              </Td>
              <Td align="right">{row.charge ? <Money pence={row.charge.amountPence} /> : "—"}</Td>
              <Td>
                <PaymentBadge state={row.money.state} />
                {row.money.duePence > 0 ? (
                  <span className="block text-[13px] text-muted">
                    <Money pence={row.money.duePence} /> owed
                  </span>
                ) : row.money.refundDuePence > 0 ? (
                  <span className="block text-[13px] text-muted">
                    <Money pence={row.money.refundDuePence} /> to give back
                  </span>
                ) : null}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

export function LedgerTable({ rows, today, label, empty }: { rows: readonly LedgerRow[]; today: string; label: string; empty: string }) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <TableWrap label={label}>
      <table className={tableClass}>
        <caption className="sr-only">{label}</caption>
        <thead className={theadClass}>
          <tr>
            <Th>When</Th>
            <Th>Visit</Th>
            <Th>Patient</Th>
            <Th>Type</Th>
            <Th>Method</Th>
            <Th align="right">Amount</Th>
            <Th>By</Th>
          </tr>
        </thead>
        <tbody className={tbodyClass}>
          {rows.map(({ entry, charge, visit }) => (
            <tr key={entry.id} className="hover:bg-[#f9fbfc]">
              <Td className="whitespace-nowrap tabular-nums">{instantLabel(entry.at, today)}</Td>
              <Td className="whitespace-nowrap">
                <RowLink href={`/admin/appointments/${charge.appointmentId}`}>{charge.reference}</RowLink>
              </Td>
              <Td>{visit?.patientName ?? "Visit not found"}</Td>
              <Td>
                {entry.kind === "payment" ? <Badge tone="success">Payment</Badge> : <Badge tone="info">Refund</Badge>}
                {entry.note ? <span className="mt-1 block max-w-64 text-[13px] text-muted">{entry.note}</span> : null}
              </Td>
              <Td className="whitespace-nowrap">{METHOD_LABELS[entry.method]}</Td>
              <Td align="right" className={entry.kind === "refund" ? "text-[#a51c22]" : ""}>
                <Money pence={entry.kind === "refund" ? -entry.amountPence : entry.amountPence} />
              </Td>
              <Td className="whitespace-nowrap">{entry.byName || "—"}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

function subjectHref(event: AuditEvent): string | null {
  if (!event.subjectId) return null;
  if (event.subjectType === "appointment") return `/admin/appointments/${event.subjectId}`;
  if (event.subjectType === "user" || event.subjectType === "session") return `/admin/people/${event.subjectId}`;
  return null;
}

export function EventTable({ events, today, label, empty }: { events: readonly AuditEvent[]; today: string; label: string; empty: string }) {
  if (events.length === 0) return <Empty>{empty}</Empty>;
  return (
    <TableWrap label={label}>
      <table className={tableClass}>
        <caption className="sr-only">{label}</caption>
        <thead className={theadClass}>
          <tr>
            <Th className="w-40">When</Th>
            <Th>What</Th>
            <Th className="w-56">Who</Th>
          </tr>
        </thead>
        <tbody className={tbodyClass}>
          {events.map((event) => {
            const href = subjectHref(event);
            return (
              <tr key={event.id} className="hover:bg-[#f9fbfc]">
                <Td className="whitespace-nowrap tabular-nums">{instantLabel(event.at, today)}</Td>
                <Td>
                  <span className="font-medium text-ink">{actionLabel(event.action)}</span>
                  <code className="ml-2 font-mono text-xs text-muted">{event.action}</code>
                  <span className="mt-0.5 block text-ink-2">
                    {href ? (
                      <Link href={href} className="hover:underline underline-offset-4">
                        {event.summary}
                      </Link>
                    ) : (
                      event.summary
                    )}
                  </span>
                  {event.reason ? (
                    <span className="mt-1 block text-[13px] text-ink-2">
                      <span className="font-medium">Reason given:</span> {event.reason}
                    </span>
                  ) : null}
                </Td>
                <Td>
                  {event.actorId ? (
                    <Link href={`/admin/people/${event.actorId}`} className="font-medium text-ink hover:underline underline-offset-4">
                      {event.actorName}
                    </Link>
                  ) : (
                    <span className="font-medium text-ink break-all">{event.actorName}</span>
                  )}
                  <span className="block text-[13px] text-muted">{ROLE_LABELS[event.actorRole] ?? event.actorRole}</span>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableWrap>
  );
}
