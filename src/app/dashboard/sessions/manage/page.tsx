import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SessionStudio, type StudioVisit } from "@/components/dashboard/SessionStudio";
import { isIsoDate, now, practiceWallClock, todayIso } from "@/lib/clock";
import { doctorStatus } from "@/lib/doctor-status";
import { readDoctorProfile } from "@/lib/profiles";
import { getCurrentUser } from "@/lib/session";
import { getStore } from "@/lib/store";

export const metadata: Metadata = {
  title: "Session studio",
  robots: { index: false },
};

const SAVED: Record<string, string> = {
  created: "Session added. Patients can book the new places.",
  updated: "Session changed. Existing visits keep their original times.",
  removed: "Session removed.",
};

export default async function ManageSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    welcome?: string;
    saved?: string;
    notice?: string;
    n?: string;
    v?: string;
    lent?: string;
    displaced?: string;
    displace?: string;
    shifted?: string;
    session?: string;
    date?: string;
  }>;
}) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect("/sign-in?as=staff&next=/dashboard/sessions/manage");
  if (user.role !== "doctor" || user.doctorId !== user.id) redirect("/dashboard");

  const store = await getStore();
  const current = now();
  const today = todayIso(current);
  const wall = practiceWallClock(current);

  const [status, record, appointments, trims] = await Promise.all([
    doctorStatus(store, user),
    store.getProfile(user.id),
    store.listAppointments({ doctorId: user.id }),
    store.listSessionTrims(user.id),
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

  const busy = query.notice === "busy";
  const removing =
    busy && query.displace
      ? status.sessions.find((session) => session.id === query.displace) ?? null
      : null;
  const removingCount = Number(query.n ?? 0);

  let notice: string | null = null;
  let noticeTone: "info" | "success" | "danger" | "neutral" = "info";

  if (saved) {
    notice = `${saved}${lent}${movedNote}${shiftedNote}`;
    noticeTone = "success";
  } else if (busy && !(removing && removingCount > 0)) {
    notice = `${query.n ?? "Some"} booked visits use that session. Move or cancel them first.`;
    noticeTone = "danger";
  } else if (query.notice === "missing") {
    notice = "That session was already removed.";
    noticeTone = "neutral";
  } else if (query.welcome === "1") {
    notice = "Add your first session. Patients can book you once it is on the week.";
    noticeTone = "info";
  }

  const requestedSessionId = typeof query.session === "string" ? query.session : null;
  const requestedDate = typeof query.date === "string" && isIsoDate(query.date) ? query.date : null;
  const matchedSession = requestedSessionId
    ? status.sessions.find((session) => session.id === requestedSessionId) ?? null
    : null;
  const startInCreateMode = query.welcome === "1" || Boolean(requestedDate && !matchedSession) || status.sessions.length === 0;
  const initialSessionId = startInCreateMode
    ? null
    : matchedSession?.id ?? status.sessions[0]?.id ?? null;

  const studioVisits: StudioVisit[] = appointments.map((visit) => ({
    id: visit.id,
    sessionId: visit.sessionId ?? null,
    slotId: visit.slotId,
    date: visit.date,
    time: visit.time,
    endTime: visit.endTime ?? null,
    token: visit.token ?? null,
    patientName: visit.patientName,
    status: visit.status,
  }));

  return (
    <SessionStudio
      key={query.v ?? query.session ?? requestedDate ?? "studio"}
      doctorId={user.id}
      doctorName={user.name}
      sessions={status.sessions}
      visits={studioVisits}
      trims={trims}
      today={today}
      nowMinutes={wall.hour * 60 + wall.minute}
      room={room}
      initialSessionId={initialSessionId}
      initialDate={requestedDate}
      startInCreateMode={startInCreateMode}
      profileComplete={Boolean(status.steps[0]?.done)}
      notice={notice}
      noticeTone={noticeTone}
      removingSession={removing}
      removingCount={removingCount}
    />
  );
}
