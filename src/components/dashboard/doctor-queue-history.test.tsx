import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AppointmentRecord, ConsultSession } from "@/lib/clinic-types";
import { patientDetailsOf } from "@/lib/patient-history";
import { renderWithProviders } from "@/test/utils";
import { QueueBoard } from "./QueueBoard";
import { SessionsViewer } from "./SessionsViewer";

vi.mock("@/server/booking-actions", () => ({ updateVisit: vi.fn(), queueVisit: vi.fn() }));

const WAVE: ConsultSession = {
  id: "s-wave",
  doctorId: "doc-1",
  label: "Morning wave",
  weekdays: [1, 2, 3, 4, 5],
  startTime: "10:00",
  endTime: "13:00",
  room: "Room 2",
  mode: "wave",
  slotMinutes: null,
  waveMinutes: 180,
  waveCapacity: 6,
  startDate: "2026-10-01",
  endDate: "2026-12-31",
  onDate: null,
  archivedAt: null,
  createdAt: "2026-10-01T08:00:00Z",
  updatedAt: "2026-10-01T08:00:00Z",
} as ConsultSession;

function visit(overrides: Partial<AppointmentRecord> & Pick<AppointmentRecord, "id">): AppointmentRecord {
  return {
    reference: `HSP-${overrides.id}`,
    doctorId: "doc-1",
    slotId: `w-s-wave-2026-10-26-1000#${overrides.token ?? 1}`,
    sessionId: "s-wave",
    date: "2026-10-26",
    time: "10:00",
    endTime: "13:00",
    token: 1,
    waveCapacity: 6,
    reasonId: "new",
    patientName: "Tyler",
    patientMobile: "+918008865406",
    patientDob: "2010-01-12",
    patientChi: "",
    note: "",
    status: "booked",
    createdAt: "2026-10-26T04:00:00Z",
    patientUserId: "user-tyler",
    ...overrides,
  };
}

const TYLER = visit({ id: "t1", checkedInAt: "2026-10-26T04:38:00Z", consultStartedAt: "2026-10-26T04:38:10Z" });
const ANN = visit({ id: "a1", token: 2, patientName: "Ann Lee", patientDob: "1980-03-14", patientUserId: "user-ann", patientMobile: "+447700900123" });
const ANN_BEFORE = visit({
  id: "a0",
  sessionId: null,
  slotId: "doc-1-2026-09-14-1100",
  date: "2026-09-14",
  time: "11:00",
  endTime: null,
  token: null,
  waveCapacity: null,
  reasonId: "bp",
  patientName: "Ann Lee",
  patientDob: "1980-03-14",
  patientUserId: "user-ann",
  status: "completed",
  note: "Home readings around 150/95",
});

describe("doctor queue board is read-only for front-desk steps", () => {
  it("hides Check in, Start consult and No-show from the doctor but keeps Mark completed", () => {
    renderWithProviders(<QueueBoard visits={[TYLER, ANN]} today="2026-10-26" doctorNames={{}} returnTo="/dashboard" showDoctor={false} />, Date.UTC(2026, 9, 26, 5, 0));
    expect(screen.getByRole("button", { name: "Mark Tyler completed" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Check in/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start consult/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /No-show/ })).not.toBeInTheDocument();
    expect(screen.getByText("Not checked in yet")).toBeInTheDocument();
  });

  it("keeps every step for reception", () => {
    renderWithProviders(<QueueBoard visits={[TYLER, ANN]} today="2026-10-26" doctorNames={{}} returnTo="/dashboard" showDoctor deskActions />, Date.UTC(2026, 9, 26, 5, 0));
    expect(screen.getByRole("button", { name: "Check in: Ann Lee" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start consult: Ann Lee" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No-show: Ann Lee" })).toBeInTheDocument();
  });
});

describe("View sessions shows each patient's previous visits in a right-hand column", () => {
  it("opens the patient with the doctor first and switches when another is picked", async () => {
    const book = [TYLER, ANN, ANN_BEFORE];
    const patients = {
      [TYLER.id]: patientDetailsOf(TYLER, book, [WAVE], {}),
      [ANN.id]: patientDetailsOf(ANN, book, [WAVE], {}),
    };
    renderWithProviders(
      <SessionsViewer
        doctorName="Dr Ned Stark"
        today="2026-10-26"
        nowMinutes={11 * 60}
        sessions={[WAVE]}
        visits={[TYLER, ANN].map((item) => ({
          id: item.id,
          sessionId: item.sessionId ?? null,
          slotId: item.slotId,
          date: item.date,
          time: item.time,
          endTime: item.endTime ?? null,
          token: item.token ?? null,
          patientName: item.patientName,
          reason: "A new concern",
          status: item.status,
          reference: item.reference,
        }))}
        trims={[]}
        patients={patients}
        room="Room 2"
        visible
      />,
      Date.UTC(2026, 9, 26, 5, 30),
    );

    const panel = screen.getByRole("region", { name: "Patient details and history" });
    expect(within(panel).getByRole("heading", { name: "Tyler" })).toBeInTheDocument();
    expect(within(panel).getByText(/First visit with you/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Ann Lee/ }));
    expect(within(panel).getByRole("heading", { name: "Ann Lee" })).toBeInTheDocument();
    expect(within(panel).getByText("HSP-a0", { exact: false })).toBeInTheDocument();
    expect(within(panel).getByText(/Home readings around 150\/95/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ann Lee/ })).toHaveAttribute("aria-pressed", "true");
  });
});
