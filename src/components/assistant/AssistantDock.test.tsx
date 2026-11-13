import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantDock, DOCK_SIZE_KEY, LANGUAGE_KEY, LOCALE_KEY, MIC_BLOCKED, NO_RECOGNITION, QUICK_PROMPTS, clampDockSize } from "./AssistantDock";

const dockCss = readFileSync(join(process.cwd(), "src/components/assistant/AssistantDock.css"), "utf8");

const doctor = { name: "Dr Doom", role: "doctor" as const };
const realMatchMedia = window.matchMedia;

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  constructor() {
    FakeRecognition.instances.push(this);
  }
}

function setMediaDevices(getUserMedia: (() => Promise<unknown>) | undefined) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: getUserMedia ? { getUserMedia } : undefined,
  });
}

function setDesktop(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function openDock() {
  render(<AssistantDock user={doctor} />);
  fireEvent.click(screen.getByRole("button", { name: "Ask the clinic assistant" }));
}

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
  // jsdom has no 2D canvas; the voice pill's waveform simply skips drawing.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  FakeRecognition.instances = [];
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.matchMedia = realMatchMedia;
  setMediaDevices(undefined);
  window.localStorage.clear();
});

describe("AssistantDock", () => {
  it("sends the draft when Enter is pressed, but not when Shift+Enter is pressed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: "You have two sessions today." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AssistantDock user={doctor} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask the clinic assistant" }));
    const box = screen.getByLabelText("Message");
    fireEvent.change(box, { target: { value: "How many sessions today?" } });

    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/assistant");
    const body = JSON.parse((init as { body: string }).body) as {
      messages: { role: string; content: string }[];
    };
    expect(body.messages[0]).toEqual({ role: "user", content: "How many sessions today?" });
  });

  it("does not send an empty draft or an IME composition on Enter", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    openDock();
    const box = screen.getByLabelText("Message");
    fireEvent.keyDown(box, { key: "Enter" });
    fireEvent.change(box, { target: { value: "नमस्ते" } });
    fireEvent.keyDown(box, { key: "Enter", isComposing: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("AssistantDock thinking line", () => {
  function deferredFetch() {
    let resolve: (value: unknown) => void = () => {};
    const fetchMock = vi.fn().mockReturnValue(new Promise((done) => (resolve = done)));
    vi.stubGlobal("fetch", fetchMock);
    return { fetchMock, resolve };
  }

  function ask(text: string) {
    const box = screen.getByLabelText("Message");
    fireEvent.change(box, { target: { value: text } });
    fireEvent.keyDown(box, { key: "Enter" });
  }

  it("breathes while a reply is on its way, then settles above that reply", async () => {
    const { resolve } = deferredFetch();
    openDock();
    ask("How many sessions today?");

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Checking…");
    const line = status.closest(".thought-line") as HTMLElement;
    expect(line).toHaveAttribute("data-working");
    // The old plain paragraph is gone; the label lives inside the line.
    expect(screen.getAllByText("Checking…").every((el) => el.tagName !== "P" && line.contains(el))).toBe(true);

    await act(async () => {
      resolve({ ok: true, json: async () => ({ reply: "You have two sessions today." }) });
    });

    const reply = await screen.findByText("You have two sessions today.");
    // Same element, so the line crossfades rather than being swapped out.
    expect(line.isConnected).toBe(true);
    expect(line).not.toHaveAttribute("data-working");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/^Thought for \d+\.\d seconds$/));
    expect(line.querySelector(".thought-line__timer")?.textContent).toMatch(/^\d+\.\ds$/);
    expect(line.compareDocumentPosition(reply) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("settles when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "The assistant is busy." }) }));
    openDock();
    ask("Hello");
    expect(await screen.findByText("The assistant is busy.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/^Thought for/));
    expect(screen.getByRole("status").closest(".thought-line")).not.toHaveAttribute("data-working");
  });

  it("starts a new line for the next question and keeps the earlier one settled", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ reply: "First answer." }) })
        .mockReturnValueOnce(new Promise(() => {})),
    );
    openDock();
    ask("First?");
    await screen.findByText("First answer.");
    ask("Second?");
    await waitFor(() => expect(screen.getAllByRole("status")).toHaveLength(2));
    await waitFor(() => expect(screen.getAllByRole("status")[0]).toHaveTextContent(/^Thought for/));
    const [, second] = screen.getAllByRole("status");
    expect(second).toHaveTextContent("Checking…");
    expect(second?.closest(".thought-line")).toHaveAttribute("data-working");
  });
});

