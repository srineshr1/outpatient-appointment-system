import Link from "next/link";
import { reasons, findDoctor } from "@/lib/data";
import type { AppointmentRecord, RescheduleRecord } from "@/lib/clinic-types";
import { formatPhone, formatShortDate, formatWhen } from "@/lib/format";
import { slotTimeLabel } from "@/lib/sessions";
import { updateVisit } from "@/server/booking-actions";
import { buttonClass } from "@/components/ui/button-styles";
import { PendingButton } from "@/components/ui/PendingButton";

type Mode = "patient" | "clinic";

function reasonLabel(id: string): string {
  return reasons.find((reason) => reason.id === id)?.label ?? "Appointment";
}

function doctorName(id: string): string {
  return findDoctor(id)?.name ?? "Your doctor";
}

function statusLabel(status: AppointmentRecord["status"]): string {
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (status === "pending_payment") return "Awaiting payment";
  if (status === "expired") return "Hold expired";
  return "Booked";
}

function whenLabel(visit: AppointmentRecord): string {
  return visit.endTime && visit.token ? slotTimeLabel({ time: visit.time, endTime: visit.endTime, mode: "wave" }) : visit.time;
}

function spot(date: string, time: string, token: number | null): string {
  return `${formatShortDate(date)}, ${time}${token ? ` (token ${token})` : ""}`;
}

function roleLabel(role: string): string {
  return role === "patient" ? "patient" : role === "doctor" ? "doctor" : "clinic desk";
}

function movedOn(at: string): string {
  return `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(at))}`;
}

export function groupVisits(visits: readonly AppointmentRecord[], today: string) {
  const todayVisits: AppointmentRecord[] = [];
  const upcoming: AppointmentRecord[] = [];
  const earlier: AppointmentRecord[] = [];
  const cancelled: AppointmentRecord[] = [];
  const awaiting: AppointmentRecord[] = [];
  const ordered = [...visits].sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
  for (const visit of ordered) {
    if (visit.status === "pending_payment") awaiting.push(visit);
    else if (visit.status === "cancelled" || visit.status === "expired") cancelled.push(visit);
    else if (visit.date === today) todayVisits.push(visit);
    else if (visit.date > today) upcoming.push(visit);
    else earlier.push(visit);
  }
  return { awaiting, todayVisits, upcoming, earlier, cancelled };
}

