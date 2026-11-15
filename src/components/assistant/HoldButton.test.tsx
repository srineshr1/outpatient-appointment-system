import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HoldButton from "./HoldButton";

const press = (el: HTMLElement) =>
  fireEvent.pointerDown(el, { pointerId: 1, isPrimary: true, button: 0, pointerType: "mouse", clientX: 4, clientY: 4 });
const lift = (el: HTMLElement) =>
  fireEvent.pointerUp(el, { pointerId: 1, isPrimary: true, button: 0, pointerType: "mouse", clientX: 4, clientY: 4 });

describe("HoldButton", () => {
  it("confirms only after the hold finishes", async () => {
    const onHold = vi.fn();
    render(
      <HoldButton holdTime={80} resetAfter={0} onHold={onHold} doneLabel="Added">
        Hold to add session
      </HoldButton>,
    );
    const button = screen.getByRole("button", { name: /Hold to add session/ });
    press(button);
    expect(onHold).not.toHaveBeenCalled();
    expect(button).toHaveAttribute("data-phase", "holding");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 220));
    });
    expect(onHold).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("data-phase", "done");
    expect(button).toHaveTextContent("Added");
  });

  it("lets go without confirming when the press is short", async () => {
    const onHold = vi.fn();
    const onTap = vi.fn();
    render(
      <HoldButton holdTime={2000} onHold={onHold} onTap={onTap}>
        Hold to add session
      </HoldButton>,
    );
    const button = screen.getByRole("button", { name: /Hold to add session/ });
    press(button);
    lift(button);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });
    expect(onHold).not.toHaveBeenCalled();
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("data-phase", "idle");
  });
});
