import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTitle } from "@/components/admin/AdminTitle";
import { TABS } from "@/components/admin/nav";
import { Badge, Empty, RowLink, TableWrap, Td, Th, roleText, tableClass, tbodyClass, theadClass } from "@/components/admin/ui";
import { loadSnapshot, navCounts, param, type SearchParams } from "@/lib/admin-data";
import { instantLabel } from "@/lib/admin-format";
import { noticeText } from "@/lib/admin-notices";
import { requireAdminPage } from "@/lib/admin-page";
import { pluralise } from "@/lib/format";
import { supabaseConfigured } from "@/lib/supabase";
import { revokeSessionAction } from "@/server/admin-actions";

export const metadata: Metadata = { title: "Signed in" };

export default async function SignedInPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdminPage("/admin/security");
  const query = await searchParams;
  const snapshot = await loadSnapshot();
  const counts = navCounts(snapshot);
  const sessions = snapshot.sessions;
  const people = new Set(sessions.map((session) => session.userId)).size;
  const tabs = (TABS.security ?? []).map((tab) =>
    tab.href === "/admin/security" ? { ...tab, count: sessions.length } : tab.href === "/admin/security/attempts" && counts.security > 0 ? { ...tab, count: counts.security } : tab,
  );

  return (
    <AdminShell
      admin={admin}
      section="security"
      crumb="Signed in"
      tabs={tabs}
      activeTab="/admin/security"
      counts={counts}
      notice={noticeText(param(query, "done"))}
    >
      <AdminTitle
        title="Signed in"
        today={snapshot.today}
        description="Every session that’s open right now. End one to sign that device out at once."
      />

      {supabaseConfigured() ? (
        <p className="mb-4 rounded-lg border border-[#c8dcf2] bg-[#e8f1fb] px-4 py-3 text-sm text-[#0b4f8a]">
          Supabase is on, so most sign-ins are held by Supabase and don’t appear here. “Sign out everywhere” on a person’s page still
          works: the app refuses any of their sessions that started before it.
        </p>
      ) : null}

      <p className="mb-3 text-sm text-ink-2">
        {pluralise(sessions.length, "session")} for {pluralise(people, "person", "people")}.
      </p>
      {sessions.length === 0 ? (
        <Empty>No one is signed in.</Empty>
      ) : (
        <TableWrap label="Open sessions">
          <table className={tableClass}>
            <caption className="sr-only">Open sessions, newest first</caption>
            <thead className={theadClass}>
              <tr>
                <Th>Person</Th>
                <Th>Role</Th>
                <Th>Device</Th>
                <Th>Signed in</Th>
                <Th>Runs until</Th>
                <Th>
                  <span className="sr-only">Action</span>
                </Th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {sessions.map((session) => {
                const person = snapshot.usersById.get(session.userId);
                const mine = session.id === admin.sessionId;
                return (
                  <tr key={session.id} className="hover:bg-[#f9fbfc]">
                    <Td>
                      {person ? (
                        <>
                          <RowLink href={`/admin/people/${person.id}`}>{person.name}</RowLink>
                          <span className="block text-[13px] break-all text-muted">{person.email}</span>
                        </>
                      ) : (
                        "Deleted account"
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">{person ? roleText(person) : "—"}</Td>
                    <Td>
                      {session.device || "Unknown device"}
                      {mine ? (
                        <span className="ml-2">
                          <Badge tone="info">You, now</Badge>
                        </span>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">{instantLabel(session.createdAt, snapshot.today)}</Td>
                    <Td className="whitespace-nowrap tabular-nums">{instantLabel(session.expiresAt, snapshot.today)}</Td>
                    <Td align="right">
                      {mine ? null : (
                        <ActionForm action={revokeSessionAction}>
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="return" value="/admin/security" />
                          <SubmitButton variant="secondary" pendingLabel="Ending…">
                            End<span className="sr-only"> {person ? `${person.name}’s` : "this"} session</span>
                          </SubmitButton>
                        </ActionForm>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
    </AdminShell>
  );
}
