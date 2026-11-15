import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SessionStudio, type StudioVisit } from "@/components/dashboard/SessionStudio";
import { isIsoDate, now, practiceWallClock, todayIso } from "@/lib/clock";
import { firstRunDate, hoursOnDate } from "@/lib/sessions";
import { doctorStatus } from "@/lib/doctor-status";
import { readDoctorProfile } from "@/lib/profiles";
import { getCurrentUser } from "@/lib/session";
import { getStore } from "@/lib/store";

export const metadata: Metadata = {
  title: "Session studio",
  robots: { index: false },
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

  const saved = Boolean(query.saved);
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

  if (movedNote || shiftedNote) {
    notice = `${lent}${movedNote}${shiftedNote}`.trim();
    noticeTone = "info";
  } else if (busy && !(removing && removingCount > 0)) {
    const count = Number(query.n);
    notice = Number.isInteger(count) && count > 0
      ? `${count} booked ${count === 1 ? "visit uses" : "visits use"} that session. Move or cancel ${count === 1 ? "it" : "them"} first.`
      : "Some booked visits use that session. Move or cancel them first.";
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
  const live = status.sessions.filter((session) => !session.archivedAt);
  const runsOn = (date: string) => live.filter((session) => hoursOnDate(session, date, trims, live) !== null);
  // Clinic book's "+" asks for a date: open a new draft only when nothing runs that day yet.
  const onRequestedDate = requestedDate ? runsOn(requestedDate) : [];
  const todays = runsOn(today);
  const startInCreateMode =
    query.welcome === "1" ||
    status.sessions.length === 0 ||
    Boolean(requestedDate && !matchedSession && onRequestedDate.length === 0 && !saved);
  const initialSession = startInCreateMode
    ? null
    : matchedSession ?? onRequestedDate[0] ?? todays[0] ?? status.sessions[0] ?? null;
  const initialSessionId = initialSession?.id ?? null;
  // A weekly session opened without a date shows the next day it runs, not today.
  const initialDate =
    requestedDate ??
    (initialSession && !runsOn(today).some((session) => session.id === initialSession.id)
      ? firstRunDate(initialSession, today) ?? null
      : null);

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
      key={query.v ?? `${query.session ?? ""}|${requestedDate ?? ""}`}
      doctorId={user.id}
      doctorName={user.name}
      sessions={status.sessions}
      visits={studioVisits}
      trims={trims}
      today={today}
      nowMinutes={wall.hour * 60 + wall.minute}
      room={room}
      initialSessionId={initialSessionId}
      initialDate={initialDate}
      startInCreateMode={startInCreateMode}
      profileComplete={Boolean(status.steps[0]?.done)}
      verificationPending={!user.verifiedAt}
      notice={notice}
      noticeTone={noticeTone}
      removingSession={removing}
      removingCount={removingCount}
    />
  );
}
