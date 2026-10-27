import type { Metadata } from "next";
import { OWN_BOOK } from "@/lib/admin";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTitle } from "@/components/admin/AdminTitle";
import { TABS } from "@/components/admin/nav";
import { AdminField, Panel, inputClass } from "@/components/admin/ui";
import { loadSnapshot, navCounts, type SearchParams } from "@/lib/admin-data";
import { requireAdminPage } from "@/lib/admin-page";
import { doctors } from "@/lib/data";
import { createStaffAction } from "@/server/admin-actions";

export const metadata: Metadata = { title: "Add staff member" };

export default async function NewStaffPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdminPage("/admin/people/new");
  await searchParams;
  const snapshot = await loadSnapshot();
  const openers = new Map<string, string[]>();
  for (const user of snapshot.users) {
    if (user.role !== "doctor" || user.disabledAt || !user.doctorId) continue;
    openers.set(user.doctorId, [...(openers.get(user.doctorId) ?? []), user.name]);
  }

  return (
    <AdminShell
      admin={admin}
      section="people"
      crumb="Add staff member"
      tabs={TABS.people}
      activeTab="/admin/people/new"
      counts={navCounts(snapshot)}
    >
      <AdminTitle
        title="Add staff member"
        today={snapshot.today}
        description="They sign in with a code sent to this email (or with Google, when that’s on). There’s no password to send them."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel id="new-staff" title="Their details">
            <ActionForm action={createStaffAction} className="grid gap-4 sm:max-w-lg">
              <AdminField id="staff-name" label="Full name" hint="As patients and colleagues should see it, for example Dr Sam Patel.">
                <input
                  id="staff-name"
                  name="name"
                  required
                  maxLength={100}
                  autoComplete="off"
                  aria-describedby="staff-name-hint"
                  className={inputClass}
                />
              </AdminField>
              <AdminField id="staff-email" label="Work email">
                <input id="staff-email" name="email" type="email" required autoComplete="off" spellCheck={false} className={inputClass} />
              </AdminField>
              <fieldset>
                <legend className="text-sm font-medium text-ink">Role</legend>
                <div className="mt-2 grid gap-1">
                  {[
                    { value: "doctor", label: "Doctor", hint: "Opens one doctor’s clinic book." },
                    { value: "reception", label: "Reception", hint: "Sees every doctor’s book and updates visits." },
                    { value: "admin", label: "Admin", hint: "Everything here, including money and other people’s access." },
                  ].map((option, index) => (
                    <div key={option.value} className="flex items-start gap-2 py-1.5 text-sm text-ink">
                      <input
                        id={`staff-role-${option.value}`}
                        type="radio"
                        name="role"
                        value={option.value}
                        defaultChecked={index === 1}
                        aria-describedby={`staff-role-${option.value}-hint`}
                        className="mt-0.5 size-4 accent-accent"
                      />
                      <span>
                        <label htmlFor={`staff-role-${option.value}`} className="font-medium">
                          {option.label}
                        </label>
                        <span id={`staff-role-${option.value}-hint`} className="block text-[13px] text-muted">
                          {option.hint}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </fieldset>
              <AdminField id="staff-doctor" label="Clinic book" hint="Doctors only: whose book they open. A book can be shared, for example with a locum.">
                <select id="staff-doctor" name="doctorId" aria-describedby="staff-doctor-hint" defaultValue="" className={inputClass}>
                  <option value="">Not a doctor</option>
                  <option value={OWN_BOOK}>Their own book (listed for patients to book)</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {`${doctor.name}${openers.has(doctor.id) ? ` (opened by ${openers.get(doctor.id)!.join(", ")})` : ""}`}
                    </option>
                  ))}
                </select>
              </AdminField>
              <div>
                <SubmitButton pendingLabel="Adding…">Add staff member</SubmitButton>
              </div>
            </ActionForm>
          </Panel>
        </div>
        <Panel id="after" title="What happens next">
          <ul className="grid list-disc gap-2 pl-5 text-sm text-ink-2">
            <li>The account works straight away. Tell them to sign in at the staff sign-in page with this email.</li>
            <li>You can change the role or turn the account off at any time from their page.</li>
            <li>Adding them is recorded in the activity log under your name.</li>
          </ul>
        </Panel>
      </div>
    </AdminShell>
  );
}
