import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ThoughtLine from "./ThoughtLine";

function root(container: HTMLElement) {
  return container.querySelector(".thought-line") as HTMLElement;
}

function timer(container: HTMLElement) {
  return container.querySelector(".thought-line__timer")?.textContent;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("ThoughtLine", () => {
  it("paints a solid, unclipped label when the shimmer is off", () => {
    const { container, rerender } = render(
      <ThoughtLine label="Checking…" shimmer={false} breathDepth={0} color="#1d1d1f" fontSize={16} />,
    );
    expect(root(container)).toHaveAttribute("data-working");
    expect(container.querySelector("[data-shimmer]")).toBeNull();
    expect(container.querySelector(".thought-line__text[data-active]")).toHaveTextContent("Checking…");
    expect(root(container).style.getPropertyValue("--tl-color")).toBe("#1d1d1f");
    expect(root(container).style.getPropertyValue("--tl-font")).toBe("16px");

    rerender(
      <ThoughtLine label="Checking…" shimmer={false} breathDepth={0} color="#1d1d1f" fontSize={16} working={false} elapsed={2.8} />,
    );
    expect(container.querySelector(".thought-line__text--done[data-active]")).toHaveTextContent("Thought for");
    expect(timer(container)).toBe("2.8s");
  });


  it("keeps the shimmer attribute and solid label text when the shimmer is on", () => {
    const { container, rerender } = render(<ThoughtLine label="Checking…" color="#1d1d1f" fontSize={16} shimmerDuration={1.8} />);
    const breath = container.querySelector(".thought-line__breath") as HTMLElement;
    expect(breath).toHaveAttribute("data-shimmer");
    expect(breath).toHaveTextContent("Checking…");
    expect(breath.style.color).not.toBe("transparent");
    expect(root(container).style.getPropertyValue("--tl-shimmer")).toBe("1.8s");
    rerender(<ThoughtLine label="Checking…" color="#1d1d1f" fontSize={16} working={false} elapsed={5} />);
    expect(container.querySelector(".thought-line__text--done[data-active]")).toHaveTextContent("Thought for");
    expect(timer(container)).toBe("5.0s");
  });

  it("announces the working label and starts its clock at zero", () => {
    const { container } = render(<ThoughtLine label="Checking…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Checking…");
    expect(root(container)).toHaveAttribute("data-working");
    expect(timer(container)).toBe("0.0s");
  });

  it("settles into the frozen time with a controlled clock", () => {
    const { container } = render(<ThoughtLine working={false} elapsed={2.5} />);
    expect(root(container)).not.toHaveAttribute("data-working");
    expect(timer(container)).toBe("2.5s");
    expect(screen.getByRole("status")).toHaveTextContent("Thought for 2.5 seconds");
  });

  it("formats long waits in minutes", () => {
    const { container } = render(<ThoughtLine working={false} elapsed={75} />);
    expect(timer(container)).toBe("1m 15.0s");
    expect(screen.getByRole("status")).toHaveTextContent("Thought for 1 minutes 15.0 seconds");
  });

  it("says Done thinking when the timer is off", () => {
    const { container } = render(<ThoughtLine working={false} showTimer={false} />);
    expect(container.querySelector(".thought-line__timer")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Done thinking");
  });

  it("calls onSettle once, with the frozen seconds", () => {
    const onSettle = vi.fn();
    const { rerender } = render(<ThoughtLine working onSettle={onSettle} />);
    expect(onSettle).not.toHaveBeenCalled();
    rerender(<ThoughtLine working={false} elapsed={1.2} onSettle={onSettle} />);
    rerender(<ThoughtLine working={false} elapsed={1.2} onSettle={onSettle} />);
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenCalledWith(1.2);
  });

  it("runs its own clock while working", () => {
    vi.useFakeTimers();
    const { container } = render(<ThoughtLine />);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(timer(container)).toBe("1.5s");
  });

  it("draws no trace or chevron without steps", () => {
    const { container } = render(<ThoughtLine />);
    expect(container.querySelector(".thought-line__trace")).toBeNull();
    expect(container.querySelector(".thought-line__chevron")).not.toHaveAttribute("data-on");
    expect(container.querySelector(".thought-line__head")).toHaveAttribute("tabindex", "-1");
  });

  it("ticks earlier steps and folds the trace when it settles", () => {
    const steps = ["Reading", "Looking"];
    const { container, rerender } = render(<ThoughtLine steps={steps} />);
    const items = container.querySelectorAll(".thought-line__step");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute("data-done");
    expect(items[1]).not.toHaveAttribute("data-done");
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
    rerender(<ThoughtLine steps={steps} working={false} elapsed={1} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelectorAll(".thought-line__step[data-done]")).toHaveLength(2);
  });

  it("renders with reduced motion", () => {
    const realMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      const { container } = render(<ThoughtLine label="Checking…" />);
      expect(screen.getByRole("status")).toHaveTextContent("Checking…");
      expect(root(container)).toBeInTheDocument();
    } finally {
      window.matchMedia = realMatchMedia;
    }
  });
});
