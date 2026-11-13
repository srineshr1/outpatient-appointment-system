import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VoicePill from "./VoicePill";

let now = 0;

beforeEach(() => {
  now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  // jsdom has no 2D canvas; the waveform simply skips drawing.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
});

const press = (el: HTMLElement, clientX = 100) =>
  fireEvent.pointerDown(el, { pointerId: 1, isPrimary: true, button: 0, clientX });
const lift = (el: HTMLElement, clientX = 100) => fireEvent.pointerUp(el, { pointerId: 1, isPrimary: true, button: 0, clientX });

describe("VoicePill", () => {
  it("starts idle, and a tap latches listening until the next tap", () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    render(<VoicePill ariaLabel="Speak" onStart={onStart} onStop={onStop} />);
    const pill = screen.getByRole("button", { name: "Speak" });
    expect(pill).toHaveAttribute("aria-pressed", "false");
    expect(pill).toHaveAttribute("data-state", "idle");

    press(pill);
    now += 100;
    lift(pill);
    expect(onStart).toHaveBeenCalledWith({ source: "simulated" });
    expect(pill).toHaveAttribute("aria-pressed", "true");
    expect(pill).toHaveAttribute("data-state", "listening");
    expect(onStop).not.toHaveBeenCalled();

    press(pill);
    now += 100;
    lift(pill);
    expect(onStop).toHaveBeenCalledWith(expect.objectContaining({ reason: "tap" }));
    expect(pill).toHaveAttribute("aria-pressed", "false");
  });

  it("stops on release after a hold in auto mode", () => {
    const onStop = vi.fn();
    render(<VoicePill onStop={onStop} />);
    const pill = screen.getByRole("button", { name: "Dictate" });
    press(pill);
    now += 450;
    lift(pill);
    expect(onStop).toHaveBeenCalledWith({ reason: "release", duration: 450 });
    expect(pill).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles with the keyboard and stops on Escape", () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    render(<VoicePill onStart={onStart} onStop={onStop} />);
    const pill = screen.getByRole("button", { name: "Dictate" });
    fireEvent.keyDown(pill, { key: "Enter" });
    expect(onStart).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(pill, { key: "Enter" });
    expect(onStop).toHaveBeenLastCalledWith(expect.objectContaining({ reason: "key" }));
    fireEvent.keyDown(pill, { key: " " });
    fireEvent.keyDown(pill, { key: "Escape" });
    expect(onStop).toHaveBeenLastCalledWith(expect.objectContaining({ reason: "escape" }));
  });

  it("cancels when a held press slides far enough left", () => {
    const onStop = vi.fn();
    render(<VoicePill cancelDistance={64} onStop={onStop} />);
    const pill = screen.getByRole("button", { name: "Dictate" });
    press(pill, 200);
    fireEvent.pointerMove(pill, { pointerId: 1, isPrimary: true, clientX: 170 });
    expect(onStop).not.toHaveBeenCalled();
    expect(pill.style.getPropertyValue("--vp-slide")).toBe("-30px");
    fireEvent.pointerMove(pill, { pointerId: 1, isPrimary: true, clientX: 130 });
    expect(onStop).toHaveBeenCalledWith(expect.objectContaining({ reason: "cancel" }));
    expect(pill).toHaveAttribute("aria-pressed", "false");
    expect(pill.style.getPropertyValue("--vp-slide")).toBe("0px");
    lift(pill, 130);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("is inert when disabled, and disabling a listening pill stops it", () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    const { rerender } = render(<VoicePill onStart={onStart} onStop={onStop} />);
    const pill = screen.getByRole("button", { name: "Dictate" });
    fireEvent.keyDown(pill, { key: "Enter" });
    rerender(<VoicePill disabled onStart={onStart} onStop={onStop} />);
    expect(onStop).toHaveBeenCalledWith(expect.objectContaining({ reason: "disabled" }));
    expect(pill).toBeDisabled();
    press(pill);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("stops with mic-denied when a mic-driven pill is refused the microphone", async () => {
    class FakeAudioContext {
      state = "running";
      resume = vi.fn();
      close = vi.fn();
    }
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const getUserMedia = vi.fn().mockRejectedValue(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    const onStart = vi.fn();
    const onStop = vi.fn();
    render(<VoicePill reactive="mic" onStart={onStart} onStop={onStop} />);
    const pill = screen.getByRole("button", { name: "Dictate" });
    await act(async () => {
      fireEvent.keyDown(pill, { key: "Enter" });
    });
    expect(onStart).toHaveBeenCalledWith({ source: "mic" });
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(onStop).toHaveBeenCalledWith(expect.objectContaining({ reason: "mic-denied" }));
    expect(pill).toHaveAttribute("aria-pressed", "false");
  });

  it("reports unmount when it goes away while listening", () => {
    const onStop = vi.fn();
    const { unmount } = render(<VoicePill onStop={onStop} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Dictate" }), { key: "Enter" });
    unmount();
    expect(onStop).toHaveBeenCalledWith(expect.objectContaining({ reason: "unmount" }));
  });
});
