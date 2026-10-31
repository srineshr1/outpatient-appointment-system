import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTitle } from "@/components/admin/AdminTitle";
import { FilterBar } from "@/components/admin/FilterBar";
import { TABS } from "@/components/admin/nav";
import {
  AccountBadge,
  AdminField,
  Empty,
  Money,
  RowLink,
  TableWrap,
  Td,
  Th,
  inputClass,
  tableClass,
  tbodyClass,
  theadClass,
} from "@/components/admin/ui";
import { loadSnapshot, matchesPerson, navCounts, param, peopleRows, type SearchParams } from "@/lib/admin-data";
import { instantLabel } from "@/lib/admin-format";
import { noticeText } from "@/lib/admin-notices";
import { requireAdminPage } from "@/lib/admin-page";
import { formatPhone, pluralise } from "@/lib/format";

export const metadata: Metadata = { title: "Patients" };

export default async function PatientsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdminPage("/admin/people");
  const query = await searchParams;
  const snapshot = await loadSnapshot();
  const q = param(query, "q");
  const status = param(query, "status");
  const all = peopleRows(snapshot).filter((row) => row.user.role === "patient");
  const rows = all
    .filter((row) => matchesPerson(row, q))
    .filter((row) => (status === "off" ? Boolean(row.user.disabledAt) : status === "active" ? !row.user.disabledAt : true))
    .sort((a, b) => b.user.createdAt.localeCompare(a.user.createdAt));
  const staffCount = snapshot.users.length - all.length;
  const tabs = (TABS.people ?? []).map((tab) =>
    tab.href === "/admin/people" ? { ...tab, count: all.length } : tab.href === "/admin/people/staff" ? { ...tab, count: staffCount } : tab,
  );

  return (
    <AdminShell
      admin={admin}
      section="people"
      crumb="Patients"
      tabs={tabs}
      activeTab="/admin/people"
      counts={navCounts(snapshot)}
      notice={noticeText(param(query, "done"))}
    >
      <AdminTitle title="Patients" today={snapshot.today} description="Everyone with a patient account: their visits, what they owe, and when they last signed in." />

      <FilterBar action="/admin/people" label="Find a patient" clearHref="/admin/people">
        <AdminField id="q" label="Find" className="lg:col-span-3">
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Name, email or mobile" className={inputClass} />
        </AdminField>
        <AdminField id="status" label="Account" className="lg:col-span-2">
          <select id="status" name="status" defaultValue={status === "off" || status === "active" ? status : ""} className={inputClass}>
            <option value="">Any</option>
            <option value="active">Active</option>
            <option value="off">Turned off</option>
          </select>
        </AdminField>
      </FilterBar>

      <p className="mt-6 mb-3 text-sm text-ink-2">{pluralise(rows.length, "patient")}.</p>
      {rows.length === 0 ? (
        <Empty>No patients match.</Empty>
      ) : (
        <TableWrap label="Patients">
          <table className={tableClass}>
            <caption className="sr-only">Patients, newest account first</caption>
            <thead className={theadClass}>
              <tr>
                <Th>Name</Th>
                <Th>Mobile</Th>
                <Th align="right">Visits</Th>
                <Th align="right">Owed</Th>
                <Th>Joined</Th>
                <Th>Last signed in</Th>
                <Th>Account</Th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {rows.map((row) => (
                <tr key={row.user.id} className="hover:bg-[#f9fbfc]">
                  <Td>
                    <RowLink href={`/admin/people/${row.user.id}`}>{row.user.name}</RowLink>
                    <span className="block text-[13px] break-all text-muted">{row.user.email}</span>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">{row.user.mobile ? formatPhone(row.user.mobile) : "—"}</Td>
                  <Td align="right">
                    {row.visits}
                    {row.upcoming > 0 ? <span className="block text-[13px] text-muted">{row.upcoming} to come</span> : null}
                  </Td>
                  <Td align="right" className={row.owedPence > 0 ? "font-medium text-[#774b06]" : ""}>
                    <Money pence={row.owedPence} />
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">{instantLabel(row.user.createdAt, snapshot.today)}</Td>
                  <Td className="whitespace-nowrap tabular-nums">{instantLabel(row.lastSeen, snapshot.today)}</Td>
                  <Td>
                    <AccountBadge account={row.user} />
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
