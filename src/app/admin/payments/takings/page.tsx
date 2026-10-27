import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTitle, longDate } from "@/components/admin/AdminTitle";
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from "@/components/admin/icons";
import { TABS } from "@/components/admin/nav";
import { PrintButton } from "@/components/admin/PrintButton";
import { LedgerTable } from "@/components/admin/tables";
import { Kpis, Money, Panel, SectionHeading, TableWrap, Td, Th, adminButton, tableClass, tbodyClass, theadClass } from "@/components/admin/ui";
import { dateParam, loadSnapshot, navCounts, param, type SearchParams } from "@/lib/admin-data";
import { noticeText } from "@/lib/admin-notices";
import { requireAdminPage } from "@/lib/admin-page";
import { PAYMENT_METHODS } from "@/lib/clinic-types";
import { addDays } from "@/lib/clock";
import { formatMoney } from "@/lib/fees";
import { pluralise } from "@/lib/format";
import { dailyTakings, METHOD_LABELS, type TakingsLine } from "@/lib/payments";

export const metadata: Metadata = { title: "Daily takings" };

function TakingsTable({ label, first, lines, total }: { label: string; first: string; lines: readonly TakingsLine[]; total: TakingsLine }) {
  return (
    <TableWrap label={label}>
      <table className={tableClass}>
        <caption className="sr-only">{label}</caption>
        <thead className={theadClass}>
          <tr>
            <Th>{first}</Th>
            <Th align="right">Payments</Th>
            <Th align="right">Received</Th>
            <Th align="right">Refunds</Th>
            <Th align="right">Net</Th>
          </tr>
        </thead>
        <tbody className={tbodyClass}>
          {lines.map((line) => (
            <tr key={line.key}>
              <Td className="font-medium">{line.label}</Td>
              <Td align="right">{line.payments}</Td>
              <Td align="right">
                <Money pence={line.receivedPence} />
              </Td>
              <Td align="right">
                {line.refundedPence > 0 ? <Money pence={-line.refundedPence} /> : <Money pence={0} />}
                {line.refunds > 0 ? <span className="block text-[13px] text-muted">{pluralise(line.refunds, "refund")}</span> : null}
              </Td>
              <Td align="right" className="font-medium">
                <Money pence={line.netPence} />
              </Td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-hairline bg-[#f6f8fa] font-semibold">
          <tr>
            <Td>Total</Td>
            <Td align="right">{total.payments}</Td>
            <Td align="right">
              <Money pence={total.receivedPence} />
            </Td>
            <Td align="right">{total.refundedPence > 0 ? <Money pence={-total.refundedPence} /> : <Money pence={0} />}</Td>
            <Td align="right">
              <Money pence={total.netPence} />
            </Td>
          </tr>
        </tfoot>
      </table>
    </TableWrap>
  );
}

export default async function TakingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdminPage("/admin/payments/takings");
  const query = await searchParams;
  const snapshot = await loadSnapshot();
  const { today } = snapshot;
  const requested = dateParam(query, "date");
  // No future days: nothing has been taken yet.
  const date = requested && requested <= today ? requested : today;
  const report = dailyTakings(date, snapshot.charges, snapshot.visits.map((row) => row.visit));
  const counts = navCounts(snapshot);
  const tabs = (TABS.payments ?? []).map((tab) => (tab.href === "/admin/payments/invoices" ? { ...tab, count: counts.payments } : tab));
  const previous = addDays(date, -1);
  const next = addDays(date, 1);

  return (
    <AdminShell
      admin={admin}
      section="payments"
      crumb="Daily takings"
      tabs={tabs}
      activeTab="/admin/payments/takings"
      counts={counts}
      notice={noticeText(param(query, "done"))}
    >
      <AdminTitle
        title="Daily takings"
        today={today}
        description="What came in and went out on one day, by method, doctor and member of staff."
        actions={
          <>
            <PrintButton />
            <a href={`/admin/export?kind=takings&date=${date}`} className={adminButton("secondary")}>
              <DownloadIcon size={16} />
              Export CSV
            </a>
          </>
        }
      />

      <nav aria-label="Choose a day" className="mb-6 flex items-center gap-2 print:hidden">
        <Link href={`/admin/payments/takings?date=${previous}`} className={adminButton("secondary", "px-2")}>
          <ChevronLeftIcon size={16} />
          <span className="sr-only">Previous day, {longDate(previous)}</span>
        </Link>
        <p className="min-w-44 text-center text-base font-medium text-ink" aria-live="polite">
          {longDate(date)}
          {date === today ? " (today)" : ""}
        </p>
        {date < today ? (
          <Link href={`/admin/payments/takings?date=${next}`} className={adminButton("secondary", "px-2")}>
            <ChevronRightIcon size={16} />
            <span className="sr-only">Next day, {longDate(next)}</span>
          </Link>
        ) : (
          <span aria-hidden="true" className={adminButton("secondary", "px-2 opacity-40")}>
            <ChevronRightIcon size={16} />
          </span>
        )}
        {date !== today ? (
          <Link href="/admin/payments/takings" className={adminButton("ghost")}>
            Today
          </Link>
        ) : null}
      </nav>
      <p className="mb-4 hidden text-base font-medium print:block">{longDate(date)}</p>

      <Kpis
        items={[
          { label: "Net taken", value: formatMoney(report.total.netPence), sub: "Received less refunds" },
          { label: "Received", value: formatMoney(report.total.receivedPence), sub: pluralise(report.total.payments, "payment") },
          { label: "Refunds", value: formatMoney(report.total.refundedPence), sub: pluralise(report.total.refunds, "refund") },
          { label: "Visits seen", value: report.visitsSeen, sub: "Marked complete that day" },
        ]}
      />

      <section aria-labelledby="by-method" className="mt-8 grid gap-3">
        <SectionHeading id="by-method" title="By payment method" />
        <TakingsTable label="Takings by payment method" first="Method" lines={report.byMethod} total={report.total} />
      </section>

      <section aria-labelledby="by-doctor" className="mt-8 grid gap-3">
        <SectionHeading id="by-doctor" title="By doctor" description="Net taken for each doctor’s visits, by method." />
        {report.byDoctor.length === 0 ? (
          <p className="text-sm text-muted">Nothing taken on this day.</p>
        ) : (
          <TableWrap label="Takings by doctor">
            <table className={tableClass}>
              <caption className="sr-only">Net takings by doctor and method</caption>
              <thead className={theadClass}>
                <tr>
                  <Th>Doctor</Th>
                  {PAYMENT_METHODS.map((method) => (
                    <Th key={method} align="right">
                      {METHOD_LABELS[method]}
                    </Th>
                  ))}
                  <Th align="right">Net</Th>
                </tr>
              </thead>
              <tbody className={tbodyClass}>
                {report.byDoctor.map((line) => (
                  <tr key={line.key}>
                    <Td className="font-medium whitespace-nowrap">{line.label}</Td>
                    {PAYMENT_METHODS.map((method) => (
                      <Td key={method} align="right">
                        <Money pence={line.netByMethod[method]} />
                      </Td>
                    ))}
                    <Td align="right" className="font-medium">
                      <Money pence={line.netPence} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </section>

      <section aria-labelledby="by-staff" className="mt-8 grid gap-3">
        <SectionHeading id="by-staff" title="By member of staff" description="Who took each payment or gave each refund. Online covers the patient’s demo card." />
        {report.byStaff.length === 0 ? (
          <p className="text-sm text-muted">Nothing taken on this day.</p>
        ) : (
          <TakingsTable label="Takings by member of staff" first="Taken by" lines={report.byStaff} total={report.total} />
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel id="drawer" title="Cash drawer" description="Count the drawer against what was recorded.">
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">Cash received</dt>
              <dd className="tabular-nums">
                <Money pence={report.byMethod.find((line) => line.key === "cash")?.receivedPence ?? 0} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">Cash given back</dt>
              <dd className="tabular-nums">
                <Money pence={-(report.byMethod.find((line) => line.key === "cash")?.refundedPence ?? 0)} />
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-hairline pt-2 font-semibold">
              <dt>Expected in the drawer</dt>
              <dd className="tabular-nums">
                <Money pence={report.cashExpectedPence} />
              </dd>
            </div>
          </dl>
        </Panel>
        <Panel id="about" title="About these figures">
          <ul className="grid list-disc gap-1.5 pl-5 text-sm text-ink-2">
            <li>Days run midnight to midnight, UK time.</li>
            <li>A refund counts on the day it’s given, even for a payment taken earlier.</li>
            <li>Online card payments are a demo. Nothing is charged and nothing settles to a bank.</li>
          </ul>
        </Panel>
      </div>

      <section aria-labelledby="day-entries" className="mt-8 grid gap-3">
        <SectionHeading id="day-entries" title="Every payment and refund" count={report.rows.length} />
        <LedgerTable rows={report.rows} today={today} label="Payments and refunds on this day" empty="Nothing taken or refunded on this day." />
      </section>
    </AdminShell>
  );
}
