import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTitle } from "@/components/admin/AdminTitle";
import { EventTable, VisitTable } from "@/components/admin/tables";
import {
  AccountBadge,
  AdminField,
  Badge,
  Empty,
  Facts,
  Money,
  Panel,
  TableWrap,
  Td,
  Th,
  adminButton,
  inputClass,
  roleText,
  tableClass,
  tbodyClass,
  textareaClass,
  theadClass,
} from "@/components/admin/ui";
import { isActiveAdmin, OWN_BOOK } from "@/lib/admin";
import { loadSnapshot, navCounts, param, type SearchParams } from "@/lib/admin-data";
import { instantLabel } from "@/lib/admin-format";
import { noticeText } from "@/lib/admin-notices";
import { requireAdminPage } from "@/lib/admin-page";
import { ROLE_LABELS } from "@/lib/audit-labels";
import { ROLES } from "@/lib/clinic-types";
import { doctors } from "@/lib/data";
import { ageLabel, formatPhone } from "@/lib/format";
import { changeRoleAction, revokeSessionAction, revokeSessionsAction, setDisabledAction } from "@/server/admin-actions";

export const metadata: Metadata = { title: "Person" };

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const path = `/admin/people/${id}`;
  const admin = await requireAdminPage(path);
  const query = await searchParams;
  const snapshot = await loadSnapshot();
  const person = snapshot.usersById.get(id);
  if (!person) notFound();

  const { today } = snapshot;
  const self = person.id === admin.id;
  const visits = [...snapshot.visits.filter((row) => row.visit.patientUserId === person.id)].reverse();
  const owed = visits.reduce((sum, row) => sum + row.money.duePence, 0);
  const sessions = snapshot.sessions.filter((session) => session.userId === person.id);
  const events = snapshot.events.filter((event) => event.actorId === person.id || event.subjectId === person.id).slice(0, 50);
  const otherAdmins = snapshot.users.filter((user) => user.id !== person.id && isActiveAdmin(user)).length;
  const lastAdmin = isActiveAdmin(person) && otherAdmins === 0;
  const openers = new Map<string, string[]>();
  for (const user of snapshot.users) {
    if (user.role !== "doctor" || user.disabledAt || !user.doctorId || user.id === person.id) continue;
    openers.set(user.doctorId, [...(openers.get(user.doctorId) ?? []), user.name]);
  }

  return (
    <AdminShell
      admin={admin}
      section="people"
      crumb={person.name}
      counts={navCounts(snapshot)}
      notice={noticeText(param(query, "done"))}
    >
      <AdminTitle
        title={`${person.name}${self ? " (you)" : ""}`}
        today={today}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {person.role === "admin" ? <Badge tone="info">{roleText(person)}</Badge> : <Badge>{roleText(person)}</Badge>}
            <AccountBadge account={person} />
            <span className="break-all">{person.email}</span>
          </span>
        }
        actions={
          <Link href={person.role === "patient" ? "/admin/people" : "/admin/people/staff"} className={adminButton("secondary")}>
            {person.role === "patient" ? "All patients" : "All staff"}
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid content-start gap-6 lg:col-span-2">
          <Panel id="details" title="Details">
            <Facts
              items={[
                { term: "Email", value: person.email },
                { term: "Role", value: roleText(person) },
                { term: "Mobile", value: person.mobile ? formatPhone(person.mobile) : "Not given" },
                { term: "Date of birth", value: person.dob ? `${person.dob} · ${ageLabel(person.dob, today)}` : "Not given" },
                { term: "Joined", value: instantLabel(person.createdAt, today) },
                {
                  term: "Account",
                  value: person.disabledAt ? `Turned off ${instantLabel(person.disabledAt, today)}` : "Active",
                },
                ...(person.role === "patient"
                  ? [
                      { term: "Visits", value: `${visits.length}` },
                      { term: "Owed", value: <Money pence={owed} /> },
                    ]
                  : []),
              ]}
            />
          </Panel>

          <section aria-labelledby="sessions-title" className="grid gap-3">
            <h2 id="sessions-title" className="text-lg font-semibold text-ink">
              Signed in on
            </h2>
            {sessions.length === 0 ? (
              <Empty>Not signed in anywhere.</Empty>
            ) : (
              <TableWrap label="Where they’re signed in">
                <table className={tableClass}>
                  <caption className="sr-only">Sessions</caption>
                  <thead className={theadClass}>
                    <tr>
                      <Th>Device</Th>
                      <Th>Signed in</Th>
                      <Th>Runs until</Th>
                      <Th>
                        <span className="sr-only">Action</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody className={tbodyClass}>
                    {sessions.map((session) => (
                      <tr key={session.id}>
                        <Td>
                          {session.device || "Unknown device"}
                          {session.id === admin.sessionId ? <span className="ml-2"><Badge tone="info">This session</Badge></span> : null}
                        </Td>
                        <Td className="whitespace-nowrap tabular-nums">{instantLabel(session.createdAt, today)}</Td>
                        <Td className="whitespace-nowrap tabular-nums">{instantLabel(session.expiresAt, today)}</Td>
                        <Td align="right">
                          {session.id === admin.sessionId ? null : (
                            <ActionForm action={revokeSessionAction}>
                              <input type="hidden" name="sessionId" value={session.id} />
                              <input type="hidden" name="return" value={path} />
                              <SubmitButton variant="secondary" pendingLabel="Ending…">
                                End<span className="sr-only"> this session</span>
                              </SubmitButton>
                            </ActionForm>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </section>

          {person.role === "patient" || visits.length > 0 ? (
            <section aria-labelledby="visits-title" className="grid gap-3">
              <h2 id="visits-title" className="text-lg font-semibold text-ink">
                Visits
              </h2>
              <VisitTable rows={visits} today={today} label="Their visits" empty="No visits booked." />
            </section>
          ) : null}

          <section aria-labelledby="person-activity" className="grid gap-3">
            <h2 id="person-activity" className="text-lg font-semibold text-ink">
              Activity
            </h2>
            <EventTable events={events} today={today} label="Their activity" empty="Nothing recorded yet." />
          </section>
        </div>

        <div className="grid content-start gap-6">
          <Panel id="role" title="Role" description={self ? "You can’t change your own role. Ask another admin." : "They’re signed out, and see their new pages next time."}>
            {self ? (
              <p className="text-sm text-ink-2">{roleText(person)}</p>
            ) : (
              <ActionForm action={changeRoleAction} className="grid gap-3">
                <input type="hidden" name="userId" value={person.id} />
                <input type="hidden" name="return" value={path} />
                <AdminField id="role-select" label="Role">
                  <select id="role-select" name="role" defaultValue={person.role} className={inputClass}>
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </AdminField>
                <AdminField
                  id="role-doctor"
                  label="Clinic book"
                  hint="For doctors. Their own book is listed for patients to book. Only share another doctor’s book for someone covering for them."
                >
                  <select
                    id="role-doctor"
                    name="doctorId"
                    defaultValue={person.role === "doctor" && person.doctorId && person.doctorId !== person.id ? person.doctorId : OWN_BOOK}
                    aria-describedby="role-doctor-hint"
                    className={inputClass}
                  >
                    <option value={OWN_BOOK}>Their own book (listed for patients to book)</option>
                    <optgroup label="Share another doctor’s book (not listed for patients)">
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {`Share ${doctor.name}’s book${openers.has(doctor.id) ? ` (also ${openers.get(doctor.id)!.join(", ")})` : ""}`}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </AdminField>
                <div className="grid gap-3 sm:grid-cols-2">
                  <AdminField id="role-doctor-room" label="Room" hint="Own book only. Blank keeps it.">
                    <input
                      id="role-doctor-room"
                      name="doctorRoom"
                      maxLength={40}
                      defaultValue={person.doctorRoom ?? ""}
                      autoComplete="off"
                      aria-describedby="role-doctor-room-hint"
                      className={inputClass}
                    />
                  </AdminField>
                  <AdminField id="role-doctor-interest" label="Specialty" hint="Own book only. Blank keeps it.">
                    <input
                      id="role-doctor-interest"
                      name="doctorInterest"
                      maxLength={60}
                      defaultValue={person.doctorInterest ?? ""}
                      autoComplete="off"
                      aria-describedby="role-doctor-interest-hint"
                      className={inputClass}
                    />
                  </AdminField>
                </div>
                <AdminField id="role-reason" label="Reason" hint="Goes in the activity log.">
                  <textarea id="role-reason" name="reason" required maxLength={200} aria-describedby="role-reason-hint" className={textareaClass} />
                </AdminField>
                <div>
                  <SubmitButton pendingLabel="Changing…">Change role</SubmitButton>
                </div>
              </ActionForm>
            )}
          </Panel>

          <Panel id="sign-out" title="Sign out everywhere" description={self ? "Ends your other sessions. This one stays." : "Ends every session they have open."}>
            <ActionForm action={revokeSessionsAction}>
              <input type="hidden" name="userId" value={person.id} />
              <input type="hidden" name="return" value={path} />
              <SubmitButton variant="secondary" pendingLabel="Signing out…">
                {self ? "Sign out my other sessions" : "Sign out everywhere"}
              </SubmitButton>
            </ActionForm>
          </Panel>

          {self ? null : person.disabledAt ? (
            <Panel id="access" title="Turned off" description="They can’t sign in until the account is turned back on.">
              <ActionForm action={setDisabledAction} className="grid gap-3">
                <input type="hidden" name="userId" value={person.id} />
                <input type="hidden" name="disable" value="0" />
                <input type="hidden" name="return" value={path} />
                <AdminField id="enable-reason" label="Reason" hint="Optional. Goes in the activity log.">
                  <textarea id="enable-reason" name="reason" maxLength={200} aria-describedby="enable-reason-hint" className={textareaClass} />
                </AdminField>
                <div>
                  <SubmitButton pendingLabel="Turning on…">Turn account back on</SubmitButton>
                </div>
              </ActionForm>
            </Panel>
          ) : (
            <Panel
              id="access"
              title="Turn the account off"
              description={lastAdmin ? "This is the only admin who can sign in, so it can’t be turned off." : "Signs them out everywhere and stops them signing in. Their visits stay on the book."}
            >
              {lastAdmin ? null : (
                <ActionForm action={setDisabledAction} className="grid gap-3">
                  <input type="hidden" name="userId" value={person.id} />
                  <input type="hidden" name="disable" value="1" />
                  <input type="hidden" name="return" value={path} />
                  <AdminField id="disable-reason" label="Reason" hint="Goes in the activity log.">
                    <textarea id="disable-reason" name="reason" required maxLength={200} aria-describedby="disable-reason-hint" className={textareaClass} />
                  </AdminField>
                  <div>
                    <SubmitButton variant="danger" pendingLabel="Turning off…">
                      Turn off account
                    </SubmitButton>
                  </div>
                </ActionForm>
              )}
            </Panel>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
