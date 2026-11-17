import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AppointmentRecord } from "@/lib/clinic-types";
import { renderWithProviders } from "@/test/utils";
import { ReceptionDesk } from "./ReceptionDesk";

vi.mock("@/server/booking-actions", () => ({ updateVisit: vi.fn(), queueVisit: vi.fn() }));

const TODAY = "2026-10-26";

function visit(overrides: Partial<AppointmentRecord> & Pick<AppointmentRecord, "id" | "status" | "patientName">): AppointmentRecord {
  return {
    reference: "WB-101",
    doctorId: "cho",
    slotId: "cho-2026-10-26-09:00",
    sessionId: "s-morning",
    date: TODAY,
    time: "09:00",
    endTime: null,
    token: null,
    waveCapacity: null,
    reasonId: "follow",
    patientMobile: "",
    patientDob: "",
    patientChi: "",
    note: "",
    createdAt: "2026-10-25T09:00:00Z",
    patientUserId: "user-p1",
    ...overrides,
  };
}

const booked = visit({ id: "v-1", status: "booked", patientName: "Priya Nair", reference: "WB-101" });
const done = visit({
  id: "v-2",
  status: "completed",
  patientName: "Owen Blake",
  time: "09:30",
  reference: "WB-102",
  doctorId: "reid",
});

describe("ReceptionDesk", () => {
  it("lists today's patients and offers a status update on a booked visit", async () => {
    renderWithProviders(
      <ReceptionDesk
        userName="Sam Desk"
        visits={[booked, done]}
        today={TODAY}
        doctorNames={{ cho: "Dr Helen Cho", reid: "Dr Callum Reid" }}
        doctorOptions={[
          { id: "cho", short: "Dr Cho", name: "Dr Helen Cho" },
          { id: "reid", short: "Dr Reid", name: "Dr Callum Reid" },
        ]}
        filterDoctorId=""
        payments={{ "v-1": "Paid £40" }}
        returnTo="/dashboard"
      />,
    );

    expect(screen.getByRole("heading", { name: "Desk" })).toBeInTheDocument();
    const list = () => within(screen.getByRole("list", { name: "Patients" }));
    expect(list().getByText("Priya Nair")).toBeInTheDocument();
    expect(list().getByText("Owen Blake")).toBeInTheDocument();
    expect(list().getByText(/Dr Helen Cho/)).toBeInTheDocument();
    expect(list().getByRole("button", { name: "Mark Priya Nair completed" })).toBeInTheDocument();
    expect(list().getByRole("button", { name: "Cancel Priya Nair" })).toBeInTheDocument();
    expect(list().getByRole("button", { name: "Check in Priya Nair" })).toBeInTheDocument();
    expect(list().getByRole("button", { name: "Mark Priya Nair as a no-show" })).toBeInTheDocument();
    expect(list().queryByRole("button", { name: "Mark Owen Blake completed" })).not.toBeInTheDocument();

    // Today's queue: nobody with the doctor yet, Priya up next.
    const board = within(screen.getByRole("region", { name: "Today's queue" }));
    expect(board.getAllByText("Nobody is with the doctor. Start the consultation for the next patient.")).toHaveLength(2);
    expect(board.getByRole("button", { name: "Start consult: Priya Nair" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Search patients by name, doctor, or reference"), "Owen");
    expect(list().queryByText("Priya Nair")).not.toBeInTheDocument();
    expect(list().getByText("Owen Blake")).toBeInTheDocument();
  });
});

describe("ReceptionDesk check-in", () => {
  it("shows who is with the doctor, who has checked in, and offers no check-in twice", () => {
    const seeing = visit({
      id: "v-3",
      status: "booked",
      patientName: "Ravi Iyer",
      reference: "WB-103",
      time: "09:20",
      checkedInAt: "2026-10-26T09:05:00Z",
      consultStartedAt: "2026-10-26T09:21:00Z",
    });
    const arrived = visit({ id: "v-4", status: "booked", patientName: "Meera Das", reference: "WB-104", time: "09:40", checkedInAt: "2026-10-26T09:10:00Z" });
    const missed = visit({ id: "v-5", status: "no_show", patientName: "Tom Hale", reference: "WB-105", time: "08:40" });
    renderWithProviders(
      <ReceptionDesk
        userName="Sam Desk"
        visits={[booked, seeing, arrived, missed]}
        today={TODAY}
        doctorNames={{ cho: "Dr Helen Cho" }}
        doctorOptions={[]}
        filterDoctorId=""
        payments={{}}
        returnTo="/dashboard"
      />,
    );
    const board = within(screen.getByRole("region", { name: "Today's queue" }));
    expect(board.getByText("Ravi Iyer")).toBeInTheDocument();
    expect(board.getByText(/With the doctor since/)).toBeInTheDocument();
    expect(board.getByRole("button", { name: "Mark Ravi Iyer completed" })).toBeInTheDocument();
    // Up next: Meera (checked in) before Priya (not here yet), and Tom the no-show is gone.
    const upNext = board.getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(upNext.findIndex((text) => text.includes("Meera Das"))).toBeLessThan(upNext.findIndex((text) => text.includes("Priya Nair")));
    expect(board.queryByText("Tom Hale")).not.toBeInTheDocument();
    expect(board.getByText(/1 checked in · 2 waiting · 0 seen · 1 no-show/)).toBeInTheDocument();
    expect(board.queryByRole("button", { name: "Check in: Meera Das" })).not.toBeInTheDocument();
    expect(board.getByRole("button", { name: "Check in: Priya Nair" })).toBeInTheDocument();

    const list = within(screen.getByRole("list", { name: "Patients" }));
    expect(list.queryByRole("button", { name: "Check in Meera Das" })).not.toBeInTheDocument();
    expect(list.getByText(/^Checked in \d\d:\d\d$/)).toBeInTheDocument();
    expect(list.getByText("With the doctor")).toBeInTheDocument();
    expect(list.getByText("No-show", { selector: "p" })).toBeInTheDocument();
  });
});
