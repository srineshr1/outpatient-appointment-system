import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/shell/PageHeading";
import { buttonClass } from "@/components/ui/button-styles";
import { Notice } from "@/components/ui/Card";
import { PendingButton } from "@/components/ui/PendingButton";
import type { Placement } from "@/lib/clinic-types";
import { practiceWallClock } from "@/lib/clock";
import { findDoctor } from "@/lib/data";
import { loadDoctors } from "@/lib/doctors";
import { formatShortDate, weekdayLong } from "@/lib/format";
import { ACCEPT_MESSAGES, findOffer, moreTimes } from "@/lib/rebooking";
import { acceptRebookingAction, cancelRebookingAction } from "@/server/rebook-actions";

// The link token is in the address: keep it out of search engines and of Referer headers.
export const metadata: Metadata = { title: "Pick a new time", robots: { index: false, follow: false }, referrer: "no-referrer" };

type Query = { slot?: string | string[]; more?: string | string[]; cancel?: string | string[]; notice?: string | string[]; done?: string | string[] };

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");
const when = (place: { date: string; time: string; token?: number | null }) => `${formatShortDate(place.date)}, ${place.time}${place.token ? ` · token ${place.token}` : ""}`;

const NOTICES: Record<string, string> = {
  ...ACCEPT_MESSAGES,
  pick: "Pick a time first.",
  confirm: "Tick the box to confirm you want to cancel.",
};

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-page px-5 pt-8 pb-20 md:px-8 md:pt-12">{children}</div>;
}

