import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CustomRangeSelectDemo, { CalendarRangeSelect } from "./calendar-range-select";

describe("CalendarRangeSelect", () => {
  it("renders CustomRangeSelectDemo correctly", () => {
    render(<CustomRangeSelectDemo />);
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("renders with custom dateRange and calls onSelect", async () => {
    const handleSelect = vi.fn();
    const from = new Date(2026, 10, 10);
    const to = new Date(2026, 10, 20);

    render(
      <CalendarRangeSelect
        dateRange={{ from, to }}
        onSelect={handleSelect}
        defaultMonth={from}
      />
    );

    expect(screen.getByRole("grid")).toBeInTheDocument();
    const dayButtons = screen.getAllByRole("button");
    const targetDay = dayButtons.find((btn) => btn.textContent === "15");
    if (targetDay) {
      await userEvent.click(targetDay);
      expect(handleSelect).toHaveBeenCalled();
    }
  });
});
