"use client";

import { useEffect, useState } from "react";
import { SummaryRow } from "@/components/booking/AppointmentSummary";
import { Alert, Calendar, ClipboardList, Clock, Eye, Phone, UserCircle, Users } from "@/components/icons";
import { buttonClass } from "@/components/ui/button-styles";
import { Spinner } from "@/components/ui/Spinner";
import { formatFull } from "@/lib/format";
import type { PatientDetails, PatientDetailsResult } from "@/lib/patient-details";
import { tokenLabel } from "@/lib/sessions";
import { getPatientDetails } from "@/server/patient-details-actions";

const STATUS_LABELS: Record<string, string> = {
  booked: "Booked",
  completed: "Seen",
  cancelled: "Cancelled",
  no_show: "No-show",
  displaced: "Moved",
  pending_payment: "Awaiting payment",
  expired: "Expired",
};

const FAILURES: Record<Exclude<PatientDetailsResult, { ok: true }>["reason"], string> = {
  signed_out: "Your session has ended. Sign in again to see this patient.",
  missing: "This visit is no longer in the book. Reload the page.",
  forbidden: "Only this patient's doctor or the practice desk can see these details.",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase() || "?";
}

function Term({ children }: { children: string }) {
  return <span className="block text-callout text-muted">{children}</span>;
}

function Missing() {
  return <span className="text-muted">Not given</span>;
}

/** "Show details" on a queue row. Pressed while its patient is open in the sidebar. */
export function ShowDetailsButton({ patientName, selected, onClick }: { patientName: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-controls="patient-details-sidebar"
      aria-label={`Show details: ${patientName}`}
      className={buttonClass(selected ? "primary" : "secondary", "sm", "shrink-0")}
    >
      <Eye size={15} />
      {selected ? "Showing" : "Show details"}
    </button>
  );
}

/** The patient's details, laid out like the patient's own appointment summary card. */
export function PatientDetailsView({ details, footer }: { details: PatientDetails; footer?: React.ReactNode }) {
  const visitStatus =
    details.consultStartedLabel && details.status === "booked"
      ? `With the doctor since ${details.consultStartedLabel}`
      : details.checkedInLabel
        ? `Checked in at ${details.checkedInLabel}`
        : details.status === "booked"
          ? "Not checked in yet"
          : (STATUS_LABELS[details.status] ?? details.status);
  const subtitle = [details.age !== null ? `${details.age} years` : "", details.sex].filter(Boolean).join(" · ");
  return (
    <>
      <div className="mt-4 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-callout font-semibold text-accent ring-1 ring-ink/10 dark:bg-cyan-400/10 dark:text-cyan-300"
        >
          {initials(details.name)}
        </span>
        <div className="min-w-0">
          <p className="text-body font-semibold text-ink">{details.name}</p>
          <p className="text-callout text-muted">{subtitle || "Age and sex not given"}</p>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 border-t border-hairline pt-5 text-body">
        <SummaryRow icon={<Users size={20} />} term="Token">
          {details.token ? (
            <span className="tabular inline-flex items-center rounded-lg border border-accent/25 bg-accent/10 px-2.5 py-0.5 text-body font-bold text-accent dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-300">
              {tokenLabel(details.token)}
            </span>
          ) : (
            <Missing />
          )}
          <span className="mt-1 block text-callout text-muted">{visitStatus}</span>
        </SummaryRow>
        <SummaryRow icon={<Calendar size={20} />} term="Visit">
          <Term>Visit</Term>
          {formatFull(details.date)} · <span className="tabular">{details.time}</span>
          <span className="mt-1 block text-callout text-muted">
            {details.reason} · <span className="tabular">{details.reference}</span>
          </span>
        </SummaryRow>
        <SummaryRow icon={<UserCircle size={20} />} term="Patient">
          <Term>Date of birth · CHI number</Term>
          {details.dob ? formatFull(details.dob) : <Missing />}
          <span className="mt-1 block">{details.chi ? <span className="tabular">CHI {details.chi}</span> : <span className="text-muted">No CHI number</span>}</span>
        </SummaryRow>
        <SummaryRow icon={<Phone size={20} />} term="Contact">
          <Term>Contact</Term>
          {details.mobile ? <span className="tabular">{details.mobile}</span> : <Missing />}
          {details.email ? <span className="mt-1 block break-all">{details.email}</span> : null}
        </SummaryRow>
        <SummaryRow icon={<ClipboardList size={20} />} term="Payment">
          <Term>Payment</Term>
          {details.payment || <span className="text-muted">No fee recorded</span>}
        </SummaryRow>
        <SummaryRow icon={<Alert size={20} />} term="Anything the doctor should know">
          <Term>Anything the doctor should know</Term>
          <span className="whitespace-pre-wrap">{details.note.trim() || <span className="text-muted">Nothing added.</span>}</span>
        </SummaryRow>
      </dl>

      <div className="mt-5 border-t border-hairline pt-5">
        <h3 className="flex items-center gap-2 text-callout font-semibold text-muted">
          <Clock size={16} /> Past visits with this doctor
        </h3>
        {details.pastVisits.length === 0 ? (
          <p className="mt-2 text-callout text-ink-2">This is their first visit with this doctor.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {details.pastVisits.map((visit) => (
              <li key={visit.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-callout">
                <span className="text-ink">
                  {formatFull(visit.date)} · {visit.reason}
                </span>
                <span className="text-muted">
                  {STATUS_LABELS[visit.status] ?? visit.status} · <span className="tabular">{visit.reference}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {footer ? <div className="mt-5 border-t border-hairline pt-4">{footer}</div> : null}
    </>
  );
}

/**
 * The right-hand details sidebar on the queue board, in the same card as the patient's own
 * appointment summary. The details are loaded on the server for the chosen visit, which checks
 * the signed-in user may see them.
 */
export function PatientDetailsSidebar({ visitId, onClose }: { visitId: string | null; onClose: () => void }) {
  const [loaded, setLoaded] = useState<{ visitId: string; result: PatientDetailsResult } | null>(null);

  useEffect(() => {
    if (!visitId) return;
    let live = true;
    getPatientDetails(visitId)
      .then((result) => live && setLoaded({ visitId, result }))
      .catch(() => live && setLoaded({ visitId, result: { ok: false, reason: "missing" } }));
    return () => {
      live = false;
    };
  }, [visitId]);

  const result = visitId && loaded?.visitId === visitId ? loaded.result : null;

  return (
    // The same card as the patient's appointment summary (Card styles), as a labelled section.
    <section
      id="patient-details-sidebar"
      aria-labelledby="patient-details-heading"
      className="rounded-card border border-ink/10 bg-surface p-5 shadow-card backdrop-blur-md md:p-6"
    >
      <h2 id="patient-details-heading" className="text-callout font-semibold text-muted">
        Patient details
      </h2>
      {!visitId ? (
        <p className="mt-4 text-body text-ink-2">Choose Show details on a patient in the queue to see their details here.</p>
      ) : !result ? (
        <p className="mt-4 flex items-center gap-2 text-callout text-ink-2" aria-live="polite">
          <Spinner /> Loading details…
        </p>
      ) : result.ok ? (
        <PatientDetailsView
          details={result.details}
          footer={
            <button type="button" onClick={onClose} className={buttonClass("plain", "sm")}>
              Hide details
            </button>
          }
        />
      ) : (
        <p role="alert" className="mt-4 text-callout text-ink-2">
          {FAILURES[result.reason]}
        </p>
      )}
    </section>
  );
}