export function VisitList({
  visits,
  today,
  mode,
  returnTo,
  payments = {},
  moves = {},
}: {
  visits: AppointmentRecord[];
  today: string;
  mode: Mode;
  returnTo: string;
  /** A short payment line per visit id, such as "Paid ₹400.00". */
  payments?: Readonly<Record<string, string>>;
  /** Moves made to each visit, oldest first, keyed by visit id. */
  moves?: Readonly<Record<string, RescheduleRecord[]>>;
}) {
  const groups = groupVisits(visits, today);
  const sections = [
    ["Awaiting payment", groups.awaiting],
    ["Today", groups.todayVisits],
    ["Upcoming", groups.upcoming],
    ["Earlier", groups.earlier],
    ["Cancelled or expired", groups.cancelled],
  ] as const;
  const any = sections.some(([, items]) => items.length > 0);

  if (!any) {
    return (
      <p className="mt-8 max-w-prose text-body text-ink-2">
        {mode === "clinic" ? "No visits on this book yet. They appear here as soon as a patient books." : "You have no visits yet."}
      </p>
    );
  }

  return (
    <div className="mt-8 grid gap-10">
      {sections.map(([title, items]) =>
        items.length === 0 ? null : (
          <section key={title} aria-labelledby={`visits-${title.toLowerCase()}`}>
            <h2 id={`visits-${title.toLowerCase()}`} className="text-title3 font-semibold text-ink">
              {title}
              <span className="ml-2 text-callout font-normal text-muted">
                <span className="sr-only">, </span>
                {items.length}
              </span>
            </h2>
            <ul className="mt-4 grid gap-3">
              {items.map((visit) => (
                <li key={visit.id}>
                  <article className="rounded-card bg-surface p-5 shadow-card">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-body font-semibold text-ink">
                        {mode === "clinic" ? visit.patientName : doctorName(visit.doctorId)}
                      </h3>
                      <p className="text-callout font-medium text-muted">{statusLabel(visit.status)}</p>
                    </div>
                    <p className="mt-1 text-body text-ink-2">
                      <span className="tabular">{formatWhen({ date: visit.date, time: whenLabel(visit) }, today)}</span>
                      {mode === "clinic" ? ` · ${doctorName(visit.doctorId)}` : null}
                      {` · ${reasonLabel(visit.reasonId)}`}
                    </p>
                    <p className="mt-2 text-callout text-muted">
                      Reference <span className="tabular text-ink">{visit.reference}</span>
                      {payments[visit.id] ? (
                        <>
                          {" "}
                          · <span className="tabular text-ink">{payments[visit.id]}</span>
                        </>
                      ) : null}
                      {visit.patientMobile ? (
                        <>
                          {" "}
                          · <span className="tabular">{formatPhone(visit.patientMobile)}</span>
                        </>
                      ) : null}
                      {mode === "clinic" && visit.patientChi ? (
                        <>
                          {" "}
                          · CHI <span className="tabular">{visit.patientChi}</span>
                        </>
                      ) : null}
                    </p>
                    {visit.token ? (
                      <p className="mt-1 text-callout text-ink-2">
                        Token <span className="tabular font-semibold text-ink">{visit.token}</span> of {visit.waveCapacity ?? "?"} in
                        this wave. Seen in token order.
                      </p>
                    ) : null}
                    {(moves[visit.id] ?? []).length > 0 ? (
                      <ul aria-label="History of moves" className="mt-2 grid gap-1 text-callout text-muted">
                        {(moves[visit.id] ?? []).map((move) => (
                          <li key={move.id}>
                            Moved by {move.byName} ({roleLabel(move.byRole)}) from{" "}
                            <span className="tabular text-ink-2">{spot(move.fromDate, move.fromTime, move.fromToken)}</span> to{" "}
                            <span className="tabular text-ink-2">{spot(move.toDate, move.toTime, move.toToken)}</span> on{" "}
                            <span className="tabular">{movedOn(move.at)}</span>
                            {move.reason ? `. “${move.reason}”` : "."}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {visit.note ? <p className="mt-3 text-callout whitespace-pre-line text-ink-2">{visit.note}</p> : null}
                    {visit.status === "pending_payment" ? (
                      <div className="group mt-4 flex flex-wrap gap-2">
                        {mode === "patient" ? (
                          <Link href={`/pay/${visit.id}`} className={buttonClass("primary", "md")}>
                            Pay now
                          </Link>
                        ) : null}
                        <form action={updateVisit}>
                          <input type="hidden" name="id" value={visit.id} />
                          <input type="hidden" name="status" value="cancelled" />
                          <input type="hidden" name="return" value={returnTo} />
                          <PendingButton
                            pendingLabel="Releasing…"
                            className={buttonClass("plain", "md", "group-has-[[aria-busy=true]]:pointer-events-none")}
                            aria-label={`Give up the held place, ${formatWhen(visit, today)}`}
                          >
                            Give up this place
                          </PendingButton>
                        </form>
                      </div>
                    ) : null}
                    {visit.status === "booked" ? (
                      <div className="group mt-4 flex flex-wrap gap-2">
                        {mode === "clinic" ? (
                          <form action={updateVisit}>
                            <input type="hidden" name="id" value={visit.id} />
                            <input type="hidden" name="status" value="completed" />
                            <input type="hidden" name="return" value={returnTo} />
                            <PendingButton
                              pendingLabel="Marking complete…"
                              className={buttonClass("secondary", "md", "group-has-[[aria-busy=true]]:pointer-events-none")}
                              aria-label={`Mark complete, ${visit.patientName}, ${formatWhen(visit, today)}`}
                            >
                              Mark complete
                            </PendingButton>
                          </form>
                        ) : null}
                        {visit.date >= today ? (
                          <Link
                            href={`/reschedule/${visit.id}?return=${encodeURIComponent(returnTo)}`}
                            className={buttonClass("secondary", "md")}
                            aria-label={`Reschedule ${mode === "clinic" ? visit.patientName : "this visit"}, ${formatWhen(visit, today)}`}
                          >
                            Reschedule
                          </Link>
                        ) : null}
                        <form action={updateVisit}>
                          <input type="hidden" name="id" value={visit.id} />
                          <input type="hidden" name="status" value="cancelled" />
                          <input type="hidden" name="return" value={returnTo} />
                          <PendingButton
                            pendingLabel="Cancelling…"
                            className={buttonClass("plain", "md", "group-has-[[aria-busy=true]]:pointer-events-none")}
                            aria-label={`Cancel ${mode === "clinic" ? visit.patientName : "this visit"}, ${formatWhen(visit, today)}`}
                          >
                            Cancel visit
                          </PendingButton>
                        </form>
                      </div>
                    ) : null}
                  </article>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}
