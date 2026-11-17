"use client";

import { Card } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/button-styles";
import { PendingButton } from "@/components/ui/PendingButton";
import type { AppointmentRecord } from "@/lib/clinic-types";
import { reasons } from "@/lib/data";
import { clinicQueues, queueClock as clockLabel, type ClinicQueue } from "@/lib/queue";
import { tokenLabel } from "@/lib/sessions";
import { queueVisit, updateVisit } from "@/server/booking-actions";

export interface QueueBoardProps {
  visits: readonly AppointmentRecord[];
  today: string;
  doctorNames: Record<string, string>;
  returnTo: string;
  /** Show whose clinic each queue is (reception and admins see every doctor). */
  showDoctor: boolean;
}


/** The token patients see: the wave token, or the slot's place in a fixed-slot session (#75). */
export function visitToken(visit: AppointmentRecord): number | null {
  const placed = visit as AppointmentRecord & { queueToken?: number | null };
  return placed.queueToken ?? visit.token ?? null;
}

function reasonLabel(id: string): string {
  return reasons.find((reason) => reason.id === id)?.label ?? "Appointment";
}

function StepForm({ visit, step, label, pending, returnTo, variant }: {
  visit: AppointmentRecord;
  step: "check_in" | "start_consult" | "no_show";
  label: string;
  pending: string;
  returnTo: string;
  variant: "primary" | "secondary";
}) {
  return (
    <form action={queueVisit}>
      <input type="hidden" name="id" value={visit.id} />
      <input type="hidden" name="step" value={step} />
      <input type="hidden" name="return" value={returnTo} />
      <PendingButton pendingLabel={pending} className={buttonClass(variant, "sm")} aria-label={`${label}: ${visit.patientName}`}>
        {label}
      </PendingButton>
    </form>
  );
}

function PatientLine({ visit, place }: { visit: AppointmentRecord; place?: number }) {
  const token = visitToken(visit);
  return (
    <div className="min-w-0">
      <p className="text-body font-semibold text-ink">
        {place ? <span className="mr-2 text-muted tabular">{place}.</span> : null}
        {visit.patientName}
      </p>
      <p className="mt-0.5 text-callout text-ink-2">
        {token ? <span className="font-semibold text-ink tabular">{tokenLabel(token)}</span> : <span className="tabular">{visit.time}</span>}
        <span aria-hidden="true"> · </span>
        {reasonLabel(visit.reasonId)}
        <span aria-hidden="true"> · </span>
        <span className="tabular">{visit.reference}</span>
      </p>
    </div>
  );
}

function QueueCard({ queue, doctorName, returnTo }: { queue: ClinicQueue; doctorName: string | null; returnTo: string }) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-body font-semibold text-ink">
          {doctorName ?? "Your clinic"} <span className="font-normal text-ink-2 tabular">from {queue.start}</span>
        </h3>
        <p className="text-caption text-muted tabular">
          {queue.arrived} checked in · {queue.upNext.length} waiting · {queue.completed} seen · {queue.noShows} no-show
        </p>
      </div>

      <h4 className="mt-4 text-caption font-semibold tracking-wider text-muted uppercase">Now seeing</h4>
      {queue.seeing.length === 0 ? (
        <p className="mt-2 text-callout text-ink-2">Nobody is with the doctor. Start the consultation for the next patient.</p>
      ) : (
        <ul className="mt-2 grid gap-2">
          {queue.seeing.map((visit) => (
            <li key={visit.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-success/30 bg-success-soft p-3">
              <div>
                <PatientLine visit={visit} />
                <p className="mt-1 text-caption font-semibold text-success">
                  With the doctor since <time dateTime={visit.consultStartedAt ?? ""}>{visit.consultStartedAt ? clockLabel(visit.consultStartedAt) : ""}</time>
                </p>
              </div>
              <form action={updateVisit}>
                <input type="hidden" name="id" value={visit.id} />
                <input type="hidden" name="status" value="completed" />
                <input type="hidden" name="return" value={returnTo} />
                <PendingButton pendingLabel="Updating…" className={buttonClass("primary", "sm")} aria-label={`Mark ${visit.patientName} completed`}>
                  Mark completed
                </PendingButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      <h4 className="mt-5 text-caption font-semibold tracking-wider text-muted uppercase">Up next</h4>
      {queue.upNext.length === 0 ? (
        <p className="mt-2 text-callout text-ink-2">Nobody else is waiting in this clinic.</p>
      ) : (
        <ol className="mt-2 grid gap-2">
          {queue.upNext.map((visit, index) => (
            <li key={visit.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-hairline bg-surface-2 p-3">
              <div>
                <PatientLine visit={visit} place={index + 1} />
                {visit.checkedInAt ? (
                  <p className="mt-1 text-caption font-semibold text-accent">
                    Checked in at <time dateTime={visit.checkedInAt}>{clockLabel(visit.checkedInAt)}</time>
                  </p>
                ) : (
                  <p className="mt-1 text-caption text-muted">Not checked in yet</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {visit.checkedInAt ? null : (
                  <StepForm visit={visit} step="check_in" label="Check in" pending="Checking in…" returnTo={returnTo} variant="primary" />
                )}
                <StepForm
                  visit={visit}
                  step="start_consult"
                  label="Start consult"
                  pending="Calling in…"
                  returnTo={returnTo}
                  variant={visit.checkedInAt ? "primary" : "secondary"}
                />
                {visit.checkedInAt ? null : (
                  <StepForm visit={visit} step="no_show" label="No-show" pending="Updating…" returnTo={returnTo} variant="secondary" />
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** Today's clinics as the room runs them: who is with the doctor now, and who is up next. */
export function QueueBoard({ visits, today, doctorNames, returnTo, showDoctor }: QueueBoardProps) {
  const queues = clinicQueues(visits, today);
  return (
    <section aria-labelledby="queue-board-heading" className="mt-6">
      <h2 id="queue-board-heading" className="text-title3 font-semibold text-ink">
        Today&apos;s queue
      </h2>
      <p className="mt-1 text-callout text-ink-2">
        Checked-in patients go ahead of those not here yet. A no-show leaves the queue, and everyone behind moves up.
      </p>
      {queues.length === 0 ? (
        <Card className="mt-4 p-5">
          <p className="text-body text-ink-2">No patients are booked today.</p>
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {queues.map((queue) => (
            <QueueCard
              key={queue.key}
              queue={queue}
              doctorName={showDoctor ? (doctorNames[queue.doctorId] ?? "Doctor") : null}
              returnTo={returnTo}
            />
          ))}
        </div>
      )}
    </section>
  );
}
