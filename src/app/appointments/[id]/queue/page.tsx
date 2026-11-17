import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RateVisit } from "@/components/patient/RateVisit";
import { RefreshQueue } from "@/components/patient/RefreshQueue";
import { buttonClass } from "@/components/ui/button-styles";
import { now, todayIso } from "@/lib/clock";
import { findDoctor, practice, reasons } from "@/lib/data";
import { formatShortDate, relativeDay } from "@/lib/format";
import { queuePath, queuePlace } from "@/lib/queue";
import { getCurrentUser } from "@/lib/session";
import { patientPlace, tokenLabel } from "@/lib/sessions";
import { getStore } from "@/lib/store";

export const metadata: Metadata = {
  title: "Your queue",
  robots: { index: false },
};

function reasonLabel(id: string): string {
  return reasons.find((reason) => reason.id === id)?.label ?? "Appointment";
}

const ratingNotices: Record<string, string> = {
  rating: "Choose a score from 1 to 5.",
  unavailable: "You can rate this visit only after you have been seen.",
  missing: "That visit is no longer on the book.",
};

export default async function QueuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const noticeKey = typeof query.notice === "string" ? query.notice : "";
  const user = await getCurrentUser();
  const path = queuePath(id);
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(path)}`);

  const store = await getStore();
  const visit = await store.getAppointment(id);
  if (!visit || visit.patientUserId !== user.id) notFound();

  const [roster, session] = await Promise.all([
    store.listAppointments({ doctorId: visit.doctorId }),
    visit.sessionId ? store.getConsultSession(visit.sessionId).catch(() => null) : Promise.resolve(null),
  ]);
  const today = todayIso(now());
  const place = queuePlace(visit, roster);
  const when = patientPlace(visit, session);
  const doctor = findDoctor(visit.doctorId);
  const doctorName = doctor?.name ?? "Your doctor";
  const room = doctor?.room ?? null;
  const day = visit.date === today ? "Today" : relativeDay(visit.date, today);

  const headline =
    visit.status === "completed"
      ? "You've been seen"
      : visit.status === "cancelled" || visit.status === "expired"
        ? "This visit is no longer booked"
        : visit.status === "displaced"
          ? "This visit needs a new time"
          : place.ahead === 0
            ? "You're next"
            : place.ahead === 1
              ? "1 person ahead of you"
              : `${place.ahead} people ahead of you`;

  const number = visit.status === "booked" ? String(place.ahead) : "—";

  return (
    <div className="mx-auto max-w-lg px-5 pt-8 pb-16 md:px-8 md:pt-10">
      <p className="text-caption font-semibold tracking-wider text-muted uppercase">Your queue</p>
      <h1 className="mt-2 text-title2 font-bold tracking-tight text-ink">{headline}</h1>
      <p className="mt-6 text-center text-title1 font-bold text-ink tabular" aria-label={headline}>
        {number}
      </p>
      {visit.status === "booked" ? (
        <p className="mt-1 text-center text-body text-ink-2">
          {place.waiting === 1
            ? "You are the only person still booked in this clinic."
            : `${place.waiting} people are still in this queue. You are number ${place.position}.`}
        </p>
      ) : (
        <p className="mt-1 text-center text-body text-ink-2">
          {place.waiting === 0 ? "Nobody is waiting in this clinic." : `${place.waiting} still waiting in this clinic.`}
        </p>
      )}

      <dl className="mt-8 grid gap-3 rounded-card border border-hairline bg-surface p-5 text-body">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-2">Doctor</dt>
          <dd className="text-right font-medium text-ink">{doctorName}</dd>
        </div>
        {room ? (
          <div className="flex justify-between gap-4">
            <dt className="text-ink-2">Room</dt>
            <dd className="text-right font-medium text-ink">{room}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-ink-2">When</dt>
          <dd className="text-right font-medium text-ink">
            {day}
            {when.window ? `, ${when.window}` : `, ${visit.time}`}
          </dd>
        </div>
        {when.token ? (
          <div className="flex justify-between gap-4">
            <dt className="text-ink-2">Your token</dt>
            <dd className="text-right font-semibold text-ink tabular">{tokenLabel(when.token)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-ink-2">Reason</dt>
          <dd className="text-right font-medium text-ink">{reasonLabel(visit.reasonId)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-2">Reference</dt>
          <dd className="text-right font-medium text-ink tabular">{visit.reference}</dd>
        </div>
      </dl>

      {visit.status === "completed" ? (
        <RateVisit visit={visit} doctorName={doctorName} returnTo={path} notice={ratingNotices[noticeKey] ?? ""} />
      ) : (
        <p className="mt-5 text-callout text-ink-2">
          {visit.date > today
            ? `Your visit is ${formatShortDate(visit.date)}. Open this page on the day to see who is still ahead of you. Wait to be called in token order, lowest first.`
            : "Wait nearby. Patients are called in token order, lowest first. The number changes when someone is seen, so refresh if you have been waiting."}
        </p>
      )}
      <p className="mt-2 text-callout text-muted">
        Desk {practice.phoneDisplay} if you need help.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <RefreshQueue />
        <Link href="/appointments" className={buttonClass("plain", "md")}>
          Your appointments
        </Link>
      </div>
    </div>
  );
}
