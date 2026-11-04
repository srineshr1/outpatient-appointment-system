import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTitle } from "@/components/admin/AdminTitle";
import { FilterBar } from "@/components/admin/FilterBar";
import { DownloadIcon } from "@/components/admin/icons";
import { VisitTable } from "@/components/admin/tables";
import { AdminField, adminButton, inputClass } from "@/components/admin/ui";
import {
  filterVisits,
  loadSnapshot,
  navCounts,
  param,
  queryString,
  readVisitFilters,
  visitQuery,
  type SearchParams,
  type WhenFilter,
} from "@/lib/admin-data";
import { noticeText } from "@/lib/admin-notices";
import { requireAdminPage } from "@/lib/admin-page";
import { allDoctors } from "@/lib/data";
import { pluralise } from "@/lib/format";
import { STATE_LABELS } from "@/lib/payments";

export const metadata: Metadata = { title: "Appointments" };

const WHEN_TABS: readonly { when: WhenFilter; label: string }[] = [
  { when: "upcoming", label: "Upcoming" },
  { when: "today", label: "Today" },
  { when: "past", label: "Past" },
  { when: "all", label: "All" },
];

/** More than this and the list asks you to narrow it. */
const SHOW_AT_MOST = 300;

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdminPage("/admin/appointments");
  const query = await searchParams;
  const snapshot = await loadSnapshot();
  const filters = readVisitFilters(query);
  const rows = filterVisits(snapshot.visits, filters, snapshot.today);
  // Upcoming reads soonest first; the past reads latest first.
  const ordered = filters.when === "past" || filters.when === "all" ? [...rows].reverse() : rows;
  const shown = ordered.slice(0, SHOW_AT_MOST);
  const others = { ...visitQuery(filters), when: "" };

  const tabs = WHEN_TABS.map((tab) => ({
    href: `/admin/appointments${queryString({ ...others, when: tab.when === "upcoming" ? "" : tab.when })}`,
    label: tab.label,
    count: filterVisits(snapshot.visits, { ...filters, when: tab.when }, snapshot.today).length,
    when: tab.when,
  }));
  const activeTab = tabs.find((tab) => tab.when === filters.when)?.href;
  const narrowed = Boolean(filters.q || filters.doctor || filters.status || filters.money || filters.from || filters.to);

  return (
    <AdminShell
      admin={admin}
      section="appointments"
      crumb={WHEN_TABS.find((tab) => tab.when === filters.when)?.label}
      tabs={tabs}
      activeTab={activeTab}
      counts={navCounts(snapshot)}
      notice={noticeText(param(query, "done"))}
    >
      <AdminTitle
        title="Appointments"
        today={snapshot.today}
        description="Every visit booked online, with its payment. Open one to complete it, cancel it or take payment."
        actions={
          <a href={`/admin/export${queryString({ kind: "appointments", ...visitQuery(filters) })}`} className={adminButton("secondary")}>
            <DownloadIcon size={16} />
            Export CSV
          </a>
        }
      />

      <FilterBar
        action="/admin/appointments"
        label="Filter appointments"
        clearHref={`/admin/appointments${queryString({ when: filters.when === "upcoming" ? "" : filters.when })}`}
        hidden={{ when: filters.when === "upcoming" ? "" : filters.when }}
      >
        <AdminField id="q" label="Find" className="lg:col-span-2">
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Name, reference, email, CHI or mobile"
            className={inputClass}
          />
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
        <AdminField id="status" label="Visit">
          <select id="status" name="status" defaultValue={filters.status} className={inputClass}>
            <option value="">Any status</option>
            <option value="booked">Booked</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
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
        <AdminField id="from" label="From">
          <input id="from" name="from" type="date" defaultValue={filters.from} className={inputClass} />
        </AdminField>
        <AdminField id="to" label="To">
          <input id="to" name="to" type="date" defaultValue={filters.to} className={inputClass} />
        </AdminField>
      </FilterBar>

      <p className="mt-6 mb-3 text-sm text-ink-2">
        {pluralise(rows.length, "visit")}
        {narrowed ? " match the filters" : ""}
        {rows.length > shown.length ? `. Showing the first ${shown.length}; narrow the filters to see the rest.` : "."}
      </p>
      <VisitTable rows={shown} today={snapshot.today} label="Appointments" empty="No visits match. Try another tab or clear the filters." />
    </AdminShell>
  );
}
