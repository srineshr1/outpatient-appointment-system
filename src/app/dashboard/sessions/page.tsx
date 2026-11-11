import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DoctorSchedule } from "@/components/doctors/DoctorSchedule";
import { toScheduleVisit } from "@/components/doctors/schedule-model";
import { DisplacedPatients } from "@/components/profile/DisplacedPatients";
import { PendingButton } from "@/components/ui/PendingButton";
import { buttonClass } from "@/components/ui/button-styles";
import { Notice } from "@/components/ui/Card";
import { now, practiceWallClock, todayIso } from "@/lib/clock";
import { reasons } from "@/lib/data";
import { doctorStatus } from "@/lib/doctor-status";
import { readDoctorProfile } from "@/lib/profiles";
import { getCurrentUser } from "@/lib/session";
import { getStore } from "@/lib/store";
import { displacedFor } from "@/lib/rebooking";
import { archiveSession } from "@/server/profile-actions";

export const metadata: Metadata = { title: "Schedule", robots: { index: false } };

const SAVED: Record<string, string> = {
  created: "Session added. Patients can book the new places.",
  updated: "Session changed. Existing visits keep their original times.",
  removed: "Session removed.",
};

function reasonLabel(id: string): string {
  return reasons.find((reason) => reason.id === id)?.label ?? "Appointment";
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; saved?: string; notice?: string; n?: string; v?: string; lent?: string; displaced?: string; displace?: string; shifted?: string }>;
}) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect("/sign-in?as=staff&next=/dashboard/sessions");
  if (user.role !== "doctor" || user.doctorId !== user.id) redirect("/dashboard");
  const store = await getStore();
  const today = todayIso();
  const wall = practiceWallClock(now());
  const [status, record, appointments, trims, displaced] = await Promise.all([
    doctorStatus(store, user),
    store.getProfile(user.id),
    store.listAppointments({ doctorId: user.id }),
    store.listSessionTrims(user.id),
    displacedFor(user.id),
  ]);
  const room = readDoctorProfile(record).room || user.doctorRoom || "Clinic";
  const saved = SAVED[query.saved ?? ""];
  const lent = query.lent ? ` ${query.lent}` : "";
  const moved = Number(query.displaced ?? 0);
  const movedNote =
    moved > 0 ? ` ${moved === 1 ? "1 patient was" : `${moved} patients were`} moved off the removed hours and offered new times.` : "";
  const shifted = Number(query.shifted ?? 0);
  const shiftedNote =
    shifted > 0 ? ` ${shifted === 1 ? "1 patient was" : `${shifted} patients were`} moved to a later slot in the other session and told the new time.` : "";
  const busy = query.notice === "busy";
  // A session with booked visits: the doctor may remove it anyway and offer those patients new times.
  const removing = busy && query.displace ? status.sessions.find((session) => session.id === query.displace) : undefined;
  const count = Number(query.n ?? 0);
  const notice = saved
    ? `${saved}${lent}${movedNote}${shiftedNote}`
    : busy && !(removing && count > 0)
      ? `${query.n ?? "Some"} booked visits use that session. Move or cancel them first.`
      : query.notice === "missing"
        ? "That session was already removed."
        : query.welcome === "1"
          ? "Add your first session. Patients can book you once it is on the week."
          : null;

  return (
    <div>
      {removing && count > 0 ? (
        <div className="mx-auto max-w-[1400px] px-4 pt-4 md:px-6">
          <section aria-labelledby="remove-displace" role="alert" className="rounded-card bg-danger-soft px-5 py-4 text-callout text-ink">
            <h2 id="remove-displace" className="text-body font-semibold">
              {count === 1 ? "1 patient is" : `${count} patients are`} booked in {removing.label || "that session"}
            </h2>
            <p className="mt-1">
              Move or cancel {count === 1 ? "that visit" : "those visits"} from your clinic book first, or remove the session and
              notify {count === 1 ? "the patient" : "them"}: each is offered the nearest free times with you (held for 24 hours) and can
              pick one or cancel for a full refund. Unpaid holds are released.
            </p>
            <form action={archiveSession} className="group mt-3 grid gap-3">
              <input type="hidden" name="id" value={removing.id} />
              <input type="hidden" name="displace" value="confirm" />
              <input type="hidden" name="displaceCount" value={count} />
              <label htmlFor="remove-displace-reason" className="font-semibold">
                Message for the patients <span className="font-normal text-ink-2">(optional)</span>
              </label>
              <input id="remove-displace-reason" name="displaceReason" maxLength={200} className="field" />
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <PendingButton pendingLabel="Notifying…" className={buttonClass("primary", "md", "group-has-[[aria-busy=true]]:pointer-events-none")}>
                  Notify them and offer new times
                </PendingButton>
                <Link href="/dashboard/sessions" className={buttonClass("plain", "md")}>
                  Keep the session
                </Link>
              </div>
            </form>
          </section>
        </div>
      ) : null}
      {!status.steps[0]!.done ? (
        <div className="mx-auto max-w-[1400px] px-4 pt-4 md:px-6">
          <Notice tone="info">
            Patients can’t see you yet.{" "}
            <Link href="/dashboard/profile" className="text-accent underline underline-offset-4">
              Finish your profile
            </Link>{" "}
            as well as adding a session.
          </Notice>
        </div>
      ) : null}
      <DoctorSchedule
        key={query.v ?? "schedule"}
        doctorName={user.name}
        doctorId={user.id}
        today={today}
        nowMinutes={wall.hour * 60 + wall.minute}
        sessions={status.sessions}
        visits={appointments.map((visit) => toScheduleVisit(visit, reasonLabel(visit.reasonId)))}
        trims={trims}
        room={room || "Clinic"}
        editable
        returnTo="/dashboard/sessions"
        notice={notice}
      />
      <div className="mx-auto max-w-[1400px] px-4 md:px-6">
        <DisplacedPatients entries={displaced} />
      </div>
    </div>
  );
}
