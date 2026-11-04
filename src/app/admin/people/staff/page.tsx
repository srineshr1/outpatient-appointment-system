import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTitle } from "@/components/admin/AdminTitle";
import { FilterBar } from "@/components/admin/FilterBar";
import { UserPlusIcon } from "@/components/admin/icons";
import { TABS } from "@/components/admin/nav";
import {
  AccountBadge,
  AdminField,
  Badge,
  Empty,
  RowLink,
  TableWrap,
  Td,
  Th,
  adminButton,
  inputClass,
  roleText,
  tableClass,
  tbodyClass,
  theadClass,
} from "@/components/admin/ui";
import { loadSnapshot, matchesPerson, navCounts, param, peopleRows, type SearchParams } from "@/lib/admin-data";
import { instantLabel } from "@/lib/admin-format";
import { noticeText } from "@/lib/admin-notices";
import { requireAdminPage } from "@/lib/admin-page";
import type { Role } from "@/lib/clinic-types";
import { pluralise } from "@/lib/format";

export const metadata: Metadata = { title: "Staff" };

const STAFF_ROLES: readonly { role: Role; label: string }[] = [
  { role: "doctor", label: "Doctors" },
  { role: "reception", label: "Reception" },
  { role: "admin", label: "Admins" },
];

const ORDER: Record<string, number> = { admin: 0, doctor: 1, reception: 2 };

export default async function StaffPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdminPage("/admin/people/staff");
  const query = await searchParams;
  const snapshot = await loadSnapshot();
  const q = param(query, "q");
  const role = param(query, "role");
  const all = peopleRows(snapshot).filter((row) => row.user.role !== "patient");
  const rows = all
    .filter((row) => matchesPerson(row, q))
    .filter((row) => (STAFF_ROLES.some((item) => item.role === role) ? row.user.role === role : true))
    .sort((a, b) => {
      // Turned-off accounts last, then admins, doctors and reception, then by name.
      const off = Number(Boolean(a.user.disabledAt)) - Number(Boolean(b.user.disabledAt));
      return off || (ORDER[a.user.role] ?? 9) - (ORDER[b.user.role] ?? 9) || a.user.name.localeCompare(b.user.name);
    });
  const patients = snapshot.users.length - all.length;
  const tabs = (TABS.people ?? []).map((tab) =>
    tab.href === "/admin/people" ? { ...tab, count: patients } : tab.href === "/admin/people/staff" ? { ...tab, count: all.length } : tab,
  );

  return (
    <AdminShell
      admin={admin}
      section="people"
      crumb="Staff"
      tabs={tabs}
      activeTab="/admin/people/staff"
      counts={navCounts(snapshot)}
      notice={noticeText(param(query, "done"))}
    >
      <AdminTitle
        title="Staff"
        today={snapshot.today}
        description="Doctors, reception and admins. Give someone a role, turn an account off, or sign them out everywhere."
        actions={
          <Link href="/admin/people/new" className={adminButton("primary")}>
            <UserPlusIcon size={16} />
            Add staff member
          </Link>
        }
      />

      <FilterBar action="/admin/people/staff" label="Find a staff member" clearHref="/admin/people/staff">
        <AdminField id="q" label="Find" className="lg:col-span-3">
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Name or email" className={inputClass} />
        </AdminField>
        <AdminField id="role" label="Role" className="lg:col-span-2">
          <select id="role" name="role" defaultValue={STAFF_ROLES.some((item) => item.role === role) ? role : ""} className={inputClass}>
            <option value="">Every role</option>
            {STAFF_ROLES.map((item) => (
              <option key={item.role} value={item.role}>
                {item.label}
              </option>
            ))}
          </select>
        </AdminField>
      </FilterBar>

      <p className="mt-6 mb-3 text-sm text-ink-2">{pluralise(rows.length, "staff account")}.</p>
      {rows.length === 0 ? (
        <Empty>No staff match.</Empty>
      ) : (
        <TableWrap label="Staff">
          <table className={tableClass}>
            <caption className="sr-only">Staff accounts</caption>
            <thead className={theadClass}>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th align="right">Signed in on</Th>
                <Th>Last signed in</Th>
                <Th>Account</Th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {rows.map((row) => (
                <tr key={row.user.id} className="hover:bg-[#f9fbfc]">
                  <Td>
                    <RowLink href={`/admin/people/${row.user.id}`}>
                      {row.user.name}
                      {row.user.id === admin.id ? " (you)" : ""}
                    </RowLink>
                    <span className="block text-[13px] break-all text-muted">{row.user.email}</span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {row.user.role === "admin" ? <Badge tone="info">{roleText(row.user)}</Badge> : roleText(row.user)}
                  </Td>
                  <Td align="right">{pluralise(row.sessions, "device")}</Td>
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
