import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ConsultSession } from "@/lib/clinic-types";
import type { ScheduleVisit } from "./schedule-model";

vi.mock("@/server/profile-actions", () => ({ saveSession: vi.fn(async () => null), archiveSession: vi.fn() }));
vi.mock("@/server/booking-actions", () => ({ updateVisit: vi.fn() }));
import { DoctorSchedule } from "./DoctorSchedule";

const TODAY = "2099-01-05"; // a Monday
const wave: ConsultSession = { id: "w1", doctorId: "doc", label: "Morning wave", weekdays: [], onDate: TODAY, startDate: null, endDate: null,
  startTime: "10:00", endTime: "12:00", room: "Room 1", mode: "wave", slotMinutes: null, waveMinutes: null, waveCapacity: 3,
  archivedAt: null, createdAt: "", updatedAt: "" };

function seat(token: number, name: string): ScheduleVisit {
  return { id: `v${token}`, sessionId: "w1", slotId: `w-w1-${TODAY}-1000#${token}`, date: TODAY, time: "10:00", endTime: "12:00",
    token, patientName: name, reason: "Medication review", status: "booked", reference: `HSP-00000${token}` };
}

function show(sessions: ConsultSession[] = [wave], visits: ScheduleVisit[] = [seat(1, "Asha"), seat(2, "Bala"), seat(3, "Chitra")]) {
  return render(
    <DoctorSchedule doctorName="Dr Test" doctorId="doc" today={TODAY} nowMinutes={9 * 60} sessions={sessions} visits={visits}
      trims={[]} room="Room 1" editable returnTo="/dashboard/sessions" />,
  );
}

