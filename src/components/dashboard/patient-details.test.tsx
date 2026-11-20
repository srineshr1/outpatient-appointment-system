import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppointmentRecord } from "@/lib/clinic-types";
import type { PatientDetails, PatientDetailsResult } from "@/lib/patient-details";
import { renderWithProviders } from "@/test/utils";
import { QueueBoard } from "./QueueBoard";

vi.mock("@/server/booking-actions", () => ({ updateVisit: vi.fn(), queueVisit: vi.fn() }));
const getPatientDetails = vi.fn<(id: string) => Promise<PatientDetailsResult>>();
vi.mock("@/server/patient-details-actions", () => ({ getPatientDetails: (id: string) => getPatientDetails(id) }));

const TODAY = "2026-10-26";

function visit(overrides: Partial<AppointmentRecord> & Pick<AppointmentRecord, "id" | "patientName">): AppointmentRecord {
  return {
    reference: `WB-${overrides.id}`,
    doctorId: "cho",
    slotId: `cho-${overrides.id}`,
    sessionId: "s-morning",
    date: TODAY,
    time: "09:00",
    endTime: "12:00",
    token: 1,
    waveCapacity: 6,
    reasonId: "follow",
    patientMobile: "",
    patientDob: "",
    patientChi: "",
    note: "",
    status: "booked",
    createdAt: "2026-10-25T09:00:00Z",
    patientUserId: null,
    ...overrides,
  };
}

function details(overrides: Partial<PatientDetails> = {}): PatientDetails {
  return {
    visitId: "v1",
    reference: "WB-v1",
    name: "Priya Nair",
    dob: "1990-05-02",
    age: 36,
    sex: "Female",
    mobile: "98765 43210",
    email: "priya@example.org",
    chi: "0205901234",
    token: 1,
    date: TODAY,
    time: "09:00",
    reason: "A follow-up",
    note: "Recent knee surgery",
    status: "booked",
    checkedInAt: "2026-10-26T03:30:00Z",
    checkedInLabel: "09:00",
    consultStartedAt: "2026-10-26T03:40:00Z",
    consultStartedLabel: "09:10",
    payment: "Paid £40",
    pastVisits: [{ id: "p1", reference: "WB-OLD", date: "2026-08-01", time: "09:00", reason: "A follow-up", status: "completed" }],
    ...overrides,
  };
}

const seeing = visit({ id: "v1", patientName: "Priya Nair", token: 1, checkedInAt: "2026-10-26T03:30:00Z", consultStartedAt: "2026-10-26T03:40:00Z" });
const waiting = visit({ id: "v2", patientName: "Owen Blake", token: 2 });

const board = (visits: AppointmentRecord[]) =>
  renderWithProviders(<QueueBoard visits={visits} today={TODAY} doctorNames={{}} returnTo="/dashboard" showDoctor={false} />);

describe("Patient details sidebar on the queue board", () => {
  beforeEach(() => getPatientDetails.mockReset());

  it("opens the patient with the doctor in the sidebar, and puts Show details on every queue row", async () => {
    getPatientDetails.mockResolvedValue({ ok: true, details: details() });
    board([seeing, waiting]);
    expect(screen.getByRole("button", { name: "Show details: Priya Nair" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Show details: Owen Blake" })).toHaveAttribute("aria-pressed", "false");
    const sidebar = screen.getByRole("region", { name: "Patient details" });
    expect(await within(sidebar).findByText("CHI 0205901234")).toBeInTheDocument();
    expect(getPatientDetails).toHaveBeenCalledWith("v1");
    expect(within(sidebar).getByText("36 years · Female")).toBeInTheDocument();
    expect(within(sidebar).getByText("Recent knee surgery")).toBeInTheDocument();
    expect(within(sidebar).getByText("Token #1")).toBeInTheDocument();
    expect(within(sidebar).getByText("Paid £40")).toBeInTheDocument();
    expect(within(sidebar).getByText("With the doctor since 09:10")).toBeInTheDocument();
    expect(within(sidebar).getByText(/WB-OLD/)).toBeInTheDocument();
    // The sidebar sits inline in the page, not as an overlay.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("switches to the chosen patient, and hides on request", async () => {
    getPatientDetails.mockImplementation(async (id) =>
      id === "v2" ? { ok: true, details: details({ visitId: "v2", name: "Owen Blake", note: "Needs a wheelchair", chi: "" }) } : { ok: true, details: details() },
    );
    const user = userEvent.setup();
    board([seeing, waiting]);
    const sidebar = screen.getByRole("region", { name: "Patient details" });
    await within(sidebar).findByText("Recent knee surgery");
    await user.click(screen.getByRole("button", { name: "Show details: Owen Blake" }));
    expect(await within(sidebar).findByText("Needs a wheelchair")).toBeInTheDocument();
    expect(within(sidebar).getByText("No CHI number")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show details: Owen Blake" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(sidebar).getByRole("button", { name: "Hide details" }));
    expect(within(sidebar).getByText(/Choose Show details on a patient/)).toBeInTheDocument();
  });

  it("waits for a choice when nobody is with the doctor, and says so when the server refuses", async () => {
    getPatientDetails.mockResolvedValueOnce({ ok: false, reason: "forbidden" });
    const user = userEvent.setup();
    board([waiting]);
    expect(getPatientDetails).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Show details: Owen Blake" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only this patient's doctor or the practice desk");
  });
});
