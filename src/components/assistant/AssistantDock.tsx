"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { PublicUser } from "@/lib/clinic-types";
import { isEcho } from "@/lib/assistant/echo";
import type { SlotLink } from "@/lib/assistant/slot-links";
import { addDays, todayIso } from "@/lib/clock";
import { formatShortDate } from "@/lib/format";
import { buttonClass } from "@/components/ui/button-styles";

interface PendingCard {
  token: string;
  title: string;
  summary: string;
  confirmLabel: string;
  expiresAt: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  payUrl?: string;
  slots?: SlotLink[];
}

interface TurnResponse {
  reply?: string;
  pending?: PendingCard | null;
  payUrl?: string;
  slots?: SlotLink[];
  message?: string;
}

/** Devanagari means Hindi. Latin script covers English and Hinglish. */
function localeFor(text: string): "hi-IN" | "en-IN" {
  return /\p{Script=Devanagari}/u.test(text) ? "hi-IN" : "en-IN";
}

function expiryLabel(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "soon";
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(when) + " IST";
}

type DockUser = Pick<PublicUser, "name" | "role">;

function dayLabel(date: string, today: string): string {
  const short = formatShortDate(date);
  if (date === today) return `Today, ${short}`;
  if (date === addDays(today, 1)) return `Tomorrow, ${short}`;
  return short;
}

