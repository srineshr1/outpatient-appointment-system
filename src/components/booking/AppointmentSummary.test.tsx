import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppointmentSummary } from "./AppointmentSummary";
import type { Doctor, Slot } from "@/lib/data";

const doctor = {
  id: "doc",
  name: "Dr Test",
  short: "Dr Test",
  qualification: "MBBS",
  interest: "General",
  years: 5,
  note: "",
  room: "Room 2",
  bio: "",
  languages: [],
  days: "",
  portrait: { initials: "DT", hue: 200 },
} as unknown as Doctor;

const wave: Slot = { id: "w-s1-2026-11-21-1000", doctorId: "doc", date: "2026-11-21", time: "10:00", endTime: "11:00", mode: "wave", capacity: 5, booked: 2 };
const stream: Slot = { id: "doc-2026-11-21-1500", doctorId: "doc", date: "2026-11-21", time: "15:00", endTime: "15:20", mode: "stream" };

describe("AppointmentSummary", () => {
  it("shows a wave's window and the token, never a slot minute", () => {
    render(<AppointmentSummary doctor={doctor} slot={wave} token={3} />);
    expect(screen.getByTestId("wave-token").textContent).toBe("Token #3");
    expect(screen.getByText(/Wave 10:00–11:00/)).toBeTruthy();
    expect(screen.queryByText(/minutes/)).toBeNull();
  });

  it("before booking, says a token comes with the booking and how many places are left", () => {
    render(<AppointmentSummary doctor={doctor} slot={wave} />);
    expect(screen.getByText("You get a token number when you book")).toBeTruthy();
    expect(screen.getByText(/3 of 5 places left/)).toBeTruthy();
  });

  it("keeps a stream visit's own time", () => {
    render(<AppointmentSummary doctor={doctor} slot={stream} reason={{ id: "new", label: "A new concern", minutes: 15 } as never} />);
    expect(screen.getByText("15:00–15:15")).toBeTruthy();
    expect(screen.queryByTestId("wave-token")).toBeNull();
  });
});
