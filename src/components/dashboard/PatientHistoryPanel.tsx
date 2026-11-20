"use client";

import { Calendar, ClipboardList, Clock, Phone, UserCircle } from "@/components/icons";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import type { AppointmentStatus } from "@/lib/clinic-types";
import type { PatientDetails, PastVisit } from "@/lib/patient-history";
import { tokenLabel } from "@/lib/sessions";

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  booked: "Booked",
  completed: "Seen",
  cancelled: "Cancelled",
  pending_payment: "Awaiting payment",
  expired: "Expired",
  displaced: "Moved",
  no_show: "No-show",
};

const STATUS_TONE: Partial<Record<AppointmentStatus, string>> = {
  completed: "bg-success-soft text-success",
  no_show: "bg-warn-soft text-warn",
  cancelled: "bg-surface-2 text-muted",
};

function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** Where the patient is today: with the doctor, checked in, or not here yet. */
function arrivalLine(details: PatientDetails): string {
  if (details.status === "completed") return "Seen";
  if (details.consultStartedLabel) return `With you since ${details.consultStartedLabel}`;
  if (details.checkedInLabel) return `Checked in at ${details.checkedInLabel}`;
  return "Not checked in yet";
}

function StatusPill({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-caption font-semibold ${STATUS_TONE[status] ?? "bg-accent-soft text-accent"}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/** The session's patients in queue order. Picking one shows their details and history on the right. */
export function SessionPatientList({
  patients,
  selectedId,
  onSelect,
}: {
  patients: readonly PatientDetails[];
  selectedId: string | null;
  onSelect: (visitId: string) => void;
}) {
  return (
    <Card className="rounded-sheet p-5">
      <h2 id="session-patients-heading" className="text-body font-semibold text-ink">
        Patients in this session
      </h2>
      <p className="mt-1 text-caption text-muted">Pick a patient to see their details and previous visits.</p>
      <ul aria-labelledby="session-patients-heading" className="mt-3 grid gap-2">
        {patients.map((item) => {
          const active = item.visitId === selectedId;
          return (
            <li key={item.visitId}>
              <button
                type="button"
                onClick={() => onSelect(item.visitId)}
                aria-pressed={active}
                className={`flex w-full items-center justify-between gap-3 rounded-[10px] border p-3 text-left transition-colors ${
                  active ? "border-accent bg-accent-soft" : "border-hairline bg-surface-2 hover:border-accent/40"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-body font-semibold text-ink">{item.name}</span>
                  <span className="mt-0.5 block text-caption text-ink-2">
                    {item.token ? <span className="font-semibold text-ink tabular">{tokenLabel(item.token)}</span> : <span className="tabular">{item.time}</span>}
                    <span aria-hidden="true"> · </span>
                    {arrivalLine(item)}
                  </span>
                </span>
                <span className="shrink-0 text-caption text-muted tabular">
                  {item.pastVisits.length} {item.pastVisits.length === 1 ? "past visit" : "past visits"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-3">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div className="min-w-0">
        <p className="text-caption font-semibold tracking-wider text-muted uppercase">{label}</p>
        <div className="mt-0.5 text-callout text-ink">{children}</div>
      </div>
    </div>
  );
}

function PastVisitItem({ visit }: { visit: PastVisit }) {
  return (
    <li className="rounded-[10px] border border-hairline bg-surface-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-callout font-semibold text-ink">
          <time dateTime={visit.date}>{dayLabel(visit.date)}</time>
          <span className="font-normal text-ink-2 tabular"> · {visit.time}</span>
        </p>
        <StatusPill status={visit.status} />
      </div>
      <p className="mt-1 text-callout text-ink-2">
        {visit.reason}
        <span aria-hidden="true"> · </span>
        <span className="tabular">{visit.reference}</span>
        {visit.rating ? (
          <>
            <span aria-hidden="true"> · </span>
            <span aria-label={`Rated ${visit.rating} out of 5`}>{"★".repeat(visit.rating)}</span>
          </>
        ) : null}
      </p>
      {visit.note ? <p className="mt-1.5 text-callout text-ink">“{visit.note}”</p> : null}
    </li>
  );
}

/** The selected patient's details and previous visits, in the page's right-hand column (not a drawer). */
export function PatientHistoryPanel({ details }: { details: PatientDetails }) {
  const age = details.age !== null ? `${details.age} years old` : "Age not given";
  return (
    <section aria-label="Patient details and history">
    <Card className="rounded-sheet p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-4">
        <div className="min-w-0">
          <p className="text-caption font-semibold tracking-wider text-muted uppercase">Patient</p>
          <h2 className="mt-1 text-title3 font-semibold text-ink">{details.name}</h2>
          <p className="mt-0.5 text-callout text-ink-2">
            {age}
            {details.dob ? <span className="tabular"> · born {dayLabel(details.dob)}</span> : null}
          </p>
        </div>
        {details.token ? (
          <span className="rounded-full bg-success-soft px-3 py-1 text-callout font-semibold text-success tabular">{tokenLabel(details.token)}</span>
        ) : null}
      </div>

      <div className="divide-y divide-hairline">
        <Row icon={<ClipboardList size={16} />} label="This visit">
          {details.reason}
          <span aria-hidden="true"> · </span>
          <span className="tabular">{details.reference}</span>
          {details.note ? <p className="mt-1 text-ink-2">“{details.note}”</p> : null}
        </Row>
        <Row icon={<Clock size={16} />} label="Today">
          {arrivalLine(details)}
          {details.payment ? <p className="mt-1 text-ink-2">{details.payment}</p> : null}
        </Row>
        <Row icon={<Phone size={16} />} label="Contact">
          <span className="tabular">{details.mobile || "No mobile given"}</span>
          {details.chi ? <p className="mt-1 text-ink-2 tabular">CHI {details.chi}</p> : null}
        </Row>
      </div>

      <div className="mt-2 border-t border-hairline pt-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-accent" />
          <h3 className="text-body font-semibold text-ink">Previous visits</h3>
          <span className="text-caption text-muted tabular">({details.pastVisits.length})</span>
        </div>
        {details.pastVisits.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-callout text-ink-2">
            <UserCircle size={16} className="text-muted" />
            First visit with you. No earlier visits on record.
          </p>
        ) : (
          <ol className="mt-3 grid gap-2">
            {details.pastVisits.map((visit) => (
              <PastVisitItem key={visit.id} visit={visit} />
            ))}
          </ol>
        )}
      </div>
    </Card>
    </section>
  );
}
