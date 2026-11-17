import type { AppointmentRecord } from "@/lib/clinic-types";
import { RATING_NOTE_LIMIT } from "@/lib/rating";
import { rateVisit } from "@/server/booking-actions";
import { buttonClass } from "@/components/ui/button-styles";
import { PendingButton } from "@/components/ui/PendingButton";

const SCORES = [1, 2, 3, 4, 5] as const;

/** Shown on a completed visit. The patient sends one score; after that the same card shows what they sent. */
export function RateVisit({
  visit,
  doctorName,
  returnTo,
  notice = "",
}: {
  visit: Pick<AppointmentRecord, "id" | "status" | "ratingScore" | "ratingNote">;
  doctorName: string;
  returnTo: string;
  notice?: string;
}) {
  if (visit.status !== "completed") return null;

  if (visit.ratingScore != null) {
    return (
      <div className="mt-4 rounded-card border border-hairline bg-surface-2 px-4 py-3">
        <p className="text-callout font-semibold text-ink">
          You rated {doctorName} {visit.ratingScore} out of 5.
        </p>
        {visit.ratingNote ? <p className="mt-1 text-callout text-ink-2">“{visit.ratingNote}”</p> : null}
      </div>
    );
  }

  const noteId = `rating-note-${visit.id}`;
  return (
    <form action={rateVisit} className="mt-4">
      <input type="hidden" name="id" value={visit.id} />
      <input type="hidden" name="return" value={returnTo} />
      <fieldset>
        <legend className="text-callout font-semibold text-ink">How was your visit with {doctorName}?</legend>
        <p className="mt-1 text-caption text-muted">1 is poor, 5 is excellent. You can send this once.</p>
        {notice ? (
          <p role="alert" className="mt-2 text-callout text-warn">
            {notice}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {SCORES.map((score) => (
            <label
              key={score}
              className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-hairline bg-surface px-3 text-body font-semibold text-ink has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-canvas"
            >
              <input type="radio" name="score" value={score} required className="size-4 accent-current" />
              {score}
            </label>
          ))}
        </div>
        <label htmlFor={noteId} className="mt-3 block text-callout text-ink-2">
          A short note, if you want
          <textarea id={noteId} name="note" rows={2} maxLength={RATING_NOTE_LIMIT} className="field mt-1 resize-y" />
        </label>
      </fieldset>
      <PendingButton pendingLabel="Sending…" className={buttonClass("primary", "md", "mt-3")}>
        Send rating
      </PendingButton>
    </form>
  );
}
