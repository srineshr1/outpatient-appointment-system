import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTitle } from "@/components/admin/AdminTitle";
import { TABS } from "@/components/admin/nav";
import { EventTable } from "@/components/admin/tables";
import { Badge, Empty, Kpis, SectionHeading, TableWrap, Td, Th, tableClass, tbodyClass, theadClass, type Tone } from "@/components/admin/ui";
import { failedSignIns, loadSnapshot, navCounts, param, type SearchParams } from "@/lib/admin-data";
import { instantLabel } from "@/lib/admin-format";
import { noticeText } from "@/lib/admin-notices";
import { requireAdminPage } from "@/lib/admin-page";
import { SECURITY_ACTIONS } from "@/lib/audit-labels";
import type { LoginCodeRecord } from "@/lib/clinic-types";
import { now } from "@/lib/clock";
import { MAX_ATTEMPTS, recordKind } from "@/lib/login-codes";
import { pluralise } from "@/lib/format";
import { clearCodeAction } from "@/server/admin-actions";

export const metadata: Metadata = { title: "Sign-in attempts" };

function codeState(code: LoginCodeRecord, at: number): { label: string; tone: Tone } {
  const { kind } = recordKind(code.email);
  if (new Date(code.expiresAt).getTime() <= at) return { label: "Expired", tone: "neutral" };
  if (kind === "reset") return { label: "Reset link sent", tone: "info" };
  if (kind === "lock" && code.attempts >= MAX_ATTEMPTS) return { label: "Locked", tone: "danger" };
  if (kind === "lock") return { label: "Wrong passwords", tone: "warn" };
  return { label: "Old sign-in code", tone: "neutral" };
}

export default async function AttemptsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdminPage("/admin/security/attempts");
  const query = await searchParams;
  const snapshot = await loadSnapshot();
  const counts = navCounts(snapshot);
  const at = now().getTime();
  const failures = failedSignIns(snapshot.events);
  const wrongCodes = failures.reduce((sum, item) => sum + item.failures, 0);
  const weekAgo = at - 7 * 24 * 3600_000;
  const blocked = snapshot.events.filter((event) => event.action === "signin.blocked" && new Date(event.at).getTime() >= weekAgo).length;
  const codes = snapshot.loginCodes;
  const locked = codes.filter((code) => codeState(code, at).label === "Locked").length;
  const security = snapshot.events.filter((event) => SECURITY_ACTIONS.has(event.action)).slice(0, 50);
  const tabs = (TABS.security ?? []).map((tab) =>
    tab.href === "/admin/security" ? { ...tab, count: snapshot.sessions.length } : tab.href === "/admin/security/attempts" && counts.security > 0 ? { ...tab, count: counts.security } : tab,
  );

  return (
    <AdminShell
      admin={admin}
      section="security"
      crumb="Sign-in attempts"
      tabs={tabs}
      activeTab="/admin/security/attempts"
      counts={counts}
      notice={noticeText(param(query, "done"))}
    >
      <AdminTitle
        title="Sign-in attempts"
        today={snapshot.today}
        description={`Wrong passwords, lockouts and turned-off accounts trying to sign in. An email locks for 15 minutes after ${MAX_ATTEMPTS} wrong passwords.`}
      />

      <Kpis
        items={[
          { label: "Wrong passwords, last day", value: wrongCodes, sub: pluralise(failures.length, "email"), tone: wrongCodes > 0 ? "warn" : undefined },
          { label: "Locked now", value: locked, sub: "For 15 minutes, or until cleared", tone: locked > 0 ? "danger" : undefined },
          { label: "Turned-off accounts", value: blocked, sub: "Tried to sign in, last 7 days" },
          { label: "Locks and reset links", value: codes.length, sub: "Live records" },
        ]}
      />

      <section aria-labelledby="failures-title" className="mt-8 grid gap-3">
        <SectionHeading id="failures-title" title="Wrong passwords in the last day" description="Many tries on one email can mean someone is guessing." />
        {failures.length === 0 ? (
          <Empty>No wrong passwords in the last day.</Empty>
        ) : (
          <TableWrap label="Wrong passwords by email">
            <table className={tableClass}>
              <caption className="sr-only">Wrong passwords by email, last 24 hours</caption>
              <thead className={theadClass}>
                <tr>
                  <Th>Email</Th>
                  <Th align="right">Wrong passwords</Th>
                  <Th>Last try</Th>
                  <Th>Locked</Th>
                </tr>
              </thead>
              <tbody className={tbodyClass}>
                {failures.map((item) => (
                  <tr key={item.email}>
                    <Td className="break-all">{item.email}</Td>
                    <Td align="right">{item.failures}</Td>
                    <Td className="whitespace-nowrap tabular-nums">{instantLabel(item.last, snapshot.today)}</Td>
                    <Td>{item.locked ? <Badge tone="danger">Locked</Badge> : <Badge>No</Badge>}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </section>

      <section aria-labelledby="codes-title" className="mt-8 grid gap-3">
        <SectionHeading
          id="codes-title"
          title="Locks and reset links"
          count={codes.length}
          description="Only a hash of each reset link is stored. Clear a lock to let someone try again straight away, or a reset link to cancel it."
        />
        {codes.length === 0 ? (
          <Empty>No locks or reset links.</Empty>
        ) : (
          <TableWrap label="Locks and reset links">
            <table className={tableClass}>
              <caption className="sr-only">Sign-in locks and reset links</caption>
              <thead className={theadClass}>
                <tr>
                  <Th>Email</Th>
                  <Th>Started</Th>
                  <Th>Expires</Th>
                  <Th align="right">Wrong tries</Th>
                  <Th>State</Th>
                  <Th>
                    <span className="sr-only">Action</span>
                  </Th>
                </tr>
              </thead>
              <tbody className={tbodyClass}>
                {codes.map((code) => {
                  const state = codeState(code, at);
                  return (
                    <tr key={code.email}>
                      <Td className="break-all">{recordKind(code.email).email}</Td>
                      <Td className="whitespace-nowrap tabular-nums">{instantLabel(code.sentAt, snapshot.today)}</Td>
                      <Td className="whitespace-nowrap tabular-nums">{instantLabel(code.expiresAt, snapshot.today)}</Td>
                      <Td align="right">
                        {code.attempts} of {MAX_ATTEMPTS}
                      </Td>
                      <Td>
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </Td>
                      <Td align="right">
                        <ActionForm action={clearCodeAction}>
                          <input type="hidden" name="email" value={code.email} />
                          <input type="hidden" name="return" value="/admin/security/attempts" />
                          <SubmitButton variant="secondary" pendingLabel="Clearing…">
                            Clear<span className="sr-only"> {code.email}</span>
                          </SubmitButton>
                        </ActionForm>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </section>

      <section aria-labelledby="security-events" className="mt-8 grid gap-3">
        <SectionHeading id="security-events" title="Recent sign-in problems" />
        <EventTable events={security} today={snapshot.today} label="Recent sign-in problems" empty="No sign-in problems recorded." />
      </section>
    </AdminShell>
  );
}
