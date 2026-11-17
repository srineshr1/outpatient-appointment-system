import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AppointmentRecord } from "@/lib/clinic-types";
import { renderWithProviders } from "@/test/utils";
import { ReceptionDesk } from "./ReceptionDesk";

vi.mock("@/server/booking-actions", () => ({ updateVisit: vi.fn() }));

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
    expect(screen.getByText("Priya Nair")).toBeInTheDocument();
    expect(screen.getByText("Owen Blake")).toBeInTheDocument();
    expect(screen.getByText(/Dr Helen Cho/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Priya Nair completed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel Priya Nair" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark Owen Blake completed" })).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Search patients by name, doctor, or reference"), "Owen");
    expect(screen.queryByText("Priya Nair")).not.toBeInTheDocument();
    expect(screen.getByText("Owen Blake")).toBeInTheDocument();
  });
});
