"use client";

import { useEffect } from "react";
import type { PrescriptionItem } from "@/lib/patient-reports";
import { practice } from "@/lib/data";
import { Close, Pin } from "@/components/icons";
import { Button } from "@/components/ui/Button";

interface Props {
  prescription: PrescriptionItem | null;
  patientName: string;
  patientDob?: string;
  onClose: () => void;
}

export function PrescriptionModal({ prescription, patientName, patientDob, onClose }: Props) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!prescription) return null;

  const patientId = `PT-${patientName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 5).toUpperCase() || "78201"}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rx-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-xl my-auto rounded-2xl bg-card border border-hairline shadow-2xl overflow-hidden text-ink">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4 bg-canvas/80 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-ink">Prescription Order</span>
            <span className="text-xs text-muted font-mono">#{prescription.id}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="md"
              onClick={() => window.print()}
            >
              Print Prescription
            </Button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="p-1.5 rounded-md text-muted hover:text-ink hover:bg-secondary transition-colors"
            >
              <Close size={18} />
            </button>
          </div>
        </div>

        {/* Prescription Slip */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="border-b border-hairline pb-4 flex justify-between items-start">
            <div>
              <h2 className="text-base font-bold text-ink">{practice.name}</h2>
              <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
                <Pin size={12} /> {practice.address}
              </p>
              <p className="text-xs text-muted">{practice.phoneDisplay}</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-serif font-black text-accent">℞</span>
              <p className="text-[11px] text-muted font-mono mt-0.5">Date: {prescription.date}</p>
            </div>
          </div>

          {/* Patient Details */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-fill/40 border border-hairline text-xs">
            <div>
              <span className="text-muted">Patient:</span> <span className="font-semibold text-ink">{patientName}</span>
            </div>
            <div>
              <span className="text-muted">Patient ID:</span> <span className="font-mono text-ink">{patientId}</span>
            </div>
            <div>
              <span className="text-muted">DOB:</span> <span className="text-ink">{patientDob || "1980-03-14"}</span>
            </div>
            <div>
              <span className="text-muted">Prescribed By:</span> <span className="font-semibold text-ink">{prescription.prescribedBy}</span>
            </div>
          </div>

          {/* Rx Medication Content */}
          <div className="p-5 rounded-xl bg-accent-soft/20 border border-accent/20 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 id="rx-modal-title" className="text-base font-bold text-ink">
                  {prescription.medication}
                </h3>
                {prescription.genericName && (
                  <p className="text-xs text-muted italic">({prescription.genericName})</p>
                )}
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-soft text-accent">
                {prescription.dosage} · {prescription.form}
              </span>
            </div>

            <div className="space-y-1 text-xs">
              <p className="font-semibold text-ink">Directions & Frequency:</p>
              <p className="text-ink-2 bg-card p-2.5 rounded-lg border border-hairline">
                {prescription.frequency} ({prescription.duration})
              </p>
            </div>

            <div className="space-y-1 text-xs">
              <p className="font-semibold text-ink">Special Instructions:</p>
              <p className="text-ink-2 bg-card p-2.5 rounded-lg border border-hairline">
                {prescription.instructions}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-hairline">
              <span className="text-muted">Refills Authorized: <strong className="text-ink">{prescription.refills}</strong></span>
              <span className="text-success font-medium">Status: {prescription.status === "active" ? "Active" : "Completed"}</span>
            </div>
          </div>

          {/* Doctor Signature */}
          <div className="pt-4 border-t border-hairline flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-ink">{prescription.prescribedBy}</p>
              <p className="text-[11px] text-muted">Licensed Medical Practitioner</p>
            </div>
            <div className="text-right">
              <span className="inline-block border-b border-ink/40 w-28 pb-1 font-serif italic text-muted text-[11px]">
                {prescription.prescribedBy}
              </span>
              <p className="text-[10px] text-muted mt-0.5">Authorized Signature</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-hairline px-6 py-3 bg-canvas/60 flex justify-end print:hidden">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
