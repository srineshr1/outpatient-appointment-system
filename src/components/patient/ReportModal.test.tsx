import { renderWithProviders } from "@/test/utils";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { MedicalReport } from "@/lib/patient-reports";
import { ReportModal } from "./ReportModal";

const cbcReport: MedicalReport = {
  id: "rep-cbc-01",
  reportNumber: "LAB-2026-8819",
  title: "Complete Blood Count (CBC) with Differential",
  category: "lab",
  categoryLabel: "Pathology & Blood",
  date: "2026-11-04",
  time: "09:30",
  doctorId: "cho",
  doctorName: "Dr Helen Cho",
  doctorDepartment: "Clinical Pathology & Hematology",
  facility: "Westbrook Central Diagnostics & Clinical Laboratory",
  status: "ready",
  specimen: "Whole Blood (EDTA Vacutainer)",
  summary: "Normal red blood cell, white blood cell, and platelet morphology.",
  parameters: [
    { name: "Hemoglobin (Hb)", value: "14.2", unit: "g/dL", referenceRange: "12.0 - 15.5", flag: "normal" },
    { name: "LDL Cholesterol (Calculated)", value: "108", unit: "mg/dL", referenceRange: "< 100", flag: "borderline" },
  ],
  clinicalNotes: "All hematological indices fall well within biological reference intervals.",
  signature: {
    doctorName: "Dr Helen Cho",
    qualification: "MBChB, FRCPath, General Medicine",
    designation: "Consultant Physician & Laboratory Director",
    signedAt: "2026-11-04T11:15:00Z",
  },
};

function renderReport(onClose = vi.fn()) {
  renderWithProviders(
    <ReportModal
      report={cbcReport}
      patientName="Ann Lee"
      patientDob="1980-03-14"
      patientMobile="07700 900123"
      onClose={onClose}
    />,
  );
  return onClose;
}

describe("ReportModal", () => {
  it("maps bg-card to an opaque surface so report cards are not transparent", () => {
    const css = readFileSync(resolve("src/app/globals.css"), "utf8");
    expect(css).toMatch(/--color-card:\s*var\(--v-surface\)/);
    expect(css).toMatch(/--color-card-foreground:\s*var\(--v-ink\)/);
  });

  it("renders the report on a solid surface with the dimming backdrop behind it", () => {
    renderReport();

    const dialog = screen.getByRole("dialog", { name: /Complete Blood Count/i });
    const panel = screen.getByTestId("report-modal-panel");
    const backdrop = screen.getByTestId("report-modal-backdrop");

    expect(dialog).toBe(panel);
    expect(panel).toHaveClass("bg-surface");
    expect(panel.className).not.toMatch(/bg-surface\/|bg-card\/|bg-canvas\//);
    expect(backdrop).toHaveAttribute("aria-hidden", "true");
    expect(backdrop).toHaveClass("z-0");
    expect(panel).toHaveClass("z-10");
    expect(backdrop.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(screen.getByText("12.0 - 15.5")).toHaveClass("text-ink-2");
    expect(screen.getByText("g/dL")).toHaveClass("text-ink-2");
    expect(screen.getByText("Ann Lee")).toBeInTheDocument();
    expect(screen.getByText("LAB-2026-8819")).toBeInTheDocument();
  });

  it("keeps the report body as the scroll container", () => {
    renderReport();
    const panel = screen.getByTestId("report-modal-panel");
    const body = panel.querySelector(".overflow-y-auto");
    expect(body).not.toBeNull();
    expect(body).toHaveClass("bg-surface");
    expect(body?.textContent).toContain("Biological Reference");
    expect(body?.textContent).toContain("Doctor's Clinical Impression");
  });

  it("closes when Close is pressed, Escape is pressed, or the backdrop is clicked", async () => {
    const onClose = renderReport();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    await userEvent.click(screen.getByTestId("report-modal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
