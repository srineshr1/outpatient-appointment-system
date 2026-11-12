import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setNow } from "@/lib/clock";
import { AssistantDock } from "./AssistantDock";

const doctor = { name: "Dr Doom", role: "doctor" as const };

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AssistantDock open times", () => {
  it("lists open times by day, and for patients each time links to its booking form", async () => {
    setNow(Date.UTC(2026, 10, 12, 4, 0));
    const slot = (id: string, date: string, time: string) => ({
      id,
      doctorId: "doom",
      doctor: "Dr Doom",
      date,
      time,
      endTime: null,
      mode: "stream",
      href: `/book/details?slot=${encodeURIComponent(id)}`,
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: "Dr Doom has times today and tomorrow. Tap one to book it.",
        slots: [slot("s-1045", "2026-11-12", "10:45"), slot("s-1100", "2026-11-12", "11:00"), slot("s-0900", "2026-11-13", "09:00")],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AssistantDock user={{ name: "Srinesh", role: "patient" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask the clinic assistant" }));
    const box = screen.getByLabelText("Message");
    fireEvent.change(box, { target: { value: "Can u find the available slots for doom" } });
    fireEvent.keyDown(box, { key: "Enter" });

    const today = await screen.findByRole("list", { name: "Open times, Dr Doom, Today, Thu 12 Nov" });
    expect(today.querySelectorAll("a")).toHaveLength(2);
    expect(screen.getByRole("list", { name: "Open times, Dr Doom, Tomorrow, Fri 13 Nov" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Book Dr Doom, Today, Thu 12 Nov at 10:45" })).toHaveAttribute("href", "/book/details?slot=s-1045");
    expect(screen.getByRole("link", { name: "Book Dr Doom, Tomorrow, Fri 13 Nov at 09:00" })).toHaveAttribute("href", "/book/details?slot=s-0900");
    expect(screen.getByText(/Nothing is booked until you confirm there/)).toBeInTheDocument();
  });

  it("shows a doctor's own open times without booking links", async () => {
    setNow(Date.UTC(2026, 10, 12, 4, 0));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: "Two times are open today.",
        slots: [{ id: "s-1", doctorId: "doom", doctor: "Dr Doom", date: "2026-11-12", time: "10:45", endTime: null, mode: "stream", href: null }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AssistantDock user={doctor} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask the clinic assistant" }));
    const box = screen.getByLabelText("Message");
    fireEvent.change(box, { target: { value: "open slots today" } });
    fireEvent.keyDown(box, { key: "Enter" });
    const list = await screen.findByRole("list", { name: "Open times, Dr Doom, Today, Thu 12 Nov" });
    expect(list).toHaveTextContent("10:45");
    expect(list.querySelector("a")).toBeNull();
  });
});
