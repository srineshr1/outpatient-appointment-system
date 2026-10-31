import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTitle } from "@/components/admin/AdminTitle";
import { JUMP_TARGETS } from "@/components/admin/nav";
import { VisitTable } from "@/components/admin/tables";
import { AccountBadge, Empty, RowLink, SectionHeading, TableWrap, Td, Th, adminButton, inputClass, roleText, tableClass, tbodyClass, theadClass } from "@/components/admin/ui";
import { loadSnapshot, matchesPerson, matchesVisit, navCounts, param, peopleRows, type SearchParams } from "@/lib/admin-data";
import { requireAdminPage } from "@/lib/admin-page";
import { pluralise } from "@/lib/format";
import Form from "next/form";

export const metadata: Metadata = { title: "Search" };

const LIMIT = 50;

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdminPage("/admin/search");
  const query = await searchParams;
  const q = param(query, "q");
  const snapshot = await loadSnapshot();
  const visits = q ? [...snapshot.visits.filter((row) => matchesVisit(row, q))].reverse() : [];
  const people = q ? peopleRows(snapshot).filter((row) => matchesPerson(row, q)) : [];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const pages = q
    ? JUMP_TARGETS.filter((target) => words.every((word) => `${target.label} ${target.keywords}`.toLowerCase().includes(word)))
    : [];

  return (
    <AdminShell admin={admin} section="overview" crumb="Search" counts={navCounts(snapshot)}>
      <AdminTitle title={q ? `Results for “${q}”` : "Search"} today={snapshot.today} />

      <search aria-label="Search the console" className="mb-8 block max-w-xl">
        <Form action="/admin/search" className="flex gap-2">
          <label htmlFor="search-q" className="sr-only">
            Search
          </label>
          <input
            id="search-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="A patient’s name, a reference, an email, a CHI or mobile number"
            className={inputClass}
          />
          <button type="submit" className={adminButton("primary")}>
            Search
          </button>
        </Form>
      </search>

      {!q ? (
        <Empty>Type a name, a booking reference such as HSP-482913, an email, or at least 4 digits of a CHI or mobile number.</Empty>
      ) : (
        <div className="grid gap-10">
          {pages.length > 0 ? (
            <section aria-labelledby="pages-title" className="grid gap-3">
              <SectionHeading id="pages-title" title="Pages" count={pages.length} />
              <ul className="flex flex-wrap gap-2">
                {pages.map((target) => (
                  <li key={target.href}>
                    <Link href={target.href} className={adminButton("secondary")}>
                      {target.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="visits-title" className="grid gap-3">
            <SectionHeading
              id="visits-title"
              title="Visits"
              count={visits.length}
              description={visits.length > LIMIT ? `Showing the latest ${LIMIT}.` : undefined}
              actions={
                visits.length > 0 ? (
                  <Link href={`/admin/appointments?when=all&q=${encodeURIComponent(q)}`} className={adminButton("ghost")}>
                    Open in Appointments
                  </Link>
                ) : undefined
              }
            />
            <VisitTable rows={visits.slice(0, LIMIT)} today={snapshot.today} label="Matching visits" empty="No visits match." />
          </section>

          <section aria-labelledby="people-title" className="grid gap-3">
            <SectionHeading id="people-title" title="People" count={people.length} description={people.length > LIMIT ? `Showing the first ${LIMIT}.` : undefined} />
            {people.length === 0 ? (
              <Empty>No accounts match.</Empty>
            ) : (
              <TableWrap label="Matching people">
                <table className={tableClass}>
                  <caption className="sr-only">Matching accounts</caption>
                  <thead className={theadClass}>
                    <tr>
                      <Th>Name</Th>
                      <Th>Role</Th>
                      <Th align="right">Visits</Th>
                      <Th>Account</Th>
                    </tr>
                  </thead>
                  <tbody className={tbodyClass}>
                    {people.slice(0, LIMIT).map((row) => (
                      <tr key={row.user.id}>
                        <Td>
                          <RowLink href={`/admin/people/${row.user.id}`}>{row.user.name}</RowLink>
                          <span className="block text-[13px] break-all text-muted">{row.user.email}</span>
                        </Td>
                        <Td className="whitespace-nowrap">{roleText(row.user)}</Td>
                        <Td align="right">{pluralise(row.visits, "visit")}</Td>
                        <Td>
                          <AccountBadge account={row.user} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </section>
        </div>
      )}
    </AdminShell>
  );
}
