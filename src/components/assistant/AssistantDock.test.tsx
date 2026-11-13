import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantDock, DOCK_SIZE_KEY, MIC_BLOCKED, NO_RECOGNITION, clampDockSize } from "./AssistantDock";

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
    expect(status).toHaveTextContent("Checking the book…");
    const line = status.closest(".thought-line") as HTMLElement;
    expect(line).toHaveAttribute("data-working");
    // The old plain paragraph is gone; the label lives inside the line.
    expect(screen.getAllByText("Checking the book…").every((el) => el.tagName !== "P" && line.contains(el))).toBe(true);

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
    expect(second).toHaveTextContent("Checking the book…");
    expect(second?.closest(".thought-line")).toHaveAttribute("data-working");
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
