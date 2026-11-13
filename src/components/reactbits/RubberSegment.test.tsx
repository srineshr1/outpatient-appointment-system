import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RubberSegment } from "./RubberSegment";

describe("RubberSegment", () => {
  it("renders radiogroup and items as buttons by default", () => {
    const onChange = vi.fn();
    render(
      <RubberSegment
        items={["Day", "Week", "Month", "Year"]}
        defaultValue="Week"
        onChange={onChange}
        aria-label="Timeframe"
      />
    );

    const group = screen.getByRole("radiogroup", { name: "Timeframe" });
    expect(group).toBeInTheDocument();

    const buttons = screen.getAllByRole("radio");
    expect(buttons).toHaveLength(4);
    expect(buttons[1]).toHaveAttribute("aria-checked", "true");
    expect(buttons[0]).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange and updates when radio button is clicked", () => {
    const onChange = vi.fn();
    render(
      <RubberSegment
        items={["Day", "Week", "Month", "Year"]}
        defaultValue="Day"
        onChange={onChange}
        aria-label="Timeframe"
      />
    );

    const monthBtn = screen.getByRole("radio", { name: "Month" });
    fireEvent.pointerDown(monthBtn, { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(monthBtn, { button: 0, clientX: 100, pointerId: 1 });

    expect(onChange).toHaveBeenCalledWith("Month", 2);
  });

  it("navigates with keyboard arrow keys, home, and end", () => {
    const onChange = vi.fn();
    render(
      <RubberSegment
        items={["Day", "Week", "Month", "Year"]}
        defaultValue="Day"
        onChange={onChange}
        aria-label="Timeframe"
      />
    );

    const dayBtn = screen.getByRole("radio", { name: "Day" });
    fireEvent.keyDown(dayBtn, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("Week", 1);

    const weekBtn = screen.getByRole("radio", { name: "Week" });
    fireEvent.keyDown(weekBtn, { key: "End" });
    expect(onChange).toHaveBeenCalledWith("Year", 3);

    const yearBtn = screen.getByRole("radio", { name: "Year" });
    fireEvent.keyDown(yearBtn, { key: "Home" });
    expect(onChange).toHaveBeenCalledWith("Day", 0);
  });

  it("renders as navigation with links when href items are provided", () => {
    const navItems = [
      { value: "/dashboard", label: "Clinic book", href: "/dashboard", "aria-current": "page" as const },
      { value: "/dashboard/sessions", label: "View sessions", href: "/dashboard/sessions" },
      { value: "/dashboard/sessions/manage", label: "Edit sessions", href: "/dashboard/sessions/manage" },
    ];

    render(
      <RubberSegment
        aria-label="Main"
        items={navItems}
        value="/dashboard"
        equalSlots={false}
      />
    );

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", "/dashboard");
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(links[1]).toHaveAttribute("href", "/dashboard/sessions");
    expect(links[1]).not.toHaveAttribute("aria-current");
  });

  it("respects disabled prop", () => {
    const onChange = vi.fn();
    render(
      <RubberSegment
        items={["Stream", "Wave"]}
        defaultValue="Stream"
        disabled
        onChange={onChange}
        aria-label="Mode"
      />
    );

    const group = screen.getByRole("radiogroup", { name: "Mode" });
    expect(group).toHaveAttribute("aria-disabled", "true");

    const waveBtn = screen.getByRole("radio", { name: "Wave" });
    expect(waveBtn).toBeDisabled();
  });
});
