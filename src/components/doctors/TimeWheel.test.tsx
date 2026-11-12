import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimeWheelPicker, WHEEL_ROW } from "./TimeWheel";

const palette = { bg: "#FDF0E0", bd: "#B45309", fg: "#64300A", dot: "#B45309" };
const h = (hour: number, minute = 0) => hour * 60 + minute;

function Harness({ start = h(8, 40), disabled = false, onChange }: { start?: number; disabled?: boolean; onChange?: (v: number) => void }) {
  const [value, setValue] = useState(start);
  return (
    <TimeWheelPicker
      label="Starts"
      ariaLabel="Session start time"
      valueText={`Starts at ${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`}
      value={value}
      min={h(8)}
      max={h(13, 40)}
      step={20}
      disabled={disabled}
      note="20 min earlier"
      palette={palette}
      onChange={(next) => {
        onChange?.(next);
        setValue(next);
      }}
    />
  );
}

const minutesDrum = () => screen.getByRole("spinbutton", { name: "Session start time, minutes" });
const hourDrum = () => screen.getByRole("spinbutton", { name: "Session start time, hour" });

afterEach(() => vi.useRealTimers());

describe("TimeWheelPicker", () => {
  it("shows a labelled group with hour and minute drums and the note", () => {
    render(<Harness />);
    expect(screen.getByRole("group", { name: "Session start time" })).toBeInTheDocument();
    expect(hourDrum()).toHaveAttribute("aria-valuenow", "8");
    expect(minutesDrum()).toHaveAttribute("aria-valuenow", "40");
    expect(minutesDrum()).toHaveAttribute("aria-valuetext", "Starts at 08:40");
    expect(screen.getByText("20 min earlier")).toBeInTheDocument();
    expect(screen.getByText("08:00–13:40")).toBeInTheDocument();
    expect(document.querySelector('input[type="range"], input[type="time"]')).toBeNull();
  });

  it("steps by the grid with arrows, by hour with page keys, and jumps with Home/End", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.keyDown(minutesDrum(), { key: "ArrowUp" });
    expect(minutesDrum()).toHaveAttribute("aria-valuetext", "Starts at 09:00");
    fireEvent.keyDown(minutesDrum(), { key: "ArrowDown" });
    fireEvent.keyDown(minutesDrum(), { key: "ArrowDown" });
    expect(minutesDrum()).toHaveAttribute("aria-valuetext", "Starts at 08:20");
    fireEvent.keyDown(hourDrum(), { key: "ArrowUp" });
    expect(minutesDrum()).toHaveAttribute("aria-valuetext", "Starts at 09:20");
    fireEvent.keyDown(hourDrum(), { key: "PageUp" });
    expect(minutesDrum()).toHaveAttribute("aria-valuetext", "Starts at 10:20");
    fireEvent.keyDown(hourDrum(), { key: "End" });
    expect(minutesDrum()).toHaveAttribute("aria-valuetext", "Starts at 13:40");
    fireEvent.keyDown(hourDrum(), { key: "ArrowUp" });
    expect(minutesDrum()).toHaveAttribute("aria-valuetext", "Starts at 13:40");
    fireEvent.keyDown(minutesDrum(), { key: "Home" });
    expect(minutesDrum()).toHaveAttribute("aria-valuetext", "Starts at 08:00");
    expect(onChange.mock.calls.map(([v]) => v)).toEqual([h(9), h(8, 40), h(8, 20), h(9, 20), h(10, 20), h(13, 40), h(8)]);
  });

  it("moves one row per mouse-wheel notch", () => {
    render(<Harness />);
    fireEvent.wheel(minutesDrum(), { deltaY: 100 });
    expect(minutesDrum()).toHaveAttribute("aria-valuetext", "Starts at 09:00");
    fireEvent.wheel(hourDrum(), { deltaY: -100 });
    expect(minutesDrum()).toHaveAttribute("aria-valuetext", "Starts at 08:00");
  });

  it("snaps a scrolled drum to the row under the centre line", () => {
    vi.useFakeTimers();
    render(<Harness start={h(9)} />);
    const drum = minutesDrum(); // 09:00, 09:20, 09:40
    drum.scrollTop = WHEEL_ROW * 2 - 4;
    fireEvent.scroll(drum);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(minutesDrum()).toHaveAttribute("aria-valuetext", "Starts at 09:40");
  });

  it("selects a tapped row", () => {
    render(<Harness start={h(9)} />);
    fireEvent.click(screen.getAllByText("40")[0] as HTMLElement);
    expect(minutesDrum()).toHaveAttribute("aria-valuetext", "Starts at 09:40");
  });

  it("is inert when disabled", () => {
    const onChange = vi.fn();
    render(<Harness disabled onChange={onChange} />);
    expect(minutesDrum()).toHaveAttribute("aria-disabled", "true");
    expect(minutesDrum()).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(minutesDrum(), { key: "ArrowUp" });
    fireEvent.wheel(minutesDrum(), { deltaY: 100 });
    fireEvent.click(screen.getAllByText("40")[0] as HTMLElement);
    expect(onChange).not.toHaveBeenCalled();
  });
});