describe("DoctorSchedule", () => {
  it("lists the selected session's appointments below the calendar, not in the editor", () => {
    show();
    const list = screen.getByRole("region", { name: /Appointments/ });
    const calendar = screen.getByRole("region", { name: "Weekly calendar" });
    const editor = screen.getByRole("complementary", { name: "Session editor" });
    expect(editor.contains(list)).toBe(false);
    expect(calendar.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(list).getByText("Asha")).toBeInTheDocument();
  });

  it("offers to notify the patient who no longer fits fewer places per wave", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "One fewer patient per wave" }));
    expect(screen.getByText("1 patient no longer fits this change")).toBeInTheDocument();
    expect(screen.getByText(/Chitra/, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply and notify 1 patient with new times" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Apply change" })).toBeDisabled();
    expect(document.querySelector('input[name="displaceCount"]')).toHaveValue("1");
  });

  it("applies a reduction directly when every booked patient still fits", async () => {
    const user = userEvent.setup();
    show([wave], [seat(1, "Asha")]);
    await user.click(screen.getByRole("button", { name: "One fewer patient per wave" }));
    expect(screen.queryByRole("button", { name: /notify/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Apply change" })).toBeEnabled();
  });

  it("asks before cancelling an appointment", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: /Asha/ }));
    await user.click(screen.getByRole("button", { name: "Cancel appointment" }));
    expect(screen.getByText(/Cancel Asha’s appointment/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes, cancel it" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep appointment" }));
    expect(screen.queryByRole("button", { name: "Yes, cancel it" })).toBeNull();
  });

  it("adds a one-off by default, and a weekly session needs days and both dates", async () => {
    const user = userEvent.setup();
    show([], []);
    await user.click(screen.getByRole("button", { name: "Add session" }));
    const recurring = screen.getByRole("checkbox", { name: "Recurring every week" });
    expect(recurring).not.toBeChecked();
    expect(screen.queryByLabelText("Start date")).toBeNull();
    expect(document.querySelector('input[name="kind"]')).toHaveValue("once");
    await user.click(recurring);
    expect(screen.getByLabelText("Start date")).toBeRequired();
    expect(screen.getByLabelText("End date")).toBeRequired();
    expect(screen.getByRole("button", { name: "Monday" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector('input[name="kind"]')).toHaveValue("recurring");
    expect(screen.getByRole("button", { name: "Apply change" })).toBeDisabled();
    expect(screen.getByText("Choose the date this session ends.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("End date"), "2099-02-28");
    expect(screen.getByRole("button", { name: "Apply change" })).toBeEnabled();
    expect(document.querySelector('input[name="endDate"]')).toHaveValue("2099-02-28");
  });

  it("keeps an undated weekly session editable and prompts for dates", () => {
    show([{ ...wave, onDate: null, weekdays: [1] }], []);
    expect(screen.getByRole("checkbox", { name: "Recurring every week" })).toBeChecked();
    expect(screen.getByText(/has no start or end date/)).toBeInTheDocument();
    expect(screen.getByLabelText("Start date")).not.toBeRequired();
  });
});

describe("Add session dates (regressions)", () => {
  const busyDay: ConsultSession[] = [
    { ...wave, id: "w-today", startTime: "09:10", endTime: "12:00", waveMinutes: null, waveCapacity: 6 },
    { ...wave, id: "s-today", label: "New session", mode: "stream", startTime: "12:00", endTime: "16:00", slotMinutes: 20, waveCapacity: null },
  ];

  it("keeps the editor open when Recurring is ticked on a day that already has one-off sessions", async () => {
    const user = userEvent.setup();
    show(busyDay, []);
    await user.click(screen.getByRole("button", { name: "Add session" }));
    await user.click(screen.getByRole("checkbox", { name: "Recurring every week" }));
    expect(screen.getByRole("checkbox", { name: "Recurring every week" })).toBeChecked();
    expect(screen.getByLabelText("Start date")).toBeInTheDocument();
    expect(screen.getByLabelText("End date")).toBeInTheDocument();
  });

  it("lets a weekly session start on a later date and change its days without losing the editor", async () => {
    const user = userEvent.setup();
    show([], []);
    await user.click(screen.getByRole("button", { name: "Add session" }));
    await user.click(screen.getByRole("checkbox", { name: "Recurring every week" }));
    await user.clear(screen.getByLabelText("Start date"));
    await user.type(screen.getByLabelText("Start date"), "2099-02-02");
    await user.type(screen.getByLabelText("End date"), "2099-03-30");
    expect(screen.getByLabelText("Start date")).toHaveValue("2099-02-02");
    await user.click(screen.getByRole("button", { name: "Tuesday" }));
    await user.click(screen.getByRole("button", { name: "Monday" }));
    expect(screen.getByRole("button", { name: "Tuesday" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector('input[name="startDate"]')).toHaveValue("2099-02-02");
    expect(document.querySelectorAll('input[name="weekdays"]')).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Apply change" })).toBeEnabled();
    // What the save action receives.
    const sent = new FormData(document.getElementById("schedule-save") as HTMLFormElement);
    expect(Object.fromEntries(["kind", "onDate", "startDate", "endDate"].map((key) => [key, sent.get(key)]))).toEqual({
      kind: "recurring", onDate: "", startDate: "2099-02-02", endDate: "2099-03-30",
    });
    expect(sent.getAll("weekdays")).toEqual(["2"]);
  });

  it("lets a one-off session be put on any later date, not only today", async () => {
    const user = userEvent.setup();
    show([], []);
    await user.click(screen.getByRole("button", { name: "Add session" }));
    const date = screen.getByLabelText("Date");
    expect(date).toHaveAttribute("min", TODAY);
    expect(date).not.toHaveAttribute("max");
    fireEvent.change(date, { target: { value: "2099-01-21" } });
    expect(screen.getByLabelText("Date")).toHaveValue("2099-01-21");
    expect(document.querySelector('input[name="onDate"]')).toHaveValue("2099-01-21");
    expect(screen.getByRole("button", { name: "Apply change" })).toBeEnabled();
  });

  it("can move an existing one-off session to another date in Edit session", () => {
    show();
    const date = screen.getByLabelText("Date");
    fireEvent.change(date, { target: { value: "" } });
    expect(screen.getByLabelText("Date")).toHaveValue(TODAY);
    fireEvent.change(date, { target: { value: "2099-01-07" } });
    expect(document.querySelector('input[name="onDate"]')).toHaveValue("2099-01-07");
    expect(screen.getByText(/3 patients no longer fit this change/)).toBeInTheDocument();
  });
});

describe("growing a wave into the start of a stream", () => {
  const morning: ConsultSession = { ...wave, id: "w-am", label: "Wave", startTime: "09:10", endTime: "12:00", waveMinutes: null, waveCapacity: 6 };
  const afternoon: ConsultSession = { ...wave, id: "s-pm", label: "New session", mode: "stream", startTime: "12:00", endTime: "16:00", slotMinutes: 20, waveCapacity: null };
  const srinesh: ScheduleVisit = { id: "v-s", sessionId: "s-pm", slotId: `doc-${TODAY}-1200`, date: TODAY, time: "12:00", endTime: "12:20",
    token: null, patientName: "Srinesh", reason: "Medication review", status: "booked", reference: "HSP-000009" };

  it("previews the later stream start and who moves, and asks to confirm", () => {
    show([morning, afternoon], [srinesh]);
    fireEvent.change(screen.getByRole("slider", { name: "Session end time" }), { target: { value: String(12 * 60 + 40) } });
    expect(screen.getByText("Stream will start at 12:40; 1 patient will be moved")).toBeInTheDocument();
    expect(screen.getByText("Srinesh · 12:00 → 12:40")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply change" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Apply and move 1 patient to later slots" })).toBeEnabled();
    expect(document.querySelector('input[name="shiftCount"]')).toHaveValue("1");
  });

  it("blocks with the reason when the stream has no free later slot", () => {
    const short = { ...afternoon, endTime: "12:40" };
    const next = { ...srinesh, id: "v-n", slotId: `doc-${TODAY}-1220`, time: "12:20", endTime: "12:40", patientName: "Next" };
    show([morning, short], [srinesh, next]);
    fireEvent.change(screen.getByRole("slider", { name: "Session end time" }), { target: { value: String(12 * 60 + 20) } });
    expect(screen.getByText("That overlaps another session")).toBeInTheDocument();
    expect(screen.getByText(/only 0 free later slots/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Apply and move/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Apply change" })).toBeDisabled();
  });
});
