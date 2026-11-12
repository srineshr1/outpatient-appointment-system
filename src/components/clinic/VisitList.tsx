import { PRACTICE_TZ } from "@/lib/clock";
import Link from "next/link";
import { reasons, findDoctor } from "@/lib/data";
import type { AppointmentRecord, RescheduleRecord } from "@/lib/clinic-types";
import { formatPhone, formatShortDate, formatWhen } from "@/lib/format";
import { slotTimeLabel } from "@/lib/sessions";
import { updateVisit } from "@/server/booking-actions";
import { buttonClass } from "@/components/ui/button-styles";
import { PendingButton } from "@/components/ui/PendingButton";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

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
  if (status === "displaced") return "Hours removed, new time pending";
  return "Booked";
}

function statusPillClass(status: AppointmentRecord["status"]): string {
  if (status === "completed") return "border-emerald-400/25 bg-emerald-400/12 text-emerald-300";
  if (status === "pending_payment" || status === "displaced") return "border-amber-400/25 bg-amber-400/12 text-amber-300";
  if (status === "cancelled" || status === "expired") return "border-white/15 bg-white/[0.06] text-zinc-300";
  return "border-cyan-400/25 bg-cyan-400/12 text-cyan-300";
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
  return `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: PRACTICE_TZ }).format(new Date(at))}`;
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
    else if (visit.status === "cancelled" || visit.status === "expired" || visit.status === "displaced") cancelled.push(visit);
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
    ["Cancelled, expired or displaced", groups.cancelled],
  ] as const;
  const any = sections.some(([, items]) => items.length > 0);

  if (!any) {
    return (
      <p className="mt-8 max-w-prose rounded-card border border-hairline bg-surface-2 px-5 py-6 text-body text-zinc-300">
        {mode === "clinic" ? "No visits on this book yet. They appear here as soon as a patient books." : "You have no visits yet."}
      </p>
    );
  }

  return (
    <div className="mt-8 grid gap-10">
      {sections.map(([title, items]) =>
        items.length === 0 ? null : (
          <section key={title} aria-labelledby={`visits-${title.toLowerCase()}`}>
            <h2 id={`visits-${title.toLowerCase()}`} className="text-title3 font-semibold text-zinc-50">
              {title}
              <span className="ml-2 text-callout font-normal text-zinc-400">
                <span className="sr-only">, </span>
                {items.length}
              </span>
            </h2>
            <ul className="mt-4 grid gap-3">
              {items.map((visit) => (
                <li key={visit.id}>
                  <SpotlightCard as="article" className="rounded-card! p-5">
                    <div className="relative z-10">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-body font-semibold text-zinc-50">
                          {mode === "clinic" ? visit.patientName : doctorName(visit.doctorId)}
                        </h3>
                        <p className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-caption font-semibold ${statusPillClass(visit.status)}`}>
                          {statusLabel(visit.status)}
                        </p>
                      </div>
                      <p className="mt-1 text-body text-zinc-300">
                        <span className="tabular">{formatWhen({ date: visit.date, time: whenLabel(visit) }, today)}</span>
                        {mode === "clinic" ? ` · ${doctorName(visit.doctorId)}` : null}
                        {` · ${reasonLabel(visit.reasonId)}`}
                      </p>
                      <p className="mt-2 text-callout text-zinc-400">
                        Reference <span className="tabular text-zinc-100">{visit.reference}</span>
                        {payments[visit.id] ? (
                          <>
                            {" "}
                            · <span className="tabular text-zinc-100">{payments[visit.id]}</span>
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
                        <p className="mt-1 text-callout text-zinc-300">
                          Token <span className="tabular font-semibold text-zinc-50">{visit.token}</span> of {visit.waveCapacity ?? "?"} in
                          this wave. Seen in token order.
                        </p>
                      ) : null}
                      {(moves[visit.id] ?? []).length > 0 ? (
                        <ul aria-label="History of moves" className="mt-2 grid gap-1 text-callout text-zinc-400">
                          {(moves[visit.id] ?? []).map((move) => (
                            <li key={move.id}>
                              Moved by {move.byName} ({roleLabel(move.byRole)}) from{" "}
                              <span className="tabular text-zinc-200">{spot(move.fromDate, move.fromTime, move.fromToken)}</span> to{" "}
                              <span className="tabular text-zinc-200">{spot(move.toDate, move.toTime, move.toToken)}</span> on{" "}
                              <span className="tabular">{movedOn(move.at)}</span>
                              {move.reason ? `. “${move.reason}”` : "."}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {visit.note ? <p className="mt-3 text-callout whitespace-pre-line text-zinc-300">{visit.note}</p> : null}
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
                    </div>
                  </SpotlightCard>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}