describe("AssistantDock cancel", () => {
  function deferredFetch() {
    let resolve: (value: unknown) => void = () => {};
    const fetchMock = vi.fn().mockImplementation(() => new Promise((done) => {
      resolve = done;
    }));
    vi.stubGlobal("fetch", fetchMock);
    return { fetchMock, resolve: (value: unknown) => resolve(value) };
  }

  function ask(text: string) {
    const box = screen.getByLabelText("Message");
    fireEvent.change(box, { target: { value: text } });
    fireEvent.keyDown(box, { key: "Enter" });
  }

  it("turns Send into an enabled Cancel while a reply is on its way", async () => {
    deferredFetch();
    openDock();
    ask("How many sessions today?");

    const cancel = await screen.findByRole("button", { name: "Cancel request" });
    expect(cancel).toHaveTextContent("Cancel");
    expect(cancel).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Checking…");
  });

  it("stops the request on Cancel, leaves the user message, and does not show an error", async () => {
    const { fetchMock, resolve } = deferredFetch();
    openDock();
    ask("How many sessions today?");

    const cancel = await screen.findByRole("button", { name: "Cancel request" });
    fireEvent.click(cancel);

    const init = fetchMock.mock.calls[0]?.[1] as { signal: AbortSignal };
    expect(init.signal.aborted).toBe(true);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText(/Checking…/)).not.toBeInTheDocument();
    expect(screen.getByText("How many sessions today?")).toBeInTheDocument();
    expect(screen.queryByText(/aborted/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/The user aborted/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();

    await act(async () => {
      resolve({ ok: true, json: async () => ({ reply: "You have two sessions today." }) });
    });
    expect(screen.queryByText("You have two sessions today.")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    const box = screen.getByLabelText("Message");
    fireEvent.change(box, { target: { value: "What about tomorrow?" } });
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("does not cancel when Enter is pressed while a reply is on its way", async () => {
    const { fetchMock } = deferredFetch();
    openDock();
    ask("Hello");
    await screen.findByRole("button", { name: "Cancel request" });
    fireEvent.keyDown(screen.getByLabelText("Message"), { key: "Enter" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as { signal: AbortSignal };
    expect(init.signal.aborted).toBe(false);
    expect(screen.getByRole("button", { name: "Cancel request" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Checking…");
  });

  it("cancels a confirmation in flight and keeps the pending card", async () => {
    let resolveConfirm: (value: unknown) => void = () => {};
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reply: "I can take that visit off the book.",
          pending: {
            token: "tok-1",
            title: "Cancel this visit",
            summary: "Remove the 10:00 visit with Dr Doom.",
            confirmLabel: "Take it off the book",
            expiresAt: "2026-11-13T10:00:00.000Z",
          },
        }),
      })
      .mockImplementationOnce(() => new Promise((done) => {
        resolveConfirm = done;
      }));
    vi.stubGlobal("fetch", fetchMock);
    openDock();
    ask("Cancel my 10:00 visit");

    expect(await screen.findByText("Cancel this visit")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Take it off the book" }));

    const cancel = await screen.findByRole("button", { name: "Cancel request" });
    fireEvent.click(cancel);

    const confirmInit = fetchMock.mock.calls[1]?.[1] as { signal: AbortSignal };
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/assistant/confirm");
    expect(confirmInit.signal.aborted).toBe(true);
    expect(screen.getByText("Cancel this visit")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Take it off the book" })).toBeEnabled();
    expect(document.querySelector(".thought-line[data-working]")).toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();

    await act(async () => {
      resolveConfirm({ ok: true, json: async () => ({ reply: "Done." }) });
    });
    expect(screen.queryByText("Done.")).not.toBeInTheDocument();
    expect(screen.getByText("Cancel this visit")).toBeInTheDocument();
  });

  it("aborts an in-flight request when the panel is closed", async () => {
    const { fetchMock, resolve } = deferredFetch();
    openDock();
    ask("How many sessions today?");
    await screen.findByRole("status");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    const init = fetchMock.mock.calls[0]?.[1] as { signal: AbortSignal };
    expect(init.signal.aborted).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Ask the clinic assistant" }));
    await act(async () => {
      resolve({ ok: true, json: async () => ({ reply: "You have two sessions today." }) });
    });
    expect(screen.queryByText("You have two sessions today.")).not.toBeInTheDocument();
    expect(screen.getByText("How many sessions today?")).toBeInTheDocument();
  });
});

describe("AssistantDock voice", () => {
  it("asks for the microphone on Speak, then releases that stream and starts listening", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    const stopTrack = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
    setMediaDevices(getUserMedia);
    openDock();

    fireEvent.click(screen.getByRole("button", { name: "Speak" }));
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    await waitFor(() => expect(FakeRecognition.instances[0]?.start).toHaveBeenCalled());
    expect(stopTrack).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Stop voice" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Message")).toHaveAttribute("placeholder", "Listening…");
  });

  it("explains a blocked microphone, stays off, and lets the user try again", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("denied"), { name: "NotAllowedError" }))
      .mockResolvedValueOnce({ getTracks: () => [] });
    setMediaDevices(getUserMedia);
    openDock();

    fireEvent.click(screen.getByRole("button", { name: "Speak" }));
    expect(await screen.findByText(MIC_BLOCKED)).toBeInTheDocument();
    expect(MIC_BLOCKED).toMatch(/type instead/);
    expect(MIC_BLOCKED).toMatch(/Allow/);
    expect(screen.getByRole("button", { name: "Speak" })).toHaveAttribute("aria-pressed", "false");
    expect(FakeRecognition.instances).toHaveLength(0);
    // Typing still works while voice is off.
    expect(screen.getByLabelText("Message")).not.toHaveAttribute("readonly");

    fireEvent.click(screen.getByRole("button", { name: "Speak" }));
    await waitFor(() => expect(FakeRecognition.instances[0]?.start).toHaveBeenCalled());
    expect(screen.queryByText(MIC_BLOCKED)).not.toBeInTheDocument();
  });

  it("turns voice off without a restart loop when recognition reports not-allowed", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    setMediaDevices(vi.fn().mockResolvedValue({ getTracks: () => [] }));
    openDock();
    fireEvent.click(screen.getByRole("button", { name: "Speak" }));
    await waitFor(() => expect(FakeRecognition.instances).toHaveLength(1));
    const rec = FakeRecognition.instances[0]!;

    act(() => {
      rec.onerror?.({ error: "not-allowed" });
      rec.onend?.();
    });
    expect(screen.getByText(MIC_BLOCKED)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Speak" })).toHaveAttribute("aria-pressed", "false");
    expect(rec.abort).toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it("says so when the browser has no speech recognition, and never asks for the mic", () => {
    const getUserMedia = vi.fn();
    setMediaDevices(getUserMedia);
    openDock();
    fireEvent.click(screen.getByRole("button", { name: "Speak" }));
    expect(screen.getByText(NO_RECOGNITION)).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Speak" })).toHaveAttribute("aria-pressed", "false");
  });

  it("stops listening when the dock is closed", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    setMediaDevices(vi.fn().mockResolvedValue({ getTracks: () => [] }));
    openDock();
    fireEvent.click(screen.getByRole("button", { name: "Speak" }));
    await waitFor(() => expect(FakeRecognition.instances).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(FakeRecognition.instances[0]?.abort).toHaveBeenCalled();
  });
});

describe("AssistantDock voice pill", () => {
  const press = (el: HTMLElement, clientX = 200) =>
    fireEvent.pointerDown(el, { pointerId: 1, isPrimary: true, button: 0, clientX });
  const lift = (el: HTMLElement, clientX = 200) => fireEvent.pointerUp(el, { pointerId: 1, isPrimary: true, button: 0, clientX });

  function heard(rec: FakeRecognition, transcript: string, isFinal: boolean) {
    const result = Object.assign([{ transcript }], { isFinal });
    act(() => rec.onresult?.({ resultIndex: 0, results: [result] }));
  }

  it("replaces the old mic button with the React Bits voice pill", () => {
    openDock();
    const pills = screen.getAllByRole("button", { name: "Speak" });
    expect(pills).toHaveLength(1);
    expect(pills[0]).toHaveClass("voice-pill", "clinic-voice-pill");
    expect(pills[0]).toHaveAttribute("aria-pressed", "false");
    // Themed to the clinic, not the dark React Bits defaults.
    expect(pills[0]!.style.getPropertyValue("--vp-bg")).toBe("#ececf0");
    expect(pills[0]!.style.getPropertyValue("--vp-accent")).toBe("#ffffff");
    expect(pills[0]!.style.getPropertyValue("--vp-size")).toBe("32px");
  });

  it("a tap asks for the mic inside the press, starts recognition, and widens the input", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [] });
    setMediaDevices(getUserMedia);
    openDock();
    const pill = screen.getByRole("button", { name: "Speak" });
    press(pill);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    lift(pill);
    await waitFor(() => expect(FakeRecognition.instances[0]?.start).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Stop voice" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Message")).toHaveClass("pr-[9.75rem]");

    press(pill);
    lift(pill);
    expect(FakeRecognition.instances[0]?.abort).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Speak" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("Message")).toHaveClass("pr-12");
  });

  it("slide to cancel stops listening and never sends the half-heard words", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    setMediaDevices(vi.fn().mockResolvedValue({ getTracks: () => [] }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    openDock();
    const pill = screen.getByRole("button", { name: "Speak" });
    press(pill, 200);
    await waitFor(() => expect(FakeRecognition.instances).toHaveLength(1));
    const rec = FakeRecognition.instances[0]!;
    heard(rec, "cancel my four o'clock", false);
    expect(screen.getByLabelText("Message")).toHaveValue("cancel my four o'clock");

    fireEvent.pointerMove(pill, { pointerId: 1, isPrimary: true, clientX: 120 });
    expect(rec.abort).toHaveBeenCalled();
    act(() => rec.onend?.());
    lift(pill, 120);
    expect(screen.getByLabelText("Message")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Speak" })).toHaveAttribute("aria-pressed", "false");
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it("stopping during the permission prompt does not turn voice on afterwards", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    let grant: (value: unknown) => void = () => {};
    setMediaDevices(vi.fn().mockReturnValue(new Promise((done) => (grant = done))));
    openDock();
    const pill = screen.getByRole("button", { name: "Speak" });
    fireEvent.keyDown(pill, { key: "Enter" });
    expect(screen.getByText("Allow the microphone if your browser asks.")).toBeInTheDocument();
    fireEvent.keyDown(pill, { key: "Enter" });
    await act(async () => grant({ getTracks: () => [] }));
    expect(FakeRecognition.instances).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Speak" })).toHaveAttribute("aria-pressed", "false");
  });

  it("while a reply is read aloud, Stop speaking interrupts and keeps listening", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    setMediaDevices(vi.fn().mockResolvedValue({ getTracks: () => [] }));
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      speak: vi.fn(),
      cancel: vi.fn(),
      resume: vi.fn(),
      getVoices: () => [],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("speechSynthesis", synth);
    // The barge-in level meter opens while speaking.
    vi.stubGlobal(
      "AudioContext",
      class {
        createAnalyser = () => ({ fftSize: 0, getByteTimeDomainData: vi.fn() });
        createMediaStreamSource = () => ({ connect: vi.fn() });
        close = vi.fn().mockResolvedValue(undefined);
      },
    );
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        lang = "";
        voice: unknown = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      },
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: "You have two sessions today." }) }));
    openDock();
    fireEvent.keyDown(screen.getByRole("button", { name: "Speak" }), { key: "Enter" });
    await waitFor(() => expect(FakeRecognition.instances).toHaveLength(1));
    heard(FakeRecognition.instances[0]!, "How many sessions today?", true);

    const stopSpeaking = await screen.findByRole("button", { name: "Stop speaking" });
    expect(synth.speak).toHaveBeenCalled();
    fireEvent.click(stopSpeaking);
    expect(synth.cancel).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Stop speaking" })).not.toBeInTheDocument());
    // Voice stays on and listening starts again; the pill was not reset.
    expect(screen.getByRole("button", { name: "Stop voice" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(FakeRecognition.instances).toHaveLength(2));
  });

  it("keeps the mic on after a spoken message is sent, until the user taps to stop", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    setMediaDevices(vi.fn().mockResolvedValue({ getTracks: () => [] }));
    const spoken = stubSpeech([]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: "You have two sessions today." }) });
    vi.stubGlobal("fetch", fetchMock);
    openDock();
    const pill = screen.getByRole("button", { name: "Speak" });
    press(pill);
    lift(pill);
    await waitFor(() => expect(FakeRecognition.instances[0]?.start).toHaveBeenCalled());
    expect(FakeRecognition.instances[0]?.continuous).toBe(true);

    heard(FakeRecognition.instances[0]!, "How many sessions today?", true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Sending does not turn voice off: the pill stays latched while the reply comes back.
    expect(screen.getByRole("button", { name: "Stop voice" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(spoken).toHaveLength(1));
    expect(screen.getByText("You have two sessions today.")).toBeInTheDocument();

    // After the reply, listening resumes on its own so they can speak again without a tap.
    await waitFor(() => expect(FakeRecognition.instances).toHaveLength(2));
    const next = FakeRecognition.instances[1]!;
    expect(next.start).toHaveBeenCalled();
    expect(next.continuous).toBe(true);
    expect(screen.getByRole("button", { name: "Stop voice" })).toHaveAttribute("aria-pressed", "true");

    // A second utterance is sent the same way (after the short post-speech echo guard).
    await new Promise((resolve) => setTimeout(resolve, 450));
    heard(next, "And tomorrow?", true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(FakeRecognition.instances).toHaveLength(3));
    expect(screen.getByRole("button", { name: "Stop voice" })).toHaveAttribute("aria-pressed", "true");

    // Only a tap stops it, and nothing restarts afterwards.
    const stop = screen.getByRole("button", { name: "Stop voice" });
    press(stop);
    lift(stop);
    expect(FakeRecognition.instances[2]?.abort).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Speak" })).toHaveAttribute("aria-pressed", "false");
    act(() => FakeRecognition.instances[2]?.onend?.());
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(FakeRecognition.instances).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("restarts listening when the browser ends a silent session, instead of turning the mic off", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    setMediaDevices(vi.fn().mockResolvedValue({ getTracks: () => [] }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    openDock();
    const pill = screen.getByRole("button", { name: "Speak" });
    press(pill);
    lift(pill);
    await waitFor(() => expect(FakeRecognition.instances[0]?.start).toHaveBeenCalled());
    act(() => FakeRecognition.instances[0]?.onerror?.({ error: "no-speech" }));
    act(() => FakeRecognition.instances[0]?.onend?.());
    await waitFor(() => expect(FakeRecognition.instances).toHaveLength(2));
    expect(FakeRecognition.instances[1]?.start).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Stop voice" })).toHaveAttribute("aria-pressed", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

class FakeUtterance {
  lang = "";
  voice: { lang: string } | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

/** Speech synthesis that "finishes" each utterance at once and records what was said. */
function stubSpeech(voices: { lang: string; name: string }[]) {
  const spoken: FakeUtterance[] = [];
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  vi.stubGlobal("speechSynthesis", {
    speaking: false,
    pending: false,
    paused: false,
    getVoices: () => voices,
    cancel: vi.fn(),
    resume: vi.fn(),
    speak: (utterance: FakeUtterance) => {
      spoken.push(utterance);
      utterance.onend?.();
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  return spoken;
}

function replyWith(...bodies: object[]) {
  const fetchMock = vi.fn();
  for (const body of bodies) fetchMock.mockResolvedValueOnce({ ok: true, json: async () => body });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function type(text: string, fetchMock: ReturnType<typeof vi.fn>, calls: number) {
  const box = screen.getByLabelText("Message");
  fireEvent.change(box, { target: { value: text } });
  fireEvent.keyDown(box, { key: "Enter" });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(calls));
  await waitFor(() => expect(screen.getByLabelText("Message")).not.toHaveAttribute("aria-busy", "true"));
}

async function startVoice() {
  vi.stubGlobal("SpeechRecognition", FakeRecognition);
  setMediaDevices(vi.fn().mockResolvedValue({ getTracks: () => [] }));
  fireEvent.click(screen.getByRole("button", { name: "Speak" }));
  await waitFor(() => expect(FakeRecognition.instances[0]?.start).toHaveBeenCalled());
}

describe("AssistantDock languages", () => {
  it("starts listening in the language saved from a previous visit", async () => {
    window.localStorage.setItem(LOCALE_KEY, "te-IN");
    openDock();
    await startVoice();
    expect(FakeRecognition.instances[0]?.lang).toBe("te-IN");
  });

  it("starts in Indian English on a first visit with an English browser", async () => {
    openDock();
    await startVoice();
    expect(FakeRecognition.instances[0]?.lang).toBe("en-IN");
  });

  it("detects Devanagari, Telugu and Latin from what is typed, and remembers it", async () => {
    const fetchMock = replyWith({ reply: "कल सुबह 10 बजे।" }, { reply: "రేపు ఉదయం." }, { reply: "The clinic opens at 9 on Monday." });
    openDock();
    await type("मेरा अपॉइंटमेंट कब है?", fetchMock, 1);
    await waitFor(() => expect(window.localStorage.getItem(LOCALE_KEY)).toBe("hi-IN"));
    await type("నా అపాయింట్‌మెంట్ ఎప్పుడు?", fetchMock, 2);
    await waitFor(() => expect(window.localStorage.getItem(LOCALE_KEY)).toBe("te-IN"));
    await type("What are the clinic hours on Monday?", fetchMock, 3);
    await waitFor(() => expect(window.localStorage.getItem(LOCALE_KEY)).toBe("en-IN"));
  });

  it("does not reset to English for a short follow-up", async () => {
    window.localStorage.setItem(LOCALE_KEY, "hi-IN");
    const fetchMock = replyWith({ reply: "ठीक है।" });
    openDock();
    await type("ok", fetchMock, 1);
    expect(screen.getByText("ठीक है।")).toBeInTheDocument();
    expect(window.localStorage.getItem(LOCALE_KEY)).toBe("hi-IN");
  });

  it("speaks and then listens in the locale the server returns, with a voice for that language", async () => {
    const spoken = stubSpeech([
      { lang: "en-IN", name: "English India" },
      { lang: "te-IN", name: "Telugu India" },
    ]);
    replyWith({ reply: "మీ అపాయింట్‌మెంట్ రేపు ఉదయం.", locale: "te-IN" });
    openDock();
    await startVoice();
    const first = FakeRecognition.instances[0]!;
    act(() => {
      first.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: "నా అపాయింట్‌మెంట్ ఎప్పుడు" }], { isFinal: true })] });
    });
    await waitFor(() => expect(spoken).toHaveLength(1));
    expect(spoken[0]!.lang).toBe("te-IN");
    expect(spoken[0]!.voice?.lang).toBe("te-IN");
    await waitFor(() => expect(FakeRecognition.instances.length).toBeGreaterThan(1));
    expect(FakeRecognition.instances.at(-1)?.lang).toBe("te-IN");
    expect(window.localStorage.getItem(LOCALE_KEY)).toBe("te-IN");
  });

  it("uses a voice with the same language prefix, and speaks with no matching voice at all", async () => {
    const spoken = stubSpeech([
      { lang: "en-IN", name: "English India" },
      { lang: "ta-LK", name: "Tamil Sri Lanka" },
    ]);
    replyWith({ reply: "நாளை காலை.", locale: "ta-IN" }, { reply: "ನಾಳೆ ಬೆಳಿಗ್ಗೆ.", locale: "kn-IN" });
    openDock();
    await startVoice();
    const box = screen.getByLabelText("Message");
    fireEvent.change(box, { target: { value: "என் சந்திப்பு எப்போது?" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(spoken).toHaveLength(1));
    expect(spoken[0]!.lang).toBe("ta-IN");
    expect(spoken[0]!.voice?.lang).toBe("ta-LK");

    await waitFor(() => expect(screen.getByLabelText("Message")).not.toHaveAttribute("readonly"));
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "ನನ್ನ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಯಾವಾಗ?" } });
    fireEvent.keyDown(screen.getByLabelText("Message"), { key: "Enter" });
    await waitFor(() => expect(spoken).toHaveLength(2));
    expect(spoken[1]!.lang).toBe("kn-IN");
    // No Kannada voice: the browser default speaks it, never an English voice.
    expect(spoken[1]!.voice).toBeNull();
  });

  it("speaks an English summary in English but keeps listening in the user's language", async () => {
    const spoken = stubSpeech([{ lang: "en-IN", name: "English India" }]);
    replyWith({ reply: "I have not booked anything.", locale: "en-IN" });
    window.localStorage.setItem(LOCALE_KEY, "te-IN");
    openDock();
    await startVoice();
    act(() => {
      FakeRecognition.instances[0]!.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: "వద్దు" }], { isFinal: true })] });
    });
    await waitFor(() => expect(spoken).toHaveLength(1));
    expect(spoken[0]!.lang).toBe("en-IN");
    await waitFor(() => expect(FakeRecognition.instances.length).toBeGreaterThan(1));
    expect(FakeRecognition.instances.at(-1)?.lang).toBe("te-IN");
  });
});