/** Open times grouped by doctor and day. For patients each time opens its booking form. */
export function SlotList({ slots, onPick }: { slots: readonly SlotLink[]; onPick?: () => void }) {
  const today = todayIso();
  const groups: { key: string; doctor: string; date: string; slots: SlotLink[] }[] = [];
  for (const slot of slots) {
    const key = `${slot.doctorId}|${slot.date}`;
    const group = groups.find((item) => item.key === key);
    if (group) group.slots.push(slot);
    else groups.push({ key, doctor: slot.doctor, date: slot.date, slots: [slot] });
  }
  const manyDoctors = new Set(slots.map((slot) => slot.doctorId)).size > 1;
  const bookable = slots.some((slot) => slot.href);
  return (
    <div className="mt-2 space-y-3 rounded-2xl border border-hairline bg-canvas p-3">
      {groups.map((group) => {
        const label = `${manyDoctors ? `${group.doctor} · ` : ""}${dayLabel(group.date, today)}`;
        return (
          <div key={group.key}>
            <p className="text-caption font-semibold text-ink-2">{label}</p>
            <ul aria-label={`Open times, ${group.doctor}, ${dayLabel(group.date, today)}`} className="mt-1.5 flex flex-wrap gap-1.5">
              {group.slots.map((slot) => (
                <li key={slot.id}>
                  {slot.href ? (
                    <Link
                      href={slot.href}
                      onClick={onPick}
                      aria-label={`Book ${slot.doctor}, ${dayLabel(slot.date, today)} at ${slot.time}`}
                      className="tabular inline-flex h-8 items-center rounded-full border border-accent px-3 text-callout font-medium text-accent hover:bg-accent hover:text-white focus-visible:bg-accent focus-visible:text-white"
                    >
                      {slot.time}
                    </Link>
                  ) : (
                    <span className="tabular inline-flex h-8 items-center rounded-full bg-fill px-3 text-callout text-ink">{slot.time}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {bookable ? <p className="text-caption text-muted">Tap a time to open its booking form. Nothing is booked until you confirm there.</p> : null}
    </div>
  );
}

interface SpeechRec {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function recognitionCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

export const MIC_BLOCKED =
  "The microphone is blocked for this site. You can type instead. To use voice, click the lock or site settings icon next to the address bar, set Microphone to Allow, then press Speak again.";
export const NO_MIC = "No microphone was found. Connect one and press Speak again, or type instead.";
export const MIC_BUSY = "Another app is using the microphone. Close it and press Speak again, or type instead.";
export const NO_RECOGNITION = "This browser can't turn speech into text. You can type instead, or try Chrome or Edge.";
const MIC_FAILED = "The microphone didn't start. Press Speak to try again, or type instead.";

/** Why getUserMedia failed, as a message for the dock. */
function micProblem(error: unknown): string {
  const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name: unknown }).name) : "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return MIC_BLOCKED;
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return NO_MIC;
  if (name === "NotReadableError" || name === "TrackStartError") return MIC_BUSY;
  return MIC_FAILED;
}

export interface DockSize {
  width: number;
  height: number;
}

export const DOCK_SIZE_KEY = "clinic-assistant-size";
export const DOCK_MIN = { width: 320, height: 360 } as const;
const DOCK_MAX_WIDTH = 960;
/** Space kept between the panel and the window edges (the panel sits 1.25rem from the right and bottom). */
const DOCK_GUTTER = 40;
const RESIZE_STEP = 24;

/** Keep the panel within its limits and inside the window. */
export function clampDockSize(size: DockSize, viewportWidth: number, viewportHeight: number): DockSize {
  const maxWidth = Math.max(DOCK_MIN.width, Math.min(DOCK_MAX_WIDTH, viewportWidth - DOCK_GUTTER));
  const maxHeight = Math.max(240, viewportHeight - DOCK_GUTTER);
  const minHeight = Math.min(DOCK_MIN.height, maxHeight);
  return {
    width: Math.round(Math.min(maxWidth, Math.max(DOCK_MIN.width, size.width))),
    height: Math.round(Math.min(maxHeight, Math.max(minHeight, size.height))),
  };
}

function readDockSize(): DockSize | null {
  try {
    const raw = window.localStorage.getItem(DOCK_SIZE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DockSize>;
    if (typeof parsed.width !== "number" || typeof parsed.height !== "number") return null;
    if (!Number.isFinite(parsed.width) || !Number.isFinite(parsed.height)) return null;
    return { width: parsed.width, height: parsed.height };
  } catch {
    return null;
  }
}

function writeDockSize(size: DockSize | null) {
  try {
    if (size) window.localStorage.setItem(DOCK_SIZE_KEY, JSON.stringify(size));
    else window.localStorage.removeItem(DOCK_SIZE_KEY);
  } catch {
    // Private mode or full storage: the size just won't be remembered.
  }
}

function desktopQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia("(min-width: 48rem)");
}

/**
 * Text and voice clinic assistant. Speech recognition is paused while the reply is spoken,
 * so the microphone does not transcribe the assistant. A separate level meter can interrupt
 * speech; that audio is never sent anywhere. Speech recognition runs in the browser.
 * On wider screens the panel can be resized from its top-left corner or its top and left
 * edges, and the size is remembered in localStorage.
 */
export function AssistantDock({ user }: { user: DockUser }) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<PendingCard | null>(null);
  const [draft, setDraft] = useState("");
  const [interim, setInterim] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceNote, setVoiceNote] = useState("");
  const [isDesktop, setIsDesktop] = useState(false);
  const [size, setSize] = useState<DockSize | null>(null);
  const [resizing, setResizing] = useState(false);

  const panelRef = useRef<HTMLDialogElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const bargeRef = useRef<(() => void) | null>(null);
  const speakGen = useRef(0);
  const voiceOnRef = useRef(false);
  const wantListenRef = useRef(false);
  const speakingRef = useRef(false);
  const busyRef = useRef(false);
  const queuedRef = useRef<string | null>(null);
  const lastSpokenRef = useRef("");
  const ignoreUntilRef = useRef(0);
  const localeRef = useRef<"hi-IN" | "en-IN">(typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("hi") ? "hi-IN" : "en-IN");
  const pendingRef = useRef<PendingCard | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const requestingRef = useRef(false);
  const interimRef = useRef("");
  const restartsRef = useRef<number[]>([]);
  const restartTimerRef = useRef(0);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const finishSpeechRef = useRef<(() => void) | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => { pendingRef.current = pending; }, [pending]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages, pending, waiting, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closePanel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // closePanel only touches refs and state setters, so it is safe to leave out of the deps.
  }, [open]);

  // Voices load asynchronously in Chrome; keep the latest list for speak().
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") return;
    const synth = window.speechSynthesis;
    const load = () => {
      voicesRef.current = synth.getVoices?.() ?? [];
    };
    load();
    synth.addEventListener?.("voiceschanged", load);
    return () => synth.removeEventListener?.("voiceschanged", load);
  }, []);

  // Release the microphone and stop speaking if the dock goes away.
  useEffect(
    () => () => {
      wantListenRef.current = false;
      voiceOnRef.current = false;
      window.clearTimeout(restartTimerRef.current);
      recRef.current?.abort();
      recRef.current = null;
      bargeRef.current?.();
      bargeRef.current = null;
      dragCleanupRef.current?.();
      if (typeof window.speechSynthesis !== "undefined") window.speechSynthesis.cancel();
    },
    [],
  );

  useEffect(() => {
    const query = desktopQuery();
    if (!query) return;
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onResize() {
      setSize((current) => (current ? clampDockSize(current, window.innerWidth, window.innerHeight) : current));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  function openPanel() {
    const saved = readDockSize();
    setSize(saved ? clampDockSize(saved, window.innerWidth, window.innerHeight) : null);
    setOpen(true);
  }

  function closePanel() {
    voiceOff("");
    dragCleanupRef.current?.();
    setOpen(false);
    launcherRef.current?.focus();
  }

  function currentSize(): DockSize {
    if (size) return size;
    const rect = panelRef.current?.getBoundingClientRect();
    return { width: rect?.width || 416, height: rect?.height || 560 };
  }

  function applySize(next: DockSize, persist: boolean) {
    const clamped = clampDockSize(next, window.innerWidth, window.innerHeight);
    setSize(clamped);
    if (persist) writeDockSize(clamped);
    return clamped;
  }

  function startResize(event: ReactPointerEvent<HTMLElement>, axis: "both" | "x" | "y") {
    if (event.button !== 0 || !isDesktop) return;
    event.preventDefault();
    dragCleanupRef.current?.();
    const start = { x: event.clientX, y: event.clientY, ...currentSize() };
    let latest: DockSize = clampDockSize(start, window.innerWidth, window.innerHeight);
    const body = document.body;
    const previousSelect = body.style.userSelect;
    body.style.userSelect = "none";
    setResizing(true);
    // The panel is anchored bottom-right, so dragging up or left makes it bigger.
    const move = (moveEvent: PointerEvent) => {
      latest = applySize(
        {
          width: axis === "y" ? start.width : start.width + (start.x - moveEvent.clientX),
          height: axis === "x" ? start.height : start.height + (start.y - moveEvent.clientY),
        },
        false,
      );
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      body.style.userSelect = previousSelect;
      dragCleanupRef.current = null;
      setResizing(false);
    };
    const end = () => {
      cleanup();
      writeDockSize(latest);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    dragCleanupRef.current = cleanup;
  }

  function resizeByKey(event: ReactKeyboardEvent<HTMLElement>) {
    const now = currentSize();
    const step = event.shiftKey ? RESIZE_STEP * 4 : RESIZE_STEP;
    const moves: Record<string, DockSize> = {
      ArrowLeft: { width: now.width + step, height: now.height },
      ArrowRight: { width: now.width - step, height: now.height },
      ArrowUp: { width: now.width, height: now.height + step },
      ArrowDown: { width: now.width, height: now.height - step },
    };
    const next = moves[event.key];
    if (!next) return;
    event.preventDefault();
    applySize(next, true);
  }

  function resetSize() {
    setSize(null);
    writeDockSize(null);
  }

  function stopBarge() {
    bargeRef.current?.();
    bargeRef.current = null;
  }

  function pauseListen() {
    wantListenRef.current = false;
    window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = 0;
    const rec = recRef.current;
    recRef.current = null;
    rec?.abort();
    setListening(false);
    interimRef.current = "";
    setInterim("");
  }

  /** Turn voice fully off: no recognition, no speech, no open microphone. */
  function voiceOff(note?: string) {
    voiceOnRef.current = false;
    setVoiceOn(false);
    pauseListen();
    stopBarge();
    if (typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined") window.speechSynthesis.cancel();
    // Settle any reply that is still being spoken so the turn that awaits it can finish.
    finishSpeechRef.current?.();
    speakingRef.current = false;
    setSpeaking(false);
    if (note !== undefined) setVoiceNote(note);
  }

  function startListen() {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      voiceOff(NO_RECOGNITION);
      return;
    }
    wantListenRef.current = true;
    if (!voiceOnRef.current || speakingRef.current || busyRef.current || recRef.current) return;
    window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = 0;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = localeRef.current;
    let fatal = false;
    rec.onresult = (event) => {
      if (recRef.current !== rec || !wantListenRef.current || speakingRef.current) return;
      let finalText = "";
      let partial = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i]?.[0]?.transcript ?? "";
        if (event.results[i]?.isFinal) finalText += piece;
        else partial += piece;
      }
      interimRef.current = partial;
      setInterim(partial);
      const heard = finalText.trim();
      if (!heard) return;
      localeRef.current = localeFor(heard);
      if (Date.now() < ignoreUntilRef.current || isEcho(heard, lastSpokenRef.current)) return;
      interimRef.current = "";
      setInterim("");
      restartsRef.current = [];
      void send(heard);
    };
    rec.onerror = (event) => {
      if (recRef.current !== rec) return;
      const note =
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? MIC_BLOCKED
          : event.error === "audio-capture"
            ? NO_MIC
            : event.error === "network"
              ? "Speech recognition needs an internet connection. You can type instead."
              : event.error === "language-not-supported"
                ? "This browser can't recognise speech in this language. You can type instead."
                : null;
      // "no-speech" and "aborted" are routine; onend restarts listening.
      if (!note) return;
      fatal = true;
      voiceOff(note);
    };
    rec.onend = () => {
      if (recRef.current !== rec) return;
      recRef.current = null;
      setListening(false);
      const leftover = interimRef.current.trim();
      interimRef.current = "";
      setInterim("");
      if (fatal || !voiceOnRef.current || !wantListenRef.current || speakingRef.current) return;
      // Some browsers end the session without marking the last words final. Send them.
      if (leftover && Date.now() >= ignoreUntilRef.current && !isEcho(leftover, lastSpokenRef.current)) {
        void send(leftover);
        return;
      }
      const now = Date.now();
      restartsRef.current = [...restartsRef.current.filter((at) => now - at < 10_000), now];
      if (restartsRef.current.length > 6) {
        voiceOff("The microphone kept stopping. Press Speak to try again, or type instead.");
        return;
      }
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = 0;
        if (voiceOnRef.current && wantListenRef.current) startListen();
      }, 250);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
      voiceOff(MIC_FAILED);
    }
  }

  /** Ask for the microphone inside the Speak click, so the browser prompt belongs to that click. */
  async function requestMicrophone(): Promise<string | null> {
    const media = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    // Without getUserMedia (for example an insecure page) recognition asks on its own.
    if (!media?.getUserMedia) return null;
    try {
      const stream = await media.getUserMedia({ audio: true });
      // Only needed for permission; recognition opens its own capture.
      stream.getTracks().forEach((track) => track.stop());
      return null;
    } catch (error) {
      return micProblem(error);
    }
  }

  /** Chrome loads voices late and can drop the first utterance; touching the engine in the click helps. */
  function primeSpeech() {
    if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") return;
    const synth = window.speechSynthesis;
    voicesRef.current = synth.getVoices?.() ?? voicesRef.current;
    if (synth.paused) synth.resume();
  }

  async function armBarge(generation: number, onInterrupt: () => void) {
    if (!navigator.mediaDevices?.getUserMedia) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      return;
    }
    // Level only. This stream is not recorded, uploaded, or transcribed.
    let closed = false;
    let timer = 0;
    let context: AudioContext | null = null;
    const release = () => {
      if (closed) return;
      closed = true;
      window.clearInterval(timer);
      stream.getTracks().forEach((track) => track.stop());
      void context?.close();
    };
    // Register before the meter starts so Stop can close the mic if speech already ended.
    bargeRef.current = release;
    if (speakGen.current !== generation || !speakingRef.current) {
      release();
      return;
    }
    context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const armAt = Date.now() + 400;
    let loudFor = 0;
    timer = window.setInterval(() => {
      if (speakGen.current !== generation) return;
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const value of samples) {
        const centered = (value - 128) / 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / samples.length);
      if (Date.now() < armAt) return;
      loudFor = rms > 0.12 ? loudFor + 50 : 0;
      if (loudFor >= 280) onInterrupt();
    }, 50);
  }

  function pickVoice(locale: "hi-IN" | "en-IN"): SpeechSynthesisVoice | null {
    const voices = voicesRef.current.length ? voicesRef.current : (window.speechSynthesis.getVoices?.() ?? []);
    if (voices.length) voicesRef.current = voices;
    const exact = locale.toLowerCase();
    const prefix = locale === "hi-IN" ? "hi" : "en";
    const normal = (voice: SpeechSynthesisVoice) => voice.lang.toLowerCase().replace("_", "-");
    return voices.find((voice) => normal(voice) === exact) ?? voices.find((voice) => normal(voice).startsWith(prefix)) ?? null;
  }

  function speak(text: string): Promise<void> {
    const generation = speakGen.current + 1;
    speakGen.current = generation;
    return new Promise((resolve) => {
      if (typeof window.speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined" || !text.trim()) {
        resolve();
        return;
      }
      const synth = window.speechSynthesis;
      const hadQueue = synth.speaking || synth.pending;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/\s+/g, " ").slice(0, 600));
      const locale = localeFor(text);
      localeRef.current = locale;
      utterance.lang = locale;
      const voice = pickVoice(locale);
      if (voice) utterance.voice = voice;
      lastSpokenRef.current = utterance.text;
      // Chrome can skip onend if the utterance is garbage collected mid-speech.
      utteranceRef.current = utterance;
      let settled = false;
      let guard = 0;
      let startTimer = 0;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(guard);
        window.clearTimeout(startTimer);
        if (finishSpeechRef.current === finish) finishSpeechRef.current = null;
        if (utteranceRef.current === utterance) utteranceRef.current = null;
        if (speakGen.current === generation) {
          speakingRef.current = false;
          setSpeaking(false);
          stopBarge();
          ignoreUntilRef.current = Date.now() + 400;
        }
        resolve();
      };
      finishSpeechRef.current = finish;
      utterance.onend = finish;
      utterance.onerror = finish;
      speakingRef.current = true;
      setSpeaking(true);
      void armBarge(generation, () => {
        if (speakGen.current !== generation) return;
        synth.cancel();
        finish();
      });
      // Speaking straight after cancel() drops the utterance in Chrome, so wait a moment.
      const begin = () => {
        if (!settled) synth.speak(utterance);
      };
      if (hadQueue) startTimer = window.setTimeout(begin, 80);
      else begin();
      // Safety net if the engine never reports the end; long replies get longer.
      guard = window.setTimeout(finish, Math.min(90_000, Math.max(10_000, utterance.text.length * 110)));
    });
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    localeRef.current = localeFor(trimmed);
    if (busyRef.current) {
      queuedRef.current = trimmed;
      return;
    }
    busyRef.current = true;
    pauseListen();
    setDraft("");
    const history = [...messagesRef.current, { role: "user" as const, content: trimmed }];
    messagesRef.current = history;
    setMessages(history);
    setWaiting(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          pendingToken: pendingRef.current?.token ?? null,
        }),
      });
      const data = (await response.json()) as TurnResponse;
      if (!response.ok) throw new Error(data.message || "The assistant couldn't answer.");
      const reply = data.reply?.trim() || "I couldn't put that into words. Please ask again.";
      const next = [
        ...history,
        {
          role: "assistant" as const,
          content: reply,
          ...(data.payUrl ? { payUrl: data.payUrl } : {}),
          ...(Array.isArray(data.slots) && data.slots.length ? { slots: data.slots } : {}),
        },
      ];
      messagesRef.current = next;
      setMessages(next);
      setPending(data.pending ?? null);
      pendingRef.current = data.pending ?? null;
      if (voiceOnRef.current) await speak(reply);
    } catch (error) {
      const reply = error instanceof Error ? error.message : "Something went wrong.";
      const next = [...messagesRef.current, { role: "assistant" as const, content: reply }];
      messagesRef.current = next;
      setMessages(next);
    } finally {
      setWaiting(false);
      busyRef.current = false;
      const queued = queuedRef.current;
      queuedRef.current = null;
      if (queued && voiceOnRef.current) void send(queued);
      else if (voiceOnRef.current) startListen();
    }
  }

  async function decide(decision: "confirm" | "reject") {
    const card = pendingRef.current;
    if (!card || busyRef.current) return;
    busyRef.current = true;
    pauseListen();
    setWaiting(true);
    try {
      const response = await fetch("/api/assistant/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: card.token, decision }),
      });
      const data = (await response.json()) as TurnResponse;
      if (!response.ok) throw new Error(data.message || "That confirmation didn't go through.");
      const reply = data.reply?.trim() || "Done.";
      const next = [...messagesRef.current, { role: "assistant" as const, content: reply, ...(data.payUrl ? { payUrl: data.payUrl } : {}) }];
      messagesRef.current = next;
      setMessages(next);
      setPending(null);
      pendingRef.current = null;
      if (voiceOnRef.current) await speak(reply);
    } catch (error) {
      const reply = error instanceof Error ? error.message : "That confirmation didn't go through.";
      const next = [...messagesRef.current, { role: "assistant" as const, content: reply }];
      messagesRef.current = next;
      setMessages(next);
    } finally {
      setWaiting(false);
      busyRef.current = false;
      if (voiceOnRef.current) startListen();
    }
  }

  async function toggleVoice() {
    if (voiceOnRef.current) {
      voiceOff("");
      return;
    }
    if (requestingRef.current) return;
    if (!recognitionCtor()) {
      voiceOff(NO_RECOGNITION);
      return;
    }
    primeSpeech();
    requestingRef.current = true;
    setVoiceNote("Allow the microphone if your browser asks.");
    const problem = await requestMicrophone();
    requestingRef.current = false;
    if (problem) {
      voiceOff(problem);
      return;
    }
    setVoiceNote("");
    restartsRef.current = [];
    voiceOnRef.current = true;
    setVoiceOn(true);
    startListen();
  }

  function interrupt() {
    if (typeof window.speechSynthesis !== "undefined") window.speechSynthesis.cancel();
    finishSpeechRef.current?.();
    speakingRef.current = false;
    setSpeaking(false);
    stopBarge();
    if (voiceOnRef.current && !busyRef.current) startListen();
  }

  const intro =
    user.role === "doctor"
      ? "Ask about today's book, your hours, or a clash. I prepare a cancellation, a move, or a new or changed session, and I wait for you to confirm before anything changes."
      : "Ask about your visits, a doctor, or a free time. I prepare a booking, a move, a cancellation or a payment, and I wait for you to confirm before anything changes.";

  const dockStyle: CSSProperties | undefined =
    isDesktop && size ? { width: size.width, height: size.height, maxHeight: "none" } : undefined;

  return (
    <>
      {open ? null : (
        <button
          ref={launcherRef}
          type="button"
          aria-label="Ask the clinic assistant"
          className="fixed right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 grid size-14 place-items-center rounded-full bg-accent text-white shadow-float hover:bg-accent-hover active:bg-accent-press"
          onClick={openPanel}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H9l-4 3.5V6.5Z" />
          </svg>
        </button>
      )}
      {open ? (
        <dialog
          ref={panelRef}
          open
          aria-labelledby={titleId}
          style={dockStyle}
          data-resizing={resizing ? "true" : undefined}
          className="fixed inset-x-0 bottom-0 z-40 m-0 flex max-h-[min(88dvh,40rem)] w-auto max-w-none flex-col rounded-t-3xl border border-hairline bg-surface p-0 shadow-float pb-[env(safe-area-inset-bottom)] md:inset-auto md:right-5 md:bottom-5 md:w-[26rem] md:rounded-3xl"
        >
          {isDesktop ? (
            <>
              <div
                aria-hidden="true"
                className="absolute inset-x-8 -top-1 z-10 h-2 cursor-ns-resize touch-none"
                onPointerDown={(event) => startResize(event, "y")}
              />
              <div
                aria-hidden="true"
                className="absolute inset-y-8 -left-1 z-10 w-2 cursor-ew-resize touch-none"
                onPointerDown={(event) => startResize(event, "x")}
              />
              <button
                type="button"
                aria-label="Resize assistant panel"
                title="Drag to resize. Arrow keys resize too. Double-click to reset."
                className={`absolute top-1.5 left-1.5 z-20 grid size-6 cursor-nwse-resize touch-none place-items-center rounded-full text-muted hover:bg-fill hover:text-ink focus-visible:bg-fill ${resizing ? "bg-fill text-ink" : ""}`}
                onPointerDown={(event) => startResize(event, "both")}
                onKeyDown={resizeByKey}
                onDoubleClick={resetSize}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M1.5 10.5 10.5 1.5M1.5 6 6 1.5" />
                </svg>
              </button>
            </>
          ) : null}
          <div className={`flex items-start justify-between gap-3 border-b border-hairline px-4 py-3 ${isDesktop ? "pl-9" : ""}`}>
            <div>
              <h2 id={titleId} className="text-callout font-semibold text-ink">Clinic assistant</h2>
              <p className="text-caption text-muted">{user.role === "doctor" ? "Your book" : user.name}</p>
            </div>
            <button type="button" className={buttonClass("plain")} onClick={closePanel}>
              Close
            </button>
          </div>
          {voiceNote ? <p className="px-4 pt-3 text-caption text-warn">{voiceNote}</p> : null}
          <div ref={scrollerRef} className="mt-2 flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
            <p className="text-callout text-ink-2">{intro}</p>
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={message.role === "user" ? "ml-8 rounded-2xl bg-accent-soft px-3 py-2 text-callout text-ink" : "mr-6 text-callout text-ink"}>
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.payUrl ? (
                  <a href={message.payUrl} className={`${buttonClass("primary")} mt-2`}>Pay now</a>
                ) : null}
                {message.slots?.length ? <SlotList slots={message.slots} onPick={() => setOpen(false)} /> : null}
              </div>
            ))}
            {waiting ? <p className="text-callout text-muted">Checking the book…</p> : null}
            {pending ? (
              <div className="rounded-2xl border border-hairline bg-canvas p-3">
                <p className="text-callout font-semibold text-ink">{pending.title}</p>
                <p className="mt-1 text-callout text-ink-2">{pending.summary}</p>
                <p className="mt-1 text-caption text-muted">Nothing changes until you confirm. This offer expires {expiryLabel(pending.expiresAt)}.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={buttonClass("primary")} disabled={waiting} onClick={() => void decide("confirm")}>
                    {pending.confirmLabel}
                  </button>
                  <button type="button" className={buttonClass("secondary")} disabled={waiting} onClick={() => void decide("reject")}>
                    Don't change
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <form
            className="flex items-center gap-2 border-t border-hairline p-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!waiting) void send(interim || draft);
            }}
          >
            <label className="sr-only" htmlFor={`${titleId}-input`}>Message</label>
            <div className="relative h-12 min-w-0 flex-1">
              <textarea
                id={`${titleId}-input`}
                ref={inputRef}
                rows={1}
                value={interim || draft}
                readOnly={Boolean(interim)}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
                  event.preventDefault();
                  if (!waiting) void send(interim || draft);
                }}
                placeholder={listening ? "Listening…" : "Ask about a visit"}
                className="h-12 w-full resize-none rounded-full border border-hairline bg-canvas py-3 pr-12 pl-4 text-callout text-ink outline-none focus:border-accent"
              />
              <button
                type="button"
                aria-label={speaking ? "Stop speaking" : voiceOn ? "Stop voice" : "Speak"}
                aria-pressed={voiceOn}
                onClick={() => (speaking ? interrupt() : void toggleVoice())}
                className={`absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-full ${
                  voiceOn || speaking ? "bg-accent text-white" : "bg-fill text-ink hover:bg-fill-strong"
                }`}
              >
                {speaking ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect width="12" height="12" rx="2" fill="currentColor" /></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
                    <path d="M7 11a5 5 0 0 0 10 0M12 16v3M9 19h6" />
                  </svg>
                )}
              </button>
            </div>
            <button type="submit" className={`${buttonClass("primary")} h-12`} disabled={waiting || !(interim || draft).trim()}>
              Send
            </button>
          </form>
        </dialog>
      ) : null}
    </>
  );
}
