import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AppointmentRecord } from "@/lib/clinic-types";
import type { PatientDetailsResult } from "@/lib/patient-details";
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

const seeing = visit({ id: "v1", patientName: "Priya Nair", token: 1, checkedInAt: "2026-10-26T03:30:00Z", consultStartedAt: "2026-10-26T03:40:00Z" });
const waiting = visit({ id: "v2", patientName: "Owen Blake", token: 2 });

describe("Show details on the queue board", () => {
  it("puts a Show details button on the patient being seen and on each patient up next", () => {
    renderWithProviders(<QueueBoard visits={[seeing, waiting]} today={TODAY} doctorNames={{}} returnTo="/dashboard" showDoctor={false} />);
    expect(screen.getByRole("button", { name: "Show details: Priya Nair" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show details: Owen Blake" })).toBeInTheDocument();
  });

  it("opens a side panel with the details the server sends back", async () => {
    getPatientDetails.mockResolvedValueOnce({
      ok: true,
      details: {
        visitId: "v1",
        reference: "WB-v1",
        name: "Priya Nair",
        dob: "1990-05-02",
        age: 36,
        sex: "Female",
        mobile: "98765 43210",
        email: "priya@example.org",
        chi: "020 590 1234",
        token: 1,
        date: TODAY,
        time: "09:00",
        reason: "Follow-up",
        note: "Recent knee surgery",
        status: "booked",
        checkedInAt: "2026-10-26T03:30:00Z",
        checkedInLabel: "09:00",
        consultStartedAt: "2026-10-26T03:40:00Z",
        consultStartedLabel: "09:10",
        payment: "Paid £40",
        pastVisits: [{ id: "p1", reference: "WB-OLD", date: "2026-08-01", time: "09:00", reason: "Follow-up", status: "completed" }],
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<QueueBoard visits={[seeing, waiting]} today={TODAY} doctorNames={{}} returnTo="/dashboard" showDoctor={false} />);
    await user.click(screen.getByRole("button", { name: "Show details: Priya Nair" }));
    expect(getPatientDetails).toHaveBeenCalledWith("v1");
    const panel = await screen.findByRole("dialog", { name: "Priya Nair" });
    expect(await within(panel).findByText("020 590 1234")).toBeInTheDocument();
    expect(within(panel).getByText("Recent knee surgery")).toBeInTheDocument();
    expect(within(panel).getByText("Token #1")).toBeInTheDocument();
    expect(within(panel).getByText("Paid £40")).toBeInTheDocument();
    expect(within(panel).getByText("With the doctor since 09:10")).toBeInTheDocument();
    expect(within(panel).getByText(/WB-OLD/)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says so when the server refuses", async () => {
    getPatientDetails.mockResolvedValueOnce({ ok: false, reason: "forbidden" });
    const user = userEvent.setup();
    renderWithProviders(<QueueBoard visits={[waiting]} today={TODAY} doctorNames={{}} returnTo="/dashboard" showDoctor={false} />);
    await user.click(screen.getByRole("button", { name: "Show details: Owen Blake" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only this patient's doctor or the practice desk");
  });
});