describe("AssistantDock language menu", () => {
  function pickLanguage(name: string) {
    const chip = screen.getByRole("combobox", { name: "Language" });
    chip.focus();
    fireEvent.keyDown(chip, { key: "Enter" });
    const list = screen.getByRole("listbox", { name: "Language" });
    const options = Array.from(list.querySelectorAll('[role="option"]'));
    const target = options.findIndex((option) => option.textContent?.includes(name));
    expect(target).toBeGreaterThanOrEqual(0);
    fireEvent.keyDown(chip, { key: "Home" });
    for (let i = 0; i < target; i += 1) fireEvent.keyDown(chip, { key: "ArrowDown" });
    fireEvent.keyDown(chip, { key: "Enter" });
  }

  function sentBody(fetchMock: ReturnType<typeof vi.fn>, call: number) {
    return JSON.parse((fetchMock.mock.calls[call]![1] as { body: string }).body) as { language?: string };
  }

  it("sits in the header, defaults to Auto, and lists the supported languages in their own scripts", () => {
    openDock();
    const chip = screen.getByRole("combobox", { name: "Language" });
    expect(chip).toHaveTextContent("Auto");
    expect(chip.closest(".clinic-dock")).not.toBeNull();
    fireEvent.keyDown(chip, { key: "Enter" });
    const labels = Array.from(screen.getByRole("listbox", { name: "Language" }).querySelectorAll(".glide-select__name")).map(
      (node) => node.textContent,
    );
    expect(labels).toEqual([
      "Auto",
      "English",
      "Hinglish",
      "हिन्दी",
      "मराठी",
      "తెలుగు",
      "தமிழ்",
      "ಕನ್ನಡ",
      "മലയാളം",
      "ગુજરાતી",
      "ਪੰਜਾਬੀ",
      "বাংলা",
      "ଓଡ଼ିଆ",
      "اردو",
      "Español",
      "Français",
    ]);
  });

  it("is themed from the clinic tokens, not the component's dark defaults", () => {
    openDock();
    const root = screen.getByRole("combobox", { name: "Language" }).closest(".glide-select") as HTMLElement;
    expect(root.style.getPropertyValue("--gs-surface")).toBe("var(--color-fill)");
    expect(root.style.getPropertyValue("--gs-text")).toBe("var(--color-ink)");
    expect(root.style.getPropertyValue("--gs-accent")).toBe("var(--color-accent)");
    expect(root.style.getPropertyValue("--gs-highlight")).toBe("var(--color-fill-strong)");
  });

  it("locks a picked language: saved, sent to the server, and kept when the user writes in another", async () => {
    const fetchMock = replyWith({ reply: "రేపు ఉదయం." }, { reply: "సరే." });
    openDock();
    pickLanguage("తెలుగు");
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("తెలుగు");
    expect(window.localStorage.getItem(LANGUAGE_KEY)).toBe("te");
    expect(window.localStorage.getItem(LOCALE_KEY)).toBe("te-IN");

    await type("When is my appointment tomorrow?", fetchMock, 1);
    expect(sentBody(fetchMock, 0).language).toBe("te");
    // English text does not switch away from the picked language.
    expect(window.localStorage.getItem(LOCALE_KEY)).toBe("te-IN");
    await type("मेरा अपॉइंटमेंट कब है?", fetchMock, 2);
    expect(sentBody(fetchMock, 1).language).toBe("te");
    expect(window.localStorage.getItem(LOCALE_KEY)).toBe("te-IN");
  });

  it("restores a locked pick on the next visit and listens in it", async () => {
    window.localStorage.setItem(LANGUAGE_KEY, "hi");
    window.localStorage.setItem(LOCALE_KEY, "en-IN");
    openDock();
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("हिन्दी");
    await startVoice();
    expect(FakeRecognition.instances[0]?.lang).toBe("hi-IN");
  });

  it("keeps listening in the locked language whatever the server or the speech says", async () => {
    const spoken = stubSpeech([{ lang: "en-IN", name: "English India" }, { lang: "es-ES", name: "Spanish" }]);
    replyWith({ reply: "Mañana a las diez.", locale: "en-IN" });
    window.localStorage.setItem(LANGUAGE_KEY, "es");
    openDock();
    await startVoice();
    act(() => {
      FakeRecognition.instances[0]!.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: "what time is my visit" }], { isFinal: true })] });
    });
    await waitFor(() => expect(spoken).toHaveLength(1));
    expect(spoken[0]!.lang).toBe("es-ES");
    await waitFor(() => expect(FakeRecognition.instances.length).toBeGreaterThan(1));
    expect(FakeRecognition.instances.at(-1)?.lang).toBe("es-ES");
  });

  it("restarts a running recogniser in the newly picked language", async () => {
    openDock();
    await startVoice();
    expect(FakeRecognition.instances[0]?.lang).toBe("en-IN");
    pickLanguage("தமிழ்");
    await waitFor(() => expect(FakeRecognition.instances.at(-1)?.lang).toBe("ta-IN"));
    expect(FakeRecognition.instances[0]?.abort).toHaveBeenCalled();
  });

  it("goes back to automatic detection when Auto is picked", async () => {
    const fetchMock = replyWith({ reply: "कल सुबह।" });
    window.localStorage.setItem(LANGUAGE_KEY, "te");
    openDock();
    pickLanguage("Auto");
    expect(window.localStorage.getItem(LANGUAGE_KEY)).toBe("auto");
    await type("मेरा अपॉइंटमेंट कब है?", fetchMock, 1);
    expect(sentBody(fetchMock, 0).language).toBe("auto");
    await waitFor(() => expect(window.localStorage.getItem(LOCALE_KEY)).toBe("hi-IN"));
  });
});

