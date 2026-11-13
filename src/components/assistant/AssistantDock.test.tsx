import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantDock, DOCK_SIZE_KEY, LOCALE_KEY, MIC_BLOCKED, NO_RECOGNITION, clampDockSize } from "./AssistantDock";

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
