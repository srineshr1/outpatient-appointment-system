import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTitle } from "@/components/admin/AdminTitle";
import { FilterBar } from "@/components/admin/FilterBar";
import { DownloadIcon } from "@/components/admin/icons";
import { EventTable } from "@/components/admin/tables";
import { AdminField, adminButton, inputClass } from "@/components/admin/ui";
import {
  EVENT_WINDOW,
  loadSnapshot,
  matchesEvent,
  navCounts,
  param,
  queryString,
  readEventFilters,
  type SearchParams,
} from "@/lib/admin-data";
import { noticeText } from "@/lib/admin-notices";
import { requireAdminPage } from "@/lib/admin-page";
import { ACTION_GROUPS, ROLE_LABELS } from "@/lib/audit-labels";
import { pluralise } from "@/lib/format";

export const metadata: Metadata = { title: "Activity" };

const SHOW_AT_MOST = 300;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdminPage("/admin/activity");
  const query = await searchParams;
  const snapshot = await loadSnapshot();
  const filters = readEventFilters(query);
  const events = snapshot.events.filter((event) => matchesEvent(event, filters));

  // Everyone who appears in the log, for the "Who" list.
  const actors = new Map<string, string>();
  for (const event of snapshot.events) {
    const key = event.actorId ?? `name:${event.actorName}`;
    if (!actors.has(key)) actors.set(key, `${event.actorName} (${ROLE_LABELS[event.actorRole] ?? event.actorRole})`);
  }
  const people = [...actors].sort((a, b) => a[1].localeCompare(b[1])).slice(0, 300);

  return (
    <AdminShell
      admin={admin}
      section="activity"
      counts={navCounts(snapshot)}
      notice={noticeText(param(query, "done"))}
    >
      <AdminTitle
        title="Activity"
        today={snapshot.today}
        description="Who did what, and when: sign-ins, bookings, payments and changes to accounts. Nothing here can be edited or deleted."
        actions={
          <a href={`/admin/export${queryString({ kind: "activity", ...filters })}`} className={adminButton("secondary")}>
            <DownloadIcon size={16} />
            Export CSV
          </a>
        }
      />

      <FilterBar action="/admin/activity" label="Filter activity" clearHref="/admin/activity" hidden={{ subject: filters.subject }}>
        <AdminField id="q" label="Find" className="lg:col-span-2">
          <input id="q" name="q" type="search" defaultValue={filters.q} placeholder="A name, email, reference or reason" className={inputClass} />
        </AdminField>
        <AdminField id="group" label="What">
          <select id="group" name="group" defaultValue={filters.group} className={inputClass}>
            <option value="">Everything</option>
            {ACTION_GROUPS.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField id="who" label="Who">
          <select id="who" name="who" defaultValue={filters.who} className={inputClass}>
            <option value="">Anyone</option>
            {people.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField id="from" label="From">
          <input id="from" name="from" type="date" defaultValue={filters.from} className={inputClass} />
        </AdminField>
        <AdminField id="to" label="To" hint="Includes the whole day.">
          <input id="to" name="to" type="date" defaultValue={filters.to} aria-describedby="to-hint" className={inputClass} />
        </AdminField>
      </FilterBar>

      <p className="mt-6 mb-3 text-sm text-ink-2">
        {pluralise(events.length, "event")}, newest first
        {events.length > SHOW_AT_MOST ? `. Showing the newest ${SHOW_AT_MOST}; narrow the filters or export the rest.` : "."}
        {snapshot.events.length >= EVENT_WINDOW ? ` Only the latest ${EVENT_WINDOW} events are searched here.` : ""}
      </p>
      <EventTable events={events.slice(0, SHOW_AT_MOST)} today={snapshot.today} label="Activity" empty="Nothing matches the filters." />
    </AdminShell>
  );
}