describe("AssistantDock resize", () => {
  it("clamps sizes to the limits and the window", () => {
    expect(clampDockSize({ width: 100, height: 100 }, 1280, 800)).toEqual({ width: 320, height: 360 });
    expect(clampDockSize({ width: 5000, height: 5000 }, 1280, 800)).toEqual({ width: 960, height: 760 });
    expect(clampDockSize({ width: 900, height: 700 }, 800, 600)).toEqual({ width: 760, height: 560 });
  });

  it("restores a saved size on wide screens and offers a labelled resize handle", () => {
    setDesktop(true);
    window.localStorage.setItem(DOCK_SIZE_KEY, JSON.stringify({ width: 500, height: 600 }));
    openDock();
    const panel = screen.getByRole("dialog");
    expect(panel.style.width).toBe("500px");
    expect(panel.style.height).toBe("600px");
    expect(screen.getByRole("button", { name: "Resize assistant panel" })).toBeInTheDocument();
  });

  it("resizes with the keyboard and remembers the size", () => {
    setDesktop(true);
    window.localStorage.setItem(DOCK_SIZE_KEY, JSON.stringify({ width: 500, height: 600 }));
    openDock();
    const handle = screen.getByRole("button", { name: "Resize assistant panel" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    const panel = screen.getByRole("dialog");
    expect(panel.style.width).toBe("524px");
    expect(panel.style.height).toBe("624px");
    expect(JSON.parse(window.localStorage.getItem(DOCK_SIZE_KEY) ?? "{}")).toEqual({ width: 524, height: 624 });
  });

  it("grows when the corner is dragged up and left, and saves on release", () => {
    setDesktop(true);
    window.localStorage.setItem(DOCK_SIZE_KEY, JSON.stringify({ width: 400, height: 500 }));
    openDock();
    const handle = screen.getByRole("button", { name: "Resize assistant panel" });
    fireEvent.pointerDown(handle, { button: 0, clientX: 600, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 500, clientY: 250 });
    const panel = screen.getByRole("dialog");
    expect(panel.style.width).toBe("500px");
    expect(panel.style.height).toBe("550px");
    expect(document.body.style.userSelect).toBe("none");
    fireEvent.pointerUp(window, { clientX: 500, clientY: 250 });
    expect(document.body.style.userSelect).toBe("");
    expect(JSON.parse(window.localStorage.getItem(DOCK_SIZE_KEY) ?? "{}")).toEqual({ width: 500, height: 550 });
  });

  it("keeps the full-width sheet on small screens", () => {
    setDesktop(false);
    window.localStorage.setItem(DOCK_SIZE_KEY, JSON.stringify({ width: 500, height: 600 }));
    openDock();
    expect(screen.queryByRole("button", { name: "Resize assistant panel" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog").style.width).toBe("");
  });
});

describe("AssistantDock scrolling and thought line contrast", () => {
  it("makes the message list the only scrolling region inside the dock", () => {
    openDock();
    const panel = screen.getByRole("dialog");
    // A flex column with a bounded height clips its children unless they can shrink.
    // min-h-0 on the panel and the scroller is what lets overflow-y-auto actually scroll.
    expect(panel.className.split(" ")).toEqual(
      expect.arrayContaining(["flex", "flex-col", "min-h-0", "overflow-hidden"]),
    );

    const scroller = panel.querySelector("[aria-live='polite']");
    expect(scroller).toBeInstanceOf(HTMLElement);
    expect(scroller).toHaveClass("min-h-0", "flex-1", "overflow-y-auto", "overscroll-contain");
    expect(scroller?.className).toContain("[-webkit-overflow-scrolling:touch]");

    const header = screen.getByRole("button", { name: "Close" }).parentElement;
    const form = panel.querySelector("form");
    expect(header).toHaveClass("flex-shrink-0");
    expect(form).toHaveClass("flex-shrink-0");
    expect(form).toHaveClass("overflow-visible");
    expect(header).not.toHaveClass("overflow-y-auto");
    expect(form).not.toHaveClass("overflow-y-auto");

    // jsdom does not do real flex layout, so scrollHeight > clientHeight cannot be
    // asserted here. The classes above are what make a long conversation scroll
    // in the browser: the scroller shrinks, and the header and composer stay put.
  });

  it("paints the thinking line in solid ink so the working and settled labels stay readable", async () => {
    let finish: (value: unknown) => void = () => {};
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    openDock();
    const box = screen.getByLabelText("Message");
    fireEvent.change(box, { target: { value: "How many sessions today?" } });
    fireEvent.keyDown(box, { key: "Enter" });

    function expectSolidInk(line: HTMLElement) {
      expect(line).toHaveClass("clinic-thought-line");
      expect(line.closest(".text-ink")).not.toBeNull();
      expect(line.closest(".font-semibold")).not.toBeNull();
      expect(line.closest(".text-ink-2")).toBeNull();
      expect(line.closest(".text-muted")).toBeNull();
      expect(line.style.getPropertyValue("--tl-color")).toBe("var(--color-ink, #1d1d1f)");
      expect(line.style.getPropertyValue("--tl-font")).toBe("16px");
      // The words are never painted transparent or clipped through background-clip.
      const breath = line.querySelector(".thought-line__breath") as HTMLElement;
      expect(breath.style.color).not.toBe("transparent");
      expect(breath.style.webkitTextFillColor ?? "").not.toBe("transparent");
      expect(line.querySelector(".thought-line__timer")).not.toBeNull();
    }

    // Waiting: "Checking…" is on screen while the request is in flight.
    const working = (await screen.findByRole("status")).closest(".thought-line") as HTMLElement;
    expect(working).toHaveAttribute("data-working");
    expect(working.querySelector(".thought-line__text[data-active]")).toHaveTextContent("Checking…");
    expectSolidInk(working);
    // The animation is back while waiting: the shimmer layer is on (drawn by AssistantDock.css
    // as a sheen behind the words and a gleam under them), and the sparkle breathes.
    expect(working.querySelector(".thought-line__breath[data-shimmer]")).not.toBeNull();
    expect(working.querySelector(".thought-line__glyph")).not.toBeNull();
    expect(working.style.getPropertyValue("--tl-shimmer")).toBe("1.8s");

    await act(async () => {
      finish({ ok: true, json: async () => ({ reply: "You have two sessions today." }) });
    });
    await screen.findByText("You have two sessions today.");

    // Settled: "Thought for" plus the frozen timer, same solid ink.
    const settled = screen.getByRole("status").closest(".thought-line") as HTMLElement;
    expect(settled).not.toHaveAttribute("data-working");
    expect(settled.querySelector(".thought-line__text--done[data-active]")).toHaveTextContent("Thought for");
    expect(settled.querySelector(".thought-line__timer")?.textContent).toMatch(/^\d+\.\ds$/);
    expectSolidInk(settled);
  });

  it("keeps the dock's thinking-line CSS free of transparent, clipped text and dimmed settles", () => {
    const css = dockCss.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).not.toMatch(/color:\s*transparent/);
    expect(css).not.toMatch(/text-fill-color:\s*transparent/);
    expect(css).not.toMatch(/background-clip:\s*text/);
    expect(css).toMatch(/--tl-done:\s*1;/);
    expect(css).toMatch(/--tl-timer:\s*1;/);
    expect(css).toMatch(/font-weight:\s*600;/);
    expect(css).toMatch(/color:\s*var\(--color-ink, #1d1d1f\)/);
  });

  it("animates the waiting line on separate layers, never by clipping the words", () => {
    const css = dockCss.replace(/\/\*[\s\S]*?\*\//g, "");
    // The words under the shimmer keep a solid fill and are never clipped.
    const words = css.match(/\.thought-line__breath\[data-shimmer\]\s*\{[^}]*\}/)?.[0] ?? "";
    expect(words).toMatch(/-webkit-text-fill-color:\s*var\(--color-ink, #1d1d1f\)\s*!important/);
    expect(words).toMatch(/background-clip:\s*border-box\s*!important/);
    // Motion: a sheen behind the words, a gleam under them, and a twinkling sparkle.
    const sheen = css.match(/\[data-shimmer\]::before\s*\{[^}]*\}/)?.[0] ?? "";
    const gleam = css.match(/\[data-shimmer\]::after\s*\{[^}]*\}/)?.[0] ?? "";
    expect(sheen).toMatch(/z-index:\s*-1/);
    expect(sheen).toMatch(/animation:\s*clinic-thought-sheen/);
    expect(gleam).toMatch(/animation:\s*clinic-thought-gleam/);
    expect(css).toMatch(/@keyframes clinic-thought-sheen/);
    expect(css).toMatch(/@keyframes clinic-thought-gleam/);
    expect(css).toMatch(/\.thought-line__glyph svg\s*\{[^}]*animation:\s*clinic-thought-twinkle/);
    // Reduced motion turns the layers off.
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
  });

  it("sets the conversation in the dock's own typeface, not the site's Inter", () => {
    openDock();
    expect(screen.getByRole("dialog")).toHaveClass("clinic-dock");
    const css = dockCss.replace(/\/\*[\s\S]*?\*\//g, "");
    const face = css.match(/\.clinic-dock\s*\{[^}]*font-family:\s*([^;]+);/)?.[1] ?? "";
    expect(face).toMatch(/^var\(--font-dock\), "IBM Plex Sans"/);
    expect(face).not.toMatch(/Inter|Geist|Roboto|system-ui/);
    const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout).toMatch(/IBM_Plex_Sans\([^)]*variable: "--font-dock"/);
  });
});

describe("AssistantDock quick prompts", () => {
  const patient = { name: "Asha Rao", role: "patient" as const };

  function promptList() {
    return screen.queryByRole("list", { name: "Suggested questions" });
  }

  it("shows the doctor's prompts in an empty conversation", () => {
    render(<AssistantDock user={doctor} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask the clinic assistant" }));
    expect(promptList()).not.toBeNull();
    for (const prompt of QUICK_PROMPTS.doctor) expect(screen.getByRole("button", { name: prompt })).toBeTruthy();
    expect(screen.queryByRole("button", { name: QUICK_PROMPTS.patient[0] })).toBeNull();
  });

  it("shows the patient's prompts in an empty conversation", () => {
    render(<AssistantDock user={patient} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask the clinic assistant" }));
    for (const prompt of QUICK_PROMPTS.patient) expect(screen.getByRole("button", { name: prompt })).toBeTruthy();
    expect(screen.queryByRole("button", { name: QUICK_PROMPTS.doctor[0] })).toBeNull();
  });

  it("sends the prompt on click, then hides the prompts once the conversation starts", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: "Two visits are booked today." }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<AssistantDock user={doctor} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask the clinic assistant" }));

    fireEvent.click(screen.getByRole("button", { name: "What's on my schedule today?" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/assistant");
    const body = JSON.parse((init as { body: string }).body) as { messages: { role: string; content: string }[] };
    expect(body.messages).toEqual([{ role: "user", content: "What's on my schedule today?" }]);
    expect(promptList()).toBeNull();
    expect(await screen.findByText("Two visits are booked today.")).toBeTruthy();
    expect(promptList()).toBeNull();
    expect(screen.queryByRole("button", { name: "Add a consulting session" })).toBeNull();
  });
});
