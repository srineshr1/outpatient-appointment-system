import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DoctorSchedule } from "@/components/doctors/DoctorSchedule";
import { toScheduleVisit } from "@/components/doctors/schedule-model";
import { Notice } from "@/components/ui/Card";
import { now, practiceWallClock, todayIso } from "@/lib/clock";
import { reasons } from "@/lib/data";
import { doctorStatus } from "@/lib/doctor-status";
import { readDoctorProfile } from "@/lib/profiles";
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
  searchParams: Promise<{ welcome?: string; saved?: string; notice?: string; n?: string; v?: string; lent?: string }>;
}) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect("/sign-in?as=staff&next=/dashboard/sessions");
  if (user.role !== "doctor" || user.doctorId !== user.id) redirect("/dashboard");
  const store = await getStore();
  const today = todayIso();
  const wall = practiceWallClock(now());
  const [status, record, appointments, trims] = await Promise.all([
    doctorStatus(store, user),
    store.getProfile(user.id),
    store.listAppointments({ doctorId: user.id }),
    store.listSessionTrims(user.id),
  ]);
  const room = readDoctorProfile(record).room || user.doctorRoom || "Clinic";
  const saved = SAVED[query.saved ?? ""];
  const lent = query.lent ? ` ${query.lent}` : "";
  const notice = saved
    ? `${saved}${lent}`
    : query.notice === "busy"
      ? `${query.n ?? "Some"} booked visits use that session. Move or cancel them first.`
      : query.notice === "missing"
        ? "That session was already removed."
        : query.welcome === "1"
          ? "Add your first session. Patients can book you once it is on the week."
          : null;

  return (
    <div>
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
    </div>
  );
}