function TimeChoices({ places, chosen, name = "slot" }: { places: readonly Placement[]; chosen: string; name?: string }) {
  const days = [...new Set(places.map((place) => place.date))];
  return (
    <div className="grid gap-3">
      {days.map((date) => (
        <fieldset key={date} className="rounded-card border border-hairline bg-surface p-4 shadow-card md:flex md:gap-6 md:p-5">
          <legend className="sr-only">
            {weekdayLong(date)} {date}
          </legend>
          <h2 className="text-body font-semibold text-zinc-50 md:w-52 md:shrink-0">{formatShortDate(date)}</h2>
          <div className="mt-3 grid flex-1 grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 md:mt-0">
            {places
              .filter((place) => place.date === date)
              .map((place) => (
                <label key={place.slotId} className="relative block cursor-pointer">
                  <input type="radio" name={name} value={place.slotId} defaultChecked={place.slotId === chosen} className="peer sr-only" required />
                  <span className="tabular flex min-h-11 flex-col items-center justify-center rounded-field bg-white/[0.02] px-1 py-1 text-callout font-medium text-cyan-300 shadow-[inset_0_0_0_1px_var(--color-hairline)] transition-colors hover:bg-cyan-400/10 peer-checked:bg-accent peer-checked:text-zinc-950 peer-checked:font-semibold peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent/55">
                    {place.time}
                    {place.token ? <span className="text-caption font-normal opacity-85">token {place.token}</span> : null}
                  </span>
                </label>
              ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

/**
 * Where a displaced patient lands from the email or text. Opening it never changes anything (mail
 * scanners open links too); the patient confirms a time, or confirms a cancellation, with a button.
 */
export default async function RebookPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Query> }) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const view = await findOffer(token);
  const notice = NOTICES[one(query.notice)] ?? null;

  if (view.state === "invalid") {
    return (
      <Shell>
        <PageHeading className="text-title2 font-semibold text-zinc-50 md:text-title1">This link is not valid</PageHeading>
        <p className="mt-2 max-w-prose text-body text-zinc-300">
          Use the link in the latest email or text from the practice, or see your visits under{" "}
          <Link className="text-cyan-300 underline underline-offset-4" href="/appointments">
            Appointments
          </Link>
          .
        </p>
      </Shell>
    );
  }

  await loadDoctors();
  const { offer, visit } = view;
  const doctor = findDoctor(visit.doctorId);
  const doctorName = doctor?.name ?? "your doctor";

  if (view.state !== "pending") {
    const expiresAt = practiceWallClock(new Date(offer.expiresAt));
    const heading =
      view.state === "accepted" ? "Your new time is booked" : view.state === "cancelled" ? "Your visit is cancelled" : "These times are no longer held";
    const body =
      view.state === "accepted"
        ? `Your visit ${visit.reference} with ${doctorName} is now ${when(visit)}. The reference and any payment stay the same; we have sent you a confirmation.`
        : view.state === "cancelled"
          ? `Your visit ${visit.reference} with ${doctorName} is cancelled. Anything you paid is being refunded in full; we will email you when the bank confirms it.`
          : `The times held for you lapsed on ${formatShortDate(expiresAt.date)}, ${expiresAt.time}. Your visit ${visit.reference} is cancelled and anything you paid is refunded in full.`;
    return (
      <Shell>
        <PageHeading className="text-title2 font-semibold text-zinc-50 md:text-title1">{heading}</PageHeading>
        {notice ? (
          <Notice tone="info" className="mt-6">
            {notice}
          </Notice>
        ) : null}
        <p className="mt-2 max-w-prose text-body text-zinc-300">{body}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/appointments" className={buttonClass("primary", "lg")}>
            View appointments
          </Link>
          {view.state !== "accepted" ? (
            <Link href="/book" className={buttonClass("plain", "lg")}>
              Book another time
            </Link>
          ) : null}
        </div>
      </Shell>
    );
  }

  const showMore = one(query.more) === "1" || offer.slots.length === 0;
  const asking = one(query.cancel) === "1";
  const chosen = one(query.slot);
  const more = showMore ? await moreTimes(offer, 30) : [];
  const expiresAt = practiceWallClock(new Date(offer.expiresAt));
  const until = `${formatShortDate(expiresAt.date)}, ${expiresAt.time}`;
  const here = `/rebook/${token}`;

  return (
    <Shell>
      <PageHeading className="text-title2 font-semibold text-zinc-50 md:text-title1">Pick a new time</PageHeading>
      <p className="mt-2 max-w-prose text-body text-zinc-300">
        We are sorry: {doctorName} changed their consulting hours and can no longer see you on{" "}
        <span className="tabular text-zinc-100">{when(visit)}</span>. {offer.reason}
      </p>
      <p className="mt-2 max-w-prose text-body text-zinc-300">
        Your visit keeps the reference <span className="tabular text-zinc-100">{visit.reference}</span> and any payment. If you do nothing by{" "}
        <span className="tabular text-zinc-100">{until}</span>, it is cancelled and refunded in full.
      </p>
      {notice ? (
        <Notice tone="danger" role="alert" className="mt-6">
          {notice}
        </Notice>
      ) : null}

      {asking ? (
        <form action={cancelRebookingAction} className="group mt-8 max-w-prose rounded-card border border-hairline bg-surface p-5 shadow-card">
          <input type="hidden" name="token" value={token} />
          <h2 className="text-title3 font-semibold text-zinc-50">Cancel and get a full refund</h2>
          <p className="mt-1 text-callout text-zinc-300">The held times are released and the visit is cancelled. You can book again at any time.</p>
          <label className="mt-4 flex min-h-11 items-center gap-3 text-body text-zinc-100">
            <input type="checkbox" name="confirm" value="yes" required className="size-5 accent-accent" />
            Yes, cancel visit {visit.reference}
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <PendingButton pendingLabel="Cancelling…" className={buttonClass("primary", "lg", "group-has-[[aria-busy=true]]:pointer-events-none")}>
              Cancel and refund
            </PendingButton>
            <Link href={here} className={buttonClass("plain", "lg")}>
              Pick a time instead
            </Link>
          </div>
        </form>
      ) : (
        <form action={acceptRebookingAction} className="group mt-8">
          <input type="hidden" name="token" value={token} />
          {showMore ? <input type="hidden" name="more" value="1" /> : null}
          {offer.slots.length > 0 ? (
            <>
              <h2 className="mb-3 text-title3 font-semibold text-zinc-50">Held for you until {until}</h2>
              <TimeChoices places={offer.slots} chosen={chosen} />
            </>
          ) : (
            <Notice tone="info">We could not hold a time for you. Pick any open time below, or cancel for a full refund.</Notice>
          )}
          {showMore ? (
            more.length > 0 ? (
              <>
                <h2 className="mt-8 mb-3 text-title3 font-semibold text-zinc-50">Other open times with {doctor?.short ?? doctorName}</h2>
                <p className="-mt-2 mb-3 text-callout text-zinc-300">These are not held: someone else may book one first.</p>
                <TimeChoices places={more} chosen={chosen} />
              </>
            ) : (
              <Notice tone="info" className="mt-6">
                No other times are open with {doctor?.short ?? doctorName} in the next four weeks.
              </Notice>
            )
          ) : (
            <p className="mt-4 text-callout">
              <Link className="text-cyan-300 hover:underline underline-offset-4" href={`${here}?more=1`}>
                Show more times
              </Link>
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            {offer.slots.length > 0 || more.length > 0 ? (
              <PendingButton pendingLabel="Booking…" className={buttonClass("primary", "lg", "group-has-[[aria-busy=true]]:pointer-events-none")}>
                Confirm new time
              </PendingButton>
            ) : null}
            <Link href={`${here}?cancel=1`} className={buttonClass("plain", "lg")}>
              Cancel and get a full refund
            </Link>
          </div>
        </form>
      )}
    </Shell>
  );
}
