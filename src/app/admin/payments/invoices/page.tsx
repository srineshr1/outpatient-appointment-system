import type { Metadata } from "next";
import { isClosedStatus } from "@/lib/clinic-types";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTitle } from "@/components/admin/AdminTitle";
import { FilterBar } from "@/components/admin/FilterBar";
import { DownloadIcon } from "@/components/admin/icons";
import { TABS } from "@/components/admin/nav";
import {
  AdminField,
  Empty,
  Kpis,
  Money,
  PaymentBadge,
  RowLink,
  TableWrap,
  Td,
  Th,
  adminButton,
  inputClass,
  tableClass,
  tbodyClass,
  theadClass,
} from "@/components/admin/ui";
import {
  filterVisits,
  loadSnapshot,
  navCounts,
  param,
  queryString,
  readVisitFilters,
  visitQuery,
  type SearchParams,
} from "@/lib/admin-data";
import { slotLabel } from "@/lib/admin-format";
import { noticeText } from "@/lib/admin-notices";
import { requireAdminPage } from "@/lib/admin-page";
import { findDoctor, allDoctors } from "@/lib/data";
import { formatMoney } from "@/lib/fees";
import { pluralise } from "@/lib/format";
import { STATE_LABELS } from "@/lib/payments";

export const metadata: Metadata = { title: "Visit fees" };

const SHOW_AT_MOST = 300;

export default async function VisitFeesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdminPage("/admin/payments/invoices");
  const query = await searchParams;
  const snapshot = await loadSnapshot();
  const { today } = snapshot;
  const counts = navCounts(snapshot);
  const filters = readVisitFilters(query, "all");
  const rows = [...filterVisits(snapshot.visits, filters, today)].reverse();

  const charged = snapshot.visits.filter((row) => row.charge && !isClosedStatus(row.visit.status) && !row.charge.waiver);
  const billed = charged.reduce((sum, row) => sum + (row.charge?.amountPence ?? 0), 0);
  const collected = snapshot.visits.reduce((sum, row) => sum + row.money.netPence, 0);
  const owed = snapshot.visits.reduce((sum, row) => sum + row.money.duePence, 0);
  const refundsDue = snapshot.visits.filter((row) => row.money.refundDuePence > 0);
  const tabs = (TABS.payments ?? []).map((tab) => (tab.href === "/admin/payments/invoices" ? { ...tab, count: counts.payments } : tab));

  return (
    <AdminShell
      admin={admin}
      section="payments"
      crumb="Visit fees"
      tabs={tabs}
      activeTab="/admin/payments/invoices"
      counts={counts}
      notice={noticeText(param(query, "done"))}
    >
      <AdminTitle
        title="Visit fees"
        today={today}
        description="The fee for each visit, set when it was booked, and how much of it has been paid."
        actions={
          <a href={`/admin/export${queryString({ kind: "fees", ...visitQuery(filters) })}`} className={adminButton("secondary")}>
            <DownloadIcon size={16} />
            Export CSV
          </a>
        }
      />

      <Kpis
        items={[
          { label: "Fees charged", value: formatMoney(billed), sub: `${pluralise(charged.length, "visit")}, not cancelled or waived` },
          { label: "Collected", value: formatMoney(collected), sub: "Paid less refunds, all time" },
          { label: "Still owed", value: formatMoney(owed), sub: "By visits not cancelled", tone: owed > 0 ? "warn" : undefined },
          {
            label: "Refunds due",
            value: formatMoney(refundsDue.reduce((sum, row) => sum + row.money.refundDuePence, 0)),
            sub: pluralise(refundsDue.length, "visit"),
            tone: refundsDue.length > 0 ? "danger" : undefined,
          },
        ]}
      />

      <div className="mt-8">
        <FilterBar action="/admin/payments/invoices" label="Filter visit fees" clearHref="/admin/payments/invoices">
          <AdminField id="q" label="Find" className="lg:col-span-2">
            <input id="q" name="q" type="search" defaultValue={filters.q} placeholder="Name, reference or email" className={inputClass} />
          </AdminField>
          <AdminField id="money" label="Payment">
            <select id="money" name="money" defaultValue={filters.money} className={inputClass}>
              <option value="">Any</option>
              <option value="owed">Still owes money</option>
              {(Object.keys(STATE_LABELS) as (keyof typeof STATE_LABELS)[]).map((state) => (
                <option key={state} value={state}>
                  {STATE_LABELS[state]}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField id="doctor" label="Doctor">
            <select id="doctor" name="doctor" defaultValue={filters.doctor} className={inputClass}>
              <option value="">Every doctor</option>
              {allDoctors().map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField id="when" label="Visit date">
            <select id="when" name="when" defaultValue={filters.when} className={inputClass}>
              <option value="all">Any time</option>
              <option value="past">Before today</option>
              <option value="today">Today</option>
              <option value="upcoming">Today and later</option>
            </select>
          </AdminField>
        </FilterBar>
      </div>

      <p className="mt-6 mb-3 text-sm text-ink-2">
        {pluralise(rows.length, "visit")}
        {rows.length > SHOW_AT_MOST ? `. Showing the latest ${SHOW_AT_MOST}.` : "."}
      </p>
      {rows.length === 0 ? (
        <Empty>No visits match the filters.</Empty>
      ) : (
        <TableWrap label="Visit fees">
          <table className={tableClass}>
            <caption className="sr-only">Visit fees, latest visit first</caption>
            <thead className={theadClass}>
              <tr>
                <Th>Reference</Th>
                <Th>Patient</Th>
                <Th>Visit</Th>
                <Th align="right">Fee</Th>
                <Th align="right">Paid</Th>
                <Th align="right">Refunded</Th>
                <Th align="right">Owed</Th>
                <Th>State</Th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {rows.slice(0, SHOW_AT_MOST).map((row) => (
                <tr key={row.visit.id} className="hover:bg-[#f9fbfc]">
                  <Td className="whitespace-nowrap">
                    <RowLink href={`/admin/appointments/${row.visit.id}`}>{row.visit.reference}</RowLink>
                  </Td>
                  <Td>{row.visit.patientName}</Td>
                  <Td className="whitespace-nowrap">
                    <span className="tabular-nums">{slotLabel(row.visit.date, row.visit.time, today)}</span>
                    <span className="block text-[13px] text-muted">{findDoctor(row.visit.doctorId)?.short}</span>
                  </Td>
                  <Td align="right">{row.charge ? <Money pence={row.charge.amountPence} /> : "—"}</Td>
                  <Td align="right">
                    <Money pence={row.money.paidPence} />
                  </Td>
                  <Td align="right">
                    <Money pence={row.money.refundedPence} />
                  </Td>
                  <Td align="right" className={row.money.duePence > 0 ? "font-medium text-[#774b06]" : ""}>
                    <Money pence={row.money.duePence} />
                  </Td>
                  <Td>
                    <PaymentBadge state={row.money.state} />
                    {row.money.refundDuePence > 0 ? (
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
      )}
    </AdminShell>
  );
}
