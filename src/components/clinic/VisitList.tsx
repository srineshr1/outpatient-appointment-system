import { reasons, findDoctor } from "@/lib/data";
import type { AppointmentRecord } from "@/lib/clinic-types";
import { formatPhone, formatWhen } from "@/lib/format";
import { updateVisit } from "@/server/booking-actions";
import { buttonClass } from "@/components/ui/button-styles";

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
  return "Booked";
}

export function groupVisits(visits: readonly AppointmentRecord[], today: string) {
  const todayVisits: AppointmentRecord[] = [];
  const upcoming: AppointmentRecord[] = [];
  const earlier: AppointmentRecord[] = [];
  const cancelled: AppointmentRecord[] = [];
  const ordered = [...visits].sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
  for (const visit of ordered) {
    if (visit.status === "cancelled") cancelled.push(visit);
    else if (visit.date === today) todayVisits.push(visit);
    else if (visit.date > today) upcoming.push(visit);
    else earlier.push(visit);
  }
  return { todayVisits, upcoming, earlier, cancelled };
}

export function VisitList({
  visits,
  today,
  mode,
  returnTo,
  payments = {},
}: {
  visits: AppointmentRecord[];
  today: string;
  mode: Mode;
  returnTo: string;
  /** A short payment line per visit id, such as "Paid £40.00". */
  payments?: Readonly<Record<string, string>>;
}) {
  const groups = groupVisits(visits, today);
  const sections = [
    ["Today", groups.todayVisits],
    ["Upcoming", groups.upcoming],
    ["Earlier", groups.earlier],
    ["Cancelled", groups.cancelled],
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
                      <span className="tabular">{formatWhen(visit, today)}</span>
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
                    {visit.note ? <p className="mt-3 text-callout whitespace-pre-line text-ink-2">{visit.note}</p> : null}
                    {visit.status === "booked" ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {mode === "clinic" ? (
                          <form action={updateVisit}>
                            <input type="hidden" name="id" value={visit.id} />
                            <input type="hidden" name="status" value="completed" />
                            <input type="hidden" name="return" value={returnTo} />
                            <button
                              type="submit"
                              className={buttonClass("secondary")}
                              aria-label={`Mark complete, ${visit.patientName}, ${formatWhen(visit, today)}`}
                            >
                              Mark complete
                            </button>
                          </form>
                        ) : null}
                        <form action={updateVisit}>
                          <input type="hidden" name="id" value={visit.id} />
                          <input type="hidden" name="status" value="cancelled" />
                          <input type="hidden" name="return" value={returnTo} />
                          <button
                            type="submit"
                            className={buttonClass("plain")}
                            aria-label={`Cancel ${mode === "clinic" ? visit.patientName : "this visit"}, ${formatWhen(visit, today)}`}
                          >
                            Cancel visit
                          </button>
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
