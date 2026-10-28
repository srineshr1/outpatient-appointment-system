import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeading } from "@/components/shell/PageHeading";
import { buttonClass } from "@/components/ui/button-styles";
import { Notice } from "@/components/ui/Card";
import { PendingButton } from "@/components/ui/PendingButton";
import { addDays, todayIso, now } from "@/lib/clock";
import { findDoctor } from "@/lib/data";
import { formatWhen, weekdayLong } from "@/lib/format";
import { canMove, mayReschedule, openTimesFor, placementLabel, RESCHEDULE_MESSAGES, type RescheduleFailure } from "@/lib/reschedule";
import { loadDoctors } from "@/lib/doctors";
import { placesLabel, slotTimeLabel } from "@/lib/sessions";
import { getCurrentUser, safeNext } from "@/lib/session";
import { getStore } from "@/lib/store";
import { rescheduleAction } from "@/server/booking-actions";

export const metadata: Metadata = { title: "Move a visit", robots: { index: false } };

const WEEKS_STEP = 3;

export default async function ReschedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ return?: string | string[]; notice?: string | string[]; weeks?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const returnTo = safeNext(typeof query.return === "string" ? query.return : "/appointments");
  const here = `/reschedule/${encodeURIComponent(id)}?return=${encodeURIComponent(returnTo)}`;
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(here)}`);

  const visit = await (await getStore()).getAppointment(id);
  if (!visit || !mayReschedule(user, visit)) notFound();
  await loadDoctors();
  const doctor = findDoctor(visit.doctorId);
  const today = todayIso(now());
  const asPatient = user.role === "patient";

  const weeksParam = typeof query.weeks === "string" ? Number(query.weeks) : WEEKS_STEP;
  const weeks = Number.isInteger(weeksParam) && weeksParam >= WEEKS_STEP && weeksParam <= 12 ? weeksParam : WEEKS_STEP;
  const lastDate = addDays(today, weeks * 7);
  const movable = canMove(visit);
  const all = movable ? await openTimesFor(visit) : [];
  const times = all.filter((slot) => slot.date <= lastDate);
  const days = [...new Set(times.map((slot) => slot.date))];
  const noticeKey = typeof query.notice === "string" ? (query.notice as RescheduleFailure | "pick") : null;
  const notice = noticeKey === "pick" ? "Pick a new time first." : noticeKey ? RESCHEDULE_MESSAGES[noticeKey] : null;

  return (
    <div className="mx-auto max-w-page px-5 pt-8 pb-20 md:px-8 md:pt-12">
      <Link href={returnTo} className="-ml-2 inline-flex min-h-11 items-center rounded-full pr-3 pl-2 text-body text-accent hover:bg-accent-soft">
        Back
      </Link>
      <PageHeading className="mt-2 text-title2 font-semibold text-ink md:text-title1">Move this visit</PageHeading>
      <p className="mt-2 max-w-prose text-body text-ink-2">
        {asPatient ? "Your" : `${visit.patientName}’s`} visit with {doctor?.name ?? "the doctor"} stays the same reference,{" "}
        <span className="tabular text-ink">{visit.reference}</span>. Currently{" "}
        <span className="tabular text-ink">{formatWhen(visit, today)}</span>
        {visit.token ? `, token ${visit.token}` : ""}. {asPatient ? "The doctor" : "The patient"} gets an email about the move.
      </p>
      {notice ? (
        <Notice tone="danger" role="alert" className="mt-6">
          {notice}
        </Notice>
      ) : null}
      {!movable ? (
        <Notice tone="info" className="mt-6">
          {RESCHEDULE_MESSAGES.closed}
        </Notice>
      ) : times.length === 0 ? (
        <Notice tone="info" className="mt-6">
          No other times are open with {doctor?.short ?? "this doctor"} in the next {weeks} weeks.
          {weeks < 12 ? (
            <>
              {" "}
              <Link className="text-accent underline underline-offset-4" href={`${here}&weeks=${Math.min(12, weeks + WEEKS_STEP)}`}>
                Look further ahead
              </Link>
              .
            </>
          ) : null}
        </Notice>
      ) : (
        <form action={rescheduleAction} className="group mt-8">
          <input type="hidden" name="id" value={visit.id} />
          <input type="hidden" name="return" value={returnTo} />
          <div className="grid gap-3">
            {days.map((date) => (
              <fieldset key={date} className="rounded-card bg-surface p-4 shadow-card md:flex md:gap-6 md:p-5">
                <legend className="sr-only">{weekdayLong(date)} {date}</legend>
                <h2 className="text-body font-semibold text-ink md:w-52 md:shrink-0">{placementLabel({ date, time: "" }).replace(/, $/, "")}</h2>
                <div className="mt-3 grid flex-1 grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 md:mt-0">
                  {times
                    .filter((slot) => slot.date === date)
                    .map((slot) => (
                      <label key={slot.id} className="relative block cursor-pointer">
                        <input type="radio" name="slot" value={slot.id} className="peer sr-only" required />
                        <span className="tabular flex min-h-11 flex-col items-center justify-center rounded-field px-1 py-1 text-callout font-medium text-accent shadow-[inset_0_0_0_1px_var(--color-hairline)] hover:bg-accent-soft peer-checked:bg-accent peer-checked:text-white peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent/55">
                          {slotTimeLabel(slot)}
                          {slot.mode === "wave" ? <span className="text-caption font-normal opacity-80">{placesLabel(slot)}</span> : null}
                        </span>
                      </label>
                    ))}
                </div>
              </fieldset>
            ))}
          </div>
          {all.some((slot) => slot.date > lastDate) && weeks < 12 ? (
            <p className="mt-4 text-callout">
              <Link className="text-accent hover:underline underline-offset-4" href={`${here}&weeks=${Math.min(12, weeks + WEEKS_STEP)}`}>
                Show later weeks
              </Link>
            </p>
          ) : null}
          <label className="mt-6 block max-w-prose text-callout font-medium text-ink" htmlFor="reason">
            Reason for the move (optional)
            <input
              id="reason"
              name="reason"
              maxLength={200}
              className="mt-2 block min-h-11 w-full rounded-field bg-surface px-3 text-body shadow-[inset_0_0_0_1px_var(--color-hairline)]"
            />
          </label>
          <div className="mt-6 flex flex-wrap gap-3">
            <PendingButton pendingLabel="Moving…" className={buttonClass("primary", "lg", "group-has-[[aria-busy=true]]:pointer-events-none")}>
              Move visit
            </PendingButton>
            <Link href={returnTo} className={buttonClass("plain", "lg")}>
              Keep the current time
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
