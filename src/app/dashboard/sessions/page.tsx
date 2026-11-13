import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SessionsViewer } from "@/components/dashboard/SessionsViewer";
import { toScheduleVisit } from "@/components/doctors/schedule-model";
import { DisplacedPatients } from "@/components/profile/DisplacedPatients";
import { Notice } from "@/components/ui/Card";
import { now, practiceWallClock, todayIso } from "@/lib/clock";
import { reasons } from "@/lib/data";
import { doctorStatus } from "@/lib/doctor-status";
import { readDoctorProfile } from "@/lib/profiles";
import { displacedFor } from "@/lib/rebooking";
import { getCurrentUser } from "@/lib/session";
import { getStore } from "@/lib/store";

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
  searchParams: Promise<{ saved?: string; notice?: string; lent?: string; displaced?: string; shifted?: string }>;
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
    moved > 0
      ? ` ${moved === 1 ? "1 patient was" : `${moved} patients were`} moved off the removed hours and offered new times.`
      : "";
  const shifted = Number(query.shifted ?? 0);
  const shiftedNote =
    shifted > 0
      ? ` ${shifted === 1 ? "1 patient was" : `${shifted} patients were`} moved to a later slot in the other session and told the new time.`
      : "";
  const feedback = saved
    ? `${saved}${lent}${movedNote}${shiftedNote}`
    : query.notice === "missing"
      ? "That session was already removed."
      : null;

  return (
    <div>
      {!status.steps[0]!.done ? (
        <div className="mx-auto max-w-[92rem] px-4 pt-6 md:px-8 xl:px-10">
          <Notice tone="info">
            Patients can’t see you yet.{" "}
            <Link href="/dashboard/profile" className="text-accent underline underline-offset-4">
              Finish your profile
            </Link>{" "}
            so your consulting sessions appear for booking.
          </Notice>
        </div>
      ) : null}

      {feedback ? (
        <div className="mx-auto max-w-[92rem] px-4 pt-4 md:px-8 xl:px-10">
          <Notice tone="success">{feedback}</Notice>
        </div>
      ) : null}

      <SessionsViewer
        doctorName={user.name}
        today={today}
        nowMinutes={wall.hour * 60 + wall.minute}
        sessions={status.sessions}
        visits={appointments.map((visit) => toScheduleVisit(visit, reasonLabel(visit.reasonId)))}
        trims={trims}
        room={room}
        visible={status.visible}
      />

      {displaced.length > 0 ? (
        <div className="mx-auto max-w-[92rem] px-4 pb-12 md:px-8 xl:px-10">
          <DisplacedPatients entries={displaced} />
        </div>
      ) : null}
    </div>
  );
}
