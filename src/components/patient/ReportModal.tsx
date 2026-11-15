"use client";

import { useEffect, useState } from "react";
import type { MedicalReport } from "@/lib/patient-reports";
import { practice } from "@/lib/data";
import { Check, Close, Pin } from "@/components/icons";
import { Button } from "@/components/ui/Button";

interface Props {
  report: MedicalReport | null;
  patientName: string;
  patientDob?: string;
  patientMobile?: string;
  onClose: () => void;
}

export function ReportModal({ report, patientName, patientDob, patientMobile, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!report) return null;

  function handlePrint() {
    window.print();
  }

  function handleCopy() {
    if (!report) return;
    const summaryText = `${report.title} (${report.reportNumber})\nPatient: ${patientName}\nDate: ${report.date}\nDoctor: ${report.doctorName}\nSummary: ${report.summary}\nNotes: ${report.clinicalNotes}`;
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const patientId = `PT-${patientName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 5).toUpperCase() || "78201"}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-3xl my-auto rounded-2xl bg-card border border-hairline shadow-2xl overflow-hidden transition-all text-ink">
        {/* Header toolbar */}
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4 bg-canvas/80 backdrop-blur-md print:hidden">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-soft text-accent border border-accent/20">
              {report.categoryLabel}
            </span>
            <span className="text-xs text-muted font-mono">{report.reportNumber}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopy}
            >
              {copied ? "Copied!" : "Copy summary"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
            >
              Print / Save PDF
            </Button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="p-1.5 rounded-md text-muted hover:text-ink hover:bg-secondary transition-colors ml-1"
            >
              <Close size={18} />
            </button>
          </div>
        </div>

        {/* Report Content (Printable) */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[80vh] overflow-y-auto print:max-h-none print:overflow-visible">
          {/* Clinic Brand & Letterhead */}
          <div className="border-b border-hairline pb-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-ink">{practice.name}</h2>
                <p className="text-xs text-ink-2 mt-0.5">{report.facility}</p>
                <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
                  <Pin size={12} /> {practice.address}
                </p>
              </div>
              <div className="text-right sm:text-right">
                <span className="inline-block px-2.5 py-1 rounded bg-success-soft text-success text-xs font-semibold uppercase tracking-wider border border-success/30">
                  Official Medical Record
                </span>
                <p className="text-xs text-muted font-mono mt-1">Ref: {report.reportNumber}</p>
                <p className="text-xs text-muted mt-0.5">Date: {report.date} · {report.time}</p>
              </div>
            </div>
          </div>

          {/* Patient & Order Details Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-fill/50 border border-hairline text-xs">
            <div>
              <p className="text-muted font-medium">Patient Name</p>
              <p className="text-ink font-semibold mt-0.5">{patientName}</p>
            </div>
            <div>
              <p className="text-muted font-medium">Patient ID</p>
              <p className="text-ink font-mono mt-0.5">{patientId}</p>
            </div>
            <div>
              <p className="text-muted font-medium">Date of Birth</p>
              <p className="text-ink mt-0.5">{patientDob || "1980-03-14"}</p>
            </div>
            <div>
              <p className="text-muted font-medium">Contact / Mobile</p>
              <p className="text-ink mt-0.5">{patientMobile || "On File"}</p>
            </div>
            <div>
              <p className="text-muted font-medium">Attending Physician</p>
              <p className="text-ink font-semibold mt-0.5">{report.doctorName}</p>
            </div>
            <div>
              <p className="text-muted font-medium">Department</p>
              <p className="text-ink mt-0.5">{report.doctorDepartment}</p>
            </div>
            <div>
              <p className="text-muted font-medium">Specimen / Modality</p>
              <p className="text-ink mt-0.5">{report.specimen || "Clinical Evaluation"}</p>
            </div>
            <div>
              <p className="text-muted font-medium">Report Status</p>
              <p className="text-success font-medium flex items-center gap-1 mt-0.5">
                <Check size={13} /> Verified
              </p>
            </div>
          </div>

          {/* Report Title */}
          <div>
            <h3 id="report-modal-title" className="text-base sm:text-lg font-bold text-ink">
              {report.title}
            </h3>
            <p className="text-xs text-ink-2 mt-1 leading-relaxed">{report.summary}</p>
          </div>

          {/* Findings Table */}
          {report.parameters && report.parameters.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-hairline">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-hairline bg-fill/70 font-semibold text-ink">
                    <th className="py-2.5 px-3">Test Investigation</th>
                    <th className="py-2.5 px-3 text-right">Observed Result</th>
                    <th className="py-2.5 px-3">Unit</th>
                    <th className="py-2.5 px-3">Biological Reference</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {report.parameters.map((param) => {
                    const isNormal = param.flag === "normal";
                    const isBorderline = param.flag === "borderline";
                    return (
                      <tr key={param.name} className="hover:bg-fill/30 transition-colors">
                        <td className="py-2 px-3 font-medium text-ink">{param.name}</td>
                        <td className={`py-2 px-3 text-right font-mono font-semibold ${isNormal ? "text-ink" : isBorderline ? "text-amber-500 font-bold" : "text-rose-500 font-bold"}`}>
                          {param.value}
                        </td>
                        <td className="py-2 px-3 text-muted">{param.unit}</td>
                        <td className="py-2 px-3 text-muted font-mono">{param.referenceRange}</td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                              isNormal
                                ? "bg-success-soft text-success border border-success/20"
                                : isBorderline
                                  ? "bg-amber-500/15 text-amber-500 border border-amber-500/20"
                                  : "bg-rose-500/15 text-rose-500 border border-rose-500/20"
                            }`}
                          >
                            {param.flag}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Clinical Impressions / Doctor Notes */}
          <div className="p-4 rounded-xl bg-fill/40 border border-hairline space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Doctor's Clinical Impression & Guidance
            </h4>
            <p className="text-xs text-ink leading-relaxed">{report.clinicalNotes}</p>
          </div>

          {/* Signature & Stamp */}
          <div className="pt-4 border-t border-hairline flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent-soft border border-accent/25 flex items-center justify-center font-bold text-accent text-sm">
                Rx
              </div>
              <div>
                <p className="text-xs font-bold text-ink">{report.signature.doctorName}</p>
                <p className="text-[11px] text-muted">{report.signature.qualification}</p>
                <p className="text-[11px] text-ink-2">{report.signature.designation}</p>
              </div>
            </div>

            <div className="text-left sm:text-right text-[11px] text-muted font-mono">
              <span className="inline-flex items-center gap-1 text-success font-medium">
                <Check size={12} /> Digitally Signed & Authenticated
              </span>
              <p className="mt-0.5">
                Timestamp:{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(report.signature.signedAt))}
              </p>
            </div>
          </div>
        </div>

        {/* Modal footer */}
        <div className="border-t border-hairline px-6 py-3.5 bg-canvas/60 flex items-center justify-between text-xs text-muted print:hidden">
          <span>{practice.phoneDisplay} · Confidential Patient Record</span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
