"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { Close, Eye } from "@/components/icons";
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 py-2">
      <dt className="text-callout text-muted">{label}</dt>
      <dd className="min-w-0 text-callout break-words text-ink">{children}</dd>
    </div>
  );
}

function Missing() {
  return <span className="text-muted">Not given</span>;
}

export function PatientDetailsView({ details }: { details: PatientDetails }) {
  const visitStatus =
    details.consultStartedLabel && details.status === "booked"
      ? `With the doctor since ${details.consultStartedLabel}`
      : details.checkedInLabel
        ? `Checked in at ${details.checkedInLabel}`
        : details.status === "booked"
          ? "Not checked in yet"
          : (STATUS_LABELS[details.status] ?? details.status);
  return (
    <div className="grid gap-5">
      <section aria-label="Patient">
        <h3 className="text-caption font-semibold tracking-wider text-muted uppercase">Patient</h3>
        <dl className="mt-1 divide-y divide-hairline">
          <Row label="Name">{details.name}</Row>
          <Row label="Age">
            {details.age !== null ? (
              <>
                <span className="tabular">{details.age}</span> years
                {details.dob ? <span className="text-ink-2"> · born {formatFull(details.dob)}</span> : null}
              </>
            ) : (
              <Missing />
            )}
          </Row>
          <Row label="Sex">{details.sex || <Missing />}</Row>
          <Row label="Mobile">{details.mobile ? <span className="tabular">{details.mobile}</span> : <Missing />}</Row>
          <Row label="Email">{details.email || <Missing />}</Row>
          <Row label="CHI number">{details.chi ? <span className="tabular">{details.chi}</span> : <Missing />}</Row>
        </dl>
      </section>

      <section aria-label="This visit">
        <h3 className="text-caption font-semibold tracking-wider text-muted uppercase">This visit</h3>
        <dl className="mt-1 divide-y divide-hairline">
          <Row label="Token">{details.token ? <span className="font-semibold tabular">{tokenLabel(details.token)}</span> : <Missing />}</Row>
          <Row label="Reference">
            <span className="tabular">{details.reference}</span>
          </Row>
          <Row label="When">
            {formatFull(details.date)} · <span className="tabular">{details.time}</span>
          </Row>
          <Row label="Reason">{details.reason}</Row>
          <Row label="Status">{visitStatus}</Row>
          <Row label="Payment">{details.payment || <span className="text-muted">No fee recorded</span>}</Row>
        </dl>
        <div className="mt-3 rounded-[10px] border border-hairline bg-surface-2 p-3">
          <p className="text-caption font-semibold text-muted">Anything the doctor should know</p>
          <p className="mt-1 text-callout whitespace-pre-wrap text-ink">{details.note.trim() || <span className="text-muted">Nothing added.</span>}</p>
        </div>
      </section>

      <section aria-label="Past visits">
        <h3 className="text-caption font-semibold tracking-wider text-muted uppercase">Past visits with this doctor</h3>
        {details.pastVisits.length === 0 ? (
          <p className="mt-2 text-callout text-ink-2">This is their first visit with this doctor.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {details.pastVisits.map((visit) => (
              <li key={visit.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-[10px] border border-hairline p-2.5">
                <span className="text-callout text-ink">
                  {formatFull(visit.date)} · {visit.reason}
                </span>
                <span className="text-caption text-muted">
                  {STATUS_LABELS[visit.status] ?? visit.status} · <span className="tabular">{visit.reference}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** "Show details" on a queue row: opens a side panel with the patient's details, loaded on the server. */
export function PatientDetailsButton({ visitId, patientName }: { visitId: string; patientName: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<PatientDetailsResult | null>(null);
  const [pending, startTransition] = useTransition();
  const trigger = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  function show() {
    setOpen(true);
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await getPatientDetails(visitId));
      } catch {
        setResult({ ok: false, reason: "missing" });
      }
    });
  }

  useEffect(() => {
    if (!open) return;
    closer.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={show}
        className={buttonClass("secondary", "sm")}
        aria-haspopup="dialog"
        aria-label={`Show details: ${patientName}`}
      >
        <Eye size={15} />
        Show details
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" tabIndex={-1} aria-label="Close patient details" onClick={close} className="absolute inset-0 cursor-default bg-black/40" />
          <dialog
            open
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative m-0 ml-auto flex h-full max-h-none w-full max-w-md flex-col border-0 border-l border-hairline bg-canvas p-0 text-ink shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
              <div className="min-w-0">
                <p className="text-caption font-semibold tracking-wider text-muted uppercase">Patient details</p>
                <h2 id={titleId} className="truncate text-title3 font-semibold text-ink">
                  {patientName}
                </h2>
              </div>
              <button
                ref={closer}
                type="button"
                onClick={close}
                aria-label="Close patient details"
                className="rounded-md p-1.5 text-muted transition-colors hover:bg-fill hover:text-ink"
              >
                <Close size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {pending || !result ? (
                <output className="flex items-center gap-2 text-callout text-ink-2">
                  <Spinner /> Loading details…
                </output>
              ) : result.ok ? (
                <PatientDetailsView details={result.details} />
              ) : (
                <p role="alert" className="text-callout text-ink-2">
                  {FAILURES[result.reason]}
                </p>
              )}
            </div>
          </dialog>
        </div>
      ) : null}
    </>
  );
}
