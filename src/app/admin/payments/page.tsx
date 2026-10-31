import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTitle } from "@/components/admin/AdminTitle";
import { FilterBar } from "@/components/admin/FilterBar";
import { DownloadIcon } from "@/components/admin/icons";
import { TABS } from "@/components/admin/nav";
import { LedgerTable } from "@/components/admin/tables";
import { AdminField, Kpis, Money, Panel, RowLink, adminButton, inputClass } from "@/components/admin/ui";
import { dateParam, loadSnapshot, navCounts, param, queryString, type SearchParams } from "@/lib/admin-data";
import { slotLabel } from "@/lib/admin-format";
import { noticeText } from "@/lib/admin-notices";
import { requireAdminPage } from "@/lib/admin-page";
import { PAYMENT_METHODS, isPaymentMethod } from "@/lib/clinic-types";
import { formatMoney } from "@/lib/fees";
import { pluralise } from "@/lib/format";
import { dailyTakings, ledger, londonDay, METHOD_LABELS } from "@/lib/payments";

export const metadata: Metadata = { title: "Payments" };

const SHOW_AT_MOST = 300;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdminPage("/admin/payments");
  const query = await searchParams;
  const snapshot = await loadSnapshot();
  const { today } = snapshot;
  const counts = navCounts(snapshot);

  const method = param(query, "method");
  const kind = param(query, "kind");
  const from = dateParam(query, "from");
  const to = dateParam(query, "to");
  const q = param(query, "q").toLowerCase();
  const visits = new Map(snapshot.visits.map((row) => [row.visit.id, row.visit]));
  const all = ledger(snapshot.charges, visits);
  const rows = all.filter(({ entry, charge, visit }) => {
    if (isPaymentMethod(method) && entry.method !== method) return false;
    if ((kind === "payment" || kind === "refund") && entry.kind !== kind) return false;
    const day = londonDay(entry.at);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (q && !`${charge.reference} ${visit?.patientName ?? ""} ${entry.byName}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const takings = dailyTakings(today, snapshot.charges, snapshot.visits.map((row) => row.visit));
  const owing = snapshot.visits.filter((row) => row.money.duePence > 0);
  const refundsDue = snapshot.visits.filter((row) => row.money.refundDuePence > 0);
  const tabs = (TABS.payments ?? []).map((tab) => (tab.href === "/admin/payments/invoices" ? { ...tab, count: counts.payments } : tab));

  return (
    <AdminShell
      admin={admin}
      section="payments"
      crumb="Payments"
      tabs={tabs}
      activeTab="/admin/payments"
      counts={counts}
      notice={noticeText(param(query, "done"))}
    >
      <AdminTitle
        title="Payments"
        today={today}
        description="Every payment and refund, newest first. Payments in this demo are simulated: no card is charged."
        actions={
          <a href={`/admin/export${queryString({ kind: "payments", method, type: kind, from, to, q: param(query, "q") })}`} className={adminButton("secondary")}>
            <DownloadIcon size={16} />
            Export CSV
          </a>
        }
      />

      <Kpis
        items={[
          { label: "Received today", value: formatMoney(takings.total.receivedPence), sub: pluralise(takings.total.payments, "payment") },
          { label: "Refunded today", value: formatMoney(takings.total.refundedPence), sub: pluralise(takings.total.refunds, "refund") },
          { label: "Net today", value: formatMoney(takings.total.netPence), sub: "Received less refunds" },
          {
            label: "Still owed",
            value: formatMoney(owing.reduce((sum, row) => sum + row.money.duePence, 0)),
            sub: pluralise(owing.length, "visit"),
            tone: owing.length > 0 ? "warn" : undefined,
          },
        ]}
      />

      {refundsDue.length > 0 ? (
        <div className="mt-6">
          <Panel id="refunds-due" title="Refunds to give back" description="Cancelled visits paid at the desk. Online payments are refunded through the payment provider.">
            <ul className="grid gap-2">
              {refundsDue.slice(0, 6).map((row) => (
                <li key={row.visit.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#f3c4c6] px-3 py-2 text-sm">
                  <span>
                    <RowLink href={`/admin/appointments/${row.visit.id}`}>{row.visit.reference}</RowLink>
                    <span className="text-ink-2">
                      {" "}
                      · {row.visit.patientName} · {slotLabel(row.visit.date, row.visit.time, today)}
                    </span>
                  </span>
                  <span className="font-medium text-[#a51c22]">
                    <Money pence={row.money.refundDuePence} /> to give back
                  </span>
                </li>
              ))}
            </ul>
            {refundsDue.length > 6 ? (
              <Link href="/admin/payments/invoices?money=refund_due" className="mt-3 inline-flex min-h-9 items-center text-sm text-accent hover:underline">
                All {refundsDue.length} refunds due
              </Link>
            ) : null}
          </Panel>
        </div>
      ) : null}

      <div className="mt-8">
        <FilterBar action="/admin/payments" label="Filter payments" clearHref="/admin/payments">
          <AdminField id="q" label="Find" className="lg:col-span-2">
            <input id="q" name="q" type="search" defaultValue={param(query, "q")} placeholder="Reference, patient or staff name" className={inputClass} />
          </AdminField>
          <AdminField id="kind" label="Type">
            <select id="kind" name="kind" defaultValue={kind === "payment" || kind === "refund" ? kind : ""} className={inputClass}>
              <option value="">Payments and refunds</option>
              <option value="payment">Payments only</option>
              <option value="refund">Refunds only</option>
            </select>
          </AdminField>
          <AdminField id="method" label="Method">
            <select id="method" name="method" defaultValue={isPaymentMethod(method) ? method : ""} className={inputClass}>
              <option value="">Any method</option>
              {PAYMENT_METHODS.map((item) => (
                <option key={item} value={item}>
                  {METHOD_LABELS[item]}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField id="from" label="From">
            <input id="from" name="from" type="date" defaultValue={from} className={inputClass} />
          </AdminField>
          <AdminField id="to" label="To">
            <input id="to" name="to" type="date" defaultValue={to} className={inputClass} />
          </AdminField>
        </FilterBar>
      </div>

      <p className="mt-6 mb-3 text-sm text-ink-2">
        {pluralise(rows.length, "entry", "entries")}
        {rows.length > SHOW_AT_MOST ? `. Showing the newest ${SHOW_AT_MOST}.` : "."}
      </p>
      <LedgerTable
        rows={rows.slice(0, SHOW_AT_MOST)}
        today={today}
        label="Payments and refunds"
        empty={all.length === 0 ? "No payments yet. They appear when a patient pays online or the desk takes a payment." : "Nothing matches the filters."}
      />
    </AdminShell>
  );
}
