"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactElement } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { PublicUser } from "@/lib/clinic-types";
import { isEcho } from "@/lib/assistant/echo";
import {
  AUTO_LANGUAGE,
  DEFAULT_LANGUAGE,
  LANGUAGE_CHOICES,
  detectLanguage,
  lockedLanguage,
  nextListenLocale,
  pickVoiceFor,
  supportedLocale,
} from "@/lib/assistant/language";
import type { DetectedLanguage } from "@/lib/assistant/language";
import type { SlotLink } from "@/lib/assistant/slot-links";
import { addDays, todayIso } from "@/lib/clock";
import { formatShortDate } from "@/lib/format";
import { buttonClass } from "@/components/ui/button-styles";
import GlideSelect from "./GlideSelect";
import type { GlideSelectOption } from "./GlideSelect";
import ThoughtLine from "./ThoughtLine";
import HoldButton from "./HoldButton";
import VoicePill from "./VoicePill";
import type { VoicePillSource, VoicePillStopReason } from "./VoicePill";
import "./AssistantVoicePill.css";
import "./AssistantDock.css";

/** Copied from MorphSurface: the launcher box springs in width, height, and radius. */
const SURFACE_SPRING = { type: "spring" as const, stiffness: 550, damping: 45, mass: 0.7 } as const;
const LAUNCHER_SIZE = 56;

/** Past tense shown for a moment after a hold confirms the card. */
function heldDone(confirmLabel: string): string {
  if (confirmLabel === "Add session") return "Added";
  if (confirmLabel === "Change session") return "Changed";
  if (confirmLabel === "Cancel visit") return "Cancelled";
  if (confirmLabel === "Book") return "Booked";
  if (confirmLabel === "Move") return "Moved";
  return "Done";
}

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
  /** The request this reply answered, so its thinking line keeps its place above it. */
  turn?: number;
  /** Seconds the assistant took, frozen into "Thought for Xs". */
  thoughtFor?: number;
}

/** A 16px label stays readable above a reply. */
const THOUGHT_FONT_SIZE = 16;
/**
 * Theme ink with no comma. ThoughtLine's shimmer is a color-mix() gradient, and a
 * fallback comma inside this variable breaks that gradient and hides the words.
 */
const THOUGHT_INK = "var(--color-ink)";

/** Suggestion chips shown before the first message, by role. Each one is a real assistant task. */
export const QUICK_PROMPTS = {
  doctor: ["What's on my schedule today?", "Add a consulting session", "How many places are left today?"],
  patient: ["Book a visit", "Show my appointments", "What times are free tomorrow?"],
} as const;

function secondsSince(startedAt: number): number {
  return Math.round((performance.now() - startedAt) / 100) / 10;
}

/**
 * The React Bits thinking line. The sparkle and the label breathe while a reply is on
 * its way, then the line settles into "Thought for Xs" above that reply.
 * There are no steps: the API does not stream them.
 */
function ThoughtRow({ working, elapsed }: { working: boolean; elapsed?: number }) {
  return (
    <div className="text-callout font-semibold text-ink">
      <ThoughtLine
        className="clinic-thought-line"
        working={working}
        elapsed={elapsed}
        label="Checking…"
        doneLabel="Thought for"
        glyph="sparkle"
        fontSize={THOUGHT_FONT_SIZE}
        color={THOUGHT_INK}
        breathPeriod={1.6}
        breathDepth={0.45}
        shimmer
        shimmerDuration={1.8}
        settleDuration={350}
        settleBlur={2}
        collapsible
        collapseOnSettle
        showTimer
      />
    </div>
  );
}

interface TurnResponse {
  reply?: string;
  pending?: PendingCard | null;
  payUrl?: string;
  slots?: SlotLink[];
  /** BCP 47 locale the reply is written in, e.g. "te-IN". */
  locale?: string;
  message?: string;
}

/** The voice pill matches the old 32px mic button so it fits the 48px message box. */
const PILL_SIZE = 32;

/**
 * A real microphone waveform needs a second capture beside speech recognition. Desktop
 * browsers share the microphone fine; phones can refuse recognition while another stream is
 * open, so touch screens and browsers without recognition get the simulated waveform.
 */
function pillSource(): VoicePillSource {
  if (typeof window === "undefined") return "simulated";
  const canAnalyse = typeof window.AudioContext !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
  const finePointer = typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches;
  return canAnalyse && finePointer && recognitionCtor() ? "mic" : "simulated";
}

/** The last language the user spoke or wrote in, so the next visit listens in it. */
export const LOCALE_KEY = "clinic-assistant-locale";

/** Previous assistant conversations on this browser, newest first. */
export const CHATS_KEY = "clinic-assistant-chats";
const CHAT_LIMIT = 20;

interface StoredChat {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as ChatMessage;
  return (message.role === "user" || message.role === "assistant") && typeof message.content === "string";
}

function readChats(): StoredChat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(CHATS_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    const chats: StoredChat[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const chat = item as StoredChat;
      if (typeof chat.id !== "string" || typeof chat.title !== "string" || typeof chat.updatedAt !== "number") continue;
      if (!Array.isArray(chat.messages) || !chat.messages.every(isChatMessage)) continue;
      chats.push({ id: chat.id, title: chat.title, updatedAt: chat.updatedAt, messages: chat.messages });
    }
    return chats.slice(0, CHAT_LIMIT);
  } catch {
    return [];
  }
}

function writeChats(chats: StoredChat[]) {
  try {
    window.localStorage.setItem(CHATS_KEY, JSON.stringify(chats.slice(0, CHAT_LIMIT)));
  } catch {
    // Private mode or full storage: history just won't be kept.
  }
}

function newChatId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `chat-${Date.now()}`;
}

function chatTitle(messages: ChatMessage[]): string {
  const first = messages.find((message) => message.role === "user")?.content.trim() || "Chat";
  return first.length > 80 ? `${first.slice(0, 79)}…` : first;
}

function chatStamp(updatedAt: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(updatedAt);
}

/**
 * The language picked in the dock's menu: "auto" (detect each message) or a language tag such
 * as "te". A picked language is kept until the user picks Auto or another one.
 */
export const LANGUAGE_KEY = "clinic-assistant-language";

/** The language menu's rows: Auto first, then each language in its own script. */
export const LANGUAGE_OPTIONS: GlideSelectOption[] = [
  { value: AUTO_LANGUAGE, label: "Auto", tag: "Detect" },
  ...LANGUAGE_CHOICES.map((choice) => ({
    value: choice.tag,
    label: choice.native,
    ...(choice.native !== choice.english ? { tag: choice.english } : {}),
  })),
];

/** The saved menu choice, or Auto. */
function initialChoice(): string {
  if (typeof window === "undefined") return AUTO_LANGUAGE;
  try {
    const locked = lockedLanguage(window.localStorage.getItem(LANGUAGE_KEY));
    return locked ? locked.tag : AUTO_LANGUAGE;
  } catch {
    return AUTO_LANGUAGE;
  }
}

/** Saved locale, else the browser's language if we know it, else Indian English. */
function initialLocale(): string {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE.locale;
  try {
    const saved = supportedLocale(window.localStorage.getItem(LOCALE_KEY));
    if (saved) return saved;
  } catch {
    // Storage blocked: fall through to the browser language.
  }
  const browser = typeof navigator !== "undefined" ? supportedLocale(navigator.language) : null;
  // A browser set to en-US still gets the Indian English voice the clinic uses.
  return browser && !browser.startsWith("en") ? browser : DEFAULT_LANGUAGE.locale;
}

function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
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
  // Natural panel height, so the morph ends on the real chat instead of a fixed box.
  const [fitHeight, setFitHeight] = useState<number | null>(null);
  // On a phone the floating launcher sits over the page's right edge (toggles, Submit buttons).
  // It tucks away while the page scrolls down and comes back on the way up or at the very bottom.
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const narrow = window.innerWidth < 768;
      const atBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 4;
      if (!narrow || atBottom || y < 24) setTucked(false);
      else if (y > last + 6) setTucked(true);
      else if (y < last - 6) setTucked(false);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<PendingCard | null>(null);
  const [draft, setDraft] = useState("");
  const [interim, setInterim] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [liveTurn, setLiveTurn] = useState<number | null>(null);
  const [voiceOn, setVoiceOn] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceNote, setVoiceNote] = useState("");
  const [isDesktop, setIsDesktop] = useState(false);
  const [size, setSize] = useState<DockSize | null>(null);
  const [resizing, setResizing] = useState(false);
  // The voice pill keeps its own listening state. A new key resets it when voice stops elsewhere.
  const [pillKey, setPillKey] = useState(0);
  const [pillOpen, setPillOpen] = useState(false);
  const [pillWave, setPillWave] = useState<VoicePillSource>("simulated");
  const [languageChoice, setLanguageChoice] = useState<string>(AUTO_LANGUAGE);
  const [chats, setChats] = useState<StoredChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

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
  const localeRef = useRef<string>(DEFAULT_LANGUAGE.locale);
  /** The language locked in the menu, or null while Auto detects each message. */
  const lockedRef = useRef<DetectedLanguage | null>(null);
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
  const turnSeqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const pillOnRef = useRef(false);
  const pillDeniedRef = useRef(false);
  const chatIdRef = useRef<string | null>(null);
  const historyOpenRef = useRef(false);

  useEffect(() => {
    const choice = initialChoice();
    const locked = lockedLanguage(choice);
    lockedRef.current = locked;
    setLanguageChoice(choice);
    localeRef.current = locked ? locked.locale : initialLocale();
  }, []);
  useEffect(() => { pendingRef.current = pending; }, [pending]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);
  useEffect(() => { historyOpenRef.current = historyOpen; }, [historyOpen]);
  useEffect(() => { setChats(readChats()); }, []);
  useEffect(() => {
    if (messages.length === 0) return;
    const id = chatIdRef.current ?? newChatId();
    chatIdRef.current = id;
    setActiveChatId(id);
    const next: StoredChat = { id, title: chatTitle(messages), updatedAt: Date.now(), messages };
    setChats((current) => {
      const saved = [next, ...current.filter((chat) => chat.id !== id)].slice(0, CHAT_LIMIT);
      writeChats(saved);
      return saved;
    });
  }, [messages]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages, pending, waiting, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (historyOpenRef.current) {
        setHistoryOpen(false);
        return;
      }
      closePanel();
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
    setPillWave(pillSource());
    setFitHeight(null);
    setOpen(true);
  }

  function abortInFlight() {
    const controller = abortRef.current;
    if (controller) {
      abortRef.current = null;
      controller.abort();
    }
    setWaiting(false);
    setLiveTurn(null);
    busyRef.current = false;
    queuedRef.current = null;
  }

  function cancelRequest() {
    abortInFlight();
    if (voiceOnRef.current) startListen();
  }

  function closePanel() {
    abortInFlight();
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
    releasePill();
  }

  /** Put the voice pill back to rest when voice stopped somewhere other than the pill. */
  function releasePill() {
    setPillOpen(false);
    if (!pillOnRef.current) return;
    pillOnRef.current = false;
    setPillKey((key) => key + 1);
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
      // A language picked in the menu is honoured; Auto follows what was just said.
      if (!lockedRef.current) setLocale(detectLanguage(heard, localeRef.current).locale);
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

  /** Remember the language to listen in next, here and for later visits. */
  function setLocale(locale: string) {
    localeRef.current = locale;
    try {
      window.localStorage.setItem(LOCALE_KEY, locale);
    } catch {
      // Private mode or full storage: the language just won't be remembered.
    }
  }

  /** The language menu changed: lock that language (or go back to Auto) and listen in it now. */
  function chooseLanguage(choice: string) {
    const locked = lockedLanguage(choice);
    const next = locked ? locked.tag : AUTO_LANGUAGE;
    lockedRef.current = locked;
    setLanguageChoice(next);
    try {
      window.localStorage.setItem(LANGUAGE_KEY, next);
    } catch {
      // Private mode or full storage: the pick lasts for this visit only.
    }
    if (locked) setLocale(locked.locale);
    // Recognition keeps the language it started with, so restart a running one in the new one.
    if (voiceOnRef.current && recRef.current) {
      pauseListen();
      startListen();
    }
  }

  function pickVoice(locale: string): SpeechSynthesisVoice | null {
    const voices = voicesRef.current.length ? voicesRef.current : (window.speechSynthesis.getVoices?.() ?? []);
    if (voices.length) voicesRef.current = voices;
    return pickVoiceFor(voices, locale);
  }

  function speak(text: string, locale?: string): Promise<void> {
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
      const lang = locale || detectLanguage(text, localeRef.current).locale;
      // Without a voice for this language the browser default still gets the right lang.
      utterance.lang = lang;
      const voice = pickVoice(lang);
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
    const locked = lockedRef.current;
    const userLocale = locked ? locked.locale : detectLanguage(trimmed, localeRef.current).locale;
    setLocale(userLocale);
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
    const turn = ++turnSeqRef.current;
    const startedAt = performance.now();
    const controller = new AbortController();
    abortRef.current = controller;
    setLiveTurn(turn);
    setWaiting(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          pendingToken: pendingRef.current?.token ?? null,
          language: lockedRef.current?.tag ?? AUTO_LANGUAGE,
        }),
      });
      if (controller.signal.aborted || abortRef.current !== controller) return;
      const data = (await response.json()) as TurnResponse;
      if (controller.signal.aborted || abortRef.current !== controller) return;
      if (!response.ok) throw new Error(data.message || "The assistant couldn't answer.");
      const reply = data.reply?.trim() || "I couldn't put that into words. Please ask again.";
      const next = [
        ...history,
        {
          role: "assistant" as const,
          content: reply,
          turn,
          thoughtFor: secondsSince(startedAt),
          ...(data.payUrl ? { payUrl: data.payUrl } : {}),
          ...(Array.isArray(data.slots) && data.slots.length ? { slots: data.slots } : {}),
        },
      ];
      messagesRef.current = next;
      setMessages(next);
      setPending(data.pending ?? null);
      pendingRef.current = data.pending ?? null;
      const lockedNow = lockedRef.current;
      const spoken = lockedNow ? lockedNow.locale : (supportedLocale(data.locale) ?? detectLanguage(reply, userLocale).locale);
      setLocale(lockedNow ? lockedNow.locale : nextListenLocale(userLocale, spoken));
      if (voiceOnRef.current) await speak(reply, spoken);
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error) || abortRef.current !== controller) return;
      const reply = error instanceof Error ? error.message : "Something went wrong.";
      const next = [...messagesRef.current, { role: "assistant" as const, content: reply, turn, thoughtFor: secondsSince(startedAt) }];
      messagesRef.current = next;
      setMessages(next);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setWaiting(false);
        busyRef.current = false;
        const queued = queuedRef.current;
        queuedRef.current = null;
        if (queued && voiceOnRef.current) void send(queued);
        else if (voiceOnRef.current) startListen();
      }
    }
  }

  async function decide(decision: "confirm" | "reject") {
    const card = pendingRef.current;
    if (!card || busyRef.current) return;
    busyRef.current = true;
    pauseListen();
    const turn = ++turnSeqRef.current;
    const startedAt = performance.now();
    const controller = new AbortController();
    abortRef.current = controller;
    setLiveTurn(turn);
    setWaiting(true);
    try {
      const response = await fetch("/api/assistant/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ token: card.token, decision }),
      });
      if (controller.signal.aborted || abortRef.current !== controller) return;
      const data = (await response.json()) as TurnResponse;
      if (controller.signal.aborted || abortRef.current !== controller) return;
      if (!response.ok) throw new Error(data.message || "That confirmation didn't go through.");
      const reply = data.reply?.trim() || "Done.";
      const next = [...messagesRef.current, { role: "assistant" as const, content: reply, turn, thoughtFor: secondsSince(startedAt), ...(data.payUrl ? { payUrl: data.payUrl } : {}) }];
      messagesRef.current = next;
      setMessages(next);
      setPending(null);
      pendingRef.current = null;
      const lockedNow = lockedRef.current;
      const spoken = lockedNow ? lockedNow.locale : (supportedLocale(data.locale) ?? detectLanguage(reply, localeRef.current).locale);
      setLocale(lockedNow ? lockedNow.locale : nextListenLocale(localeRef.current, spoken));
      if (voiceOnRef.current) await speak(reply, spoken);
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error) || abortRef.current !== controller) return;
      const reply = error instanceof Error ? error.message : "That confirmation didn't go through.";
      const next = [...messagesRef.current, { role: "assistant" as const, content: reply, turn, thoughtFor: secondsSince(startedAt) }];
      messagesRef.current = next;
      setMessages(next);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setWaiting(false);
        busyRef.current = false;
        if (voiceOnRef.current) startListen();
      }
    }
  }

  /** The pill was pressed: ask for the microphone inside that press, then start listening. */
  async function startVoice() {
    if (voiceOnRef.current || requestingRef.current) return;
    if (!recognitionCtor()) {
      voiceOff(NO_RECOGNITION);
      return;
    }
    primeSpeech();
    requestingRef.current = true;
    pillDeniedRef.current = false;
    setVoiceNote("Allow the microphone if your browser asks.");
    let problem = await requestMicrophone();
    requestingRef.current = false;
    if (!problem && pillDeniedRef.current) problem = MIC_FAILED;
    pillDeniedRef.current = false;
    if (problem) {
      voiceOff(problem);
      return;
    }
    // Stopped or slid to cancel while the browser was asking.
    if (!pillOnRef.current) return;
    setVoiceNote("");
    restartsRef.current = [];
    voiceOnRef.current = true;
    setVoiceOn(true);
    startListen();
  }

  function onPillStart() {
    pillOnRef.current = true;
    setPillOpen(true);
    void startVoice();
  }

  function onPillStop({ reason }: { reason: VoicePillStopReason }) {
    // Voice already stopped elsewhere and reset the pill; this is that old pill unmounting.
    if (!pillOnRef.current) return;
    pillOnRef.current = false;
    setPillOpen(false);
    if (reason === "mic-denied") {
      if (requestingRef.current) {
        // The Speak permission request is still open and will explain what went wrong.
        pillDeniedRef.current = true;
        return;
      }
      void requestMicrophone().then((problem) => voiceOff(problem ?? MIC_FAILED));
      return;
    }
    // Every stop turns voice off. pauseListen drops unfinished words, so a slide to cancel
    // (or any other stop) never sends what was half heard.
    voiceOff("");
  }

  function interrupt() {
    if (typeof window.speechSynthesis !== "undefined") window.speechSynthesis.cancel();
    finishSpeechRef.current?.();
    speakingRef.current = false;
    setSpeaking(false);
    stopBarge();
    if (voiceOnRef.current && !busyRef.current) startListen();
  }

  function showChat(nextId: string | null, nextMessages: ChatMessage[]) {
    abortInFlight();
    voiceOff("");
    chatIdRef.current = nextId;
    setActiveChatId(nextId);
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    setPending(null);
    pendingRef.current = null;
    setDraft("");
    setInterim("");
    setHistoryOpen(false);
  }

  const intro =
    user.role === "doctor"
      ? "Ask about today's book, your hours, or a clash. I prepare a cancellation, a move, or a new or changed session, and I wait for you to confirm before anything changes."
      : "Ask about your visits, a doctor, or a free time. I prepare a booking, a move, a cancellation or a payment, and I wait for you to confirm before anything changes.";

  // Quick prompts for an empty conversation. A tap sends the prompt, just like typing it.
  const quickPrompts = QUICK_PROMPTS[user.role === "doctor" ? "doctor" : "patient"];
  const showQuickPrompts = messages.length === 0 && !waiting && !pending;

  const dockStyle: CSSProperties | undefined =
    isDesktop && size ? { width: size.width, height: size.height, maxHeight: "none" } : undefined;
  const historyId = `${titleId}-history`;
  const heightCap = typeof window === "undefined" ? 640 : Math.min(window.innerHeight * 0.88, 640);
  const targetWidth = !isDesktop
    ? (typeof window === "undefined" ? 360 : window.innerWidth)
    : (size?.width ?? 416);
  const targetHeight = size?.height ?? fitHeight;
  const grown = open && targetHeight != null;
  const surfaceWidth = grown ? targetWidth : LAUNCHER_SIZE;
  const surfaceHeight = grown ? Math.min(heightCap, targetHeight) : LAUNCHER_SIZE;

  useLayoutEffect(() => {
    if (!open || size?.height) return;
    const node = panelRef.current;
    if (!node) return;
    const next = Math.min(heightCap, Math.ceil(node.scrollHeight));
    if (next > 0) setFitHeight((current) => (current === next ? current : next));
  }, [open, size, messages, pending, waiting, voiceNote, isDesktop, heightCap]);

  return (
    <motion.div
      className={`fixed z-40 overflow-hidden border border-hairline bg-surface text-ink ${
        open ? "shadow-float" : "shadow-raised"
      } ${tucked && !open ? "pointer-events-none translate-y-24 opacity-0" : ""}`}
      style={{
        right: open && !isDesktop ? 0 : "1.25rem",
        bottom: open && !isDesktop ? 0 : "max(1.25rem, env(safe-area-inset-bottom))",
      }}
      initial={false}
      animate={{
        width: surfaceWidth,
        height: surfaceHeight,
        borderRadius: grown ? 16 : 28,
      }}
      transition={
        resizing || (open && !grown)
          ? { duration: 0 }
          : { ...SURFACE_SPRING, delay: open ? 0 : 0.08 }
      }
    >
      {open ? null : (
        <button
          ref={launcherRef}
          type="button"
          aria-label="Full chat"
          title="Full chat"
          onClick={openPanel}
          className="grid size-full place-items-center rounded-full text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H9l-4 3.5V6.5Z" />
          </svg>
        </button>
      )}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="full-chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SURFACE_SPRING}
            className="absolute right-0 bottom-0"
            style={{ width: targetWidth, height: targetHeight ?? "auto" }}
          >
        <dialog
          ref={panelRef}
          open
          aria-labelledby={titleId}
          style={dockStyle}
          data-resizing={resizing ? "true" : undefined}
          className={`clinic-dock relative m-0 flex min-h-0 w-full max-w-none flex-col overflow-hidden bg-surface p-0 text-ink pb-[env(safe-area-inset-bottom)] ${
            targetHeight != null && targetHeight >= heightCap ? "h-full" : "h-auto"
          }`}
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
          <div className={`relative z-[5] flex flex-shrink-0 items-center justify-between gap-3 border-b border-hairline bg-surface px-4 py-3 ${isDesktop ? "pl-9" : ""}`}>
            <div className="flex min-w-0 items-center gap-2">
              <h2 id={titleId} className="sr-only">Clinic assistant</h2>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-full text-ink hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                aria-label="History"
                aria-expanded={historyOpen}
                aria-controls={historyId}
                onClick={() => setHistoryOpen((value) => !value)}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                  <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
                </svg>
              </button>
              {user.role === "doctor" ? null : <p className="truncate text-caption text-muted">{user.name}</p>}
            </div>
            <div className="flex flex-shrink-0 items-center gap-1.5">
              {/*
                React Bits GlideSelect. The header is at the top of the dock, so the menu opens down
                into the conversation where the panel never clips it. The header's z-[5] keeps the
                menu above the messages and below the resize handles (z-10 and z-20).
              */}
              <GlideSelect
                className="clinic-language-select"
                options={LANGUAGE_OPTIONS}
                value={languageChoice}
                onChange={(value) => chooseLanguage(value)}
                ariaLabel="Language"
                showTags
                accentColor="var(--color-accent)"
                surfaceColor="var(--color-fill)"
                highlightColor="var(--color-fill-strong)"
                textColor="var(--color-ink)"
                size="sm"
                radius={12}
                menuWidth={196}
                placement="bottom"
                align="right"
                popDuration={180}
                glideDuration={220}
                rememberPosition
              />
              <button
                type="button"
                aria-label="Close"
                onClick={closePanel}
                className="grid size-8 place-items-center rounded-full border border-hairline text-ink hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                  <path d="M3 3l8 8M11 3 3 11" />
                </svg>
              </button>
            </div>
          </div>
          <AnimatePresence>
            {historyOpen ? (
              <div className="absolute inset-0 z-30">
                <motion.button
                  type="button"
                  aria-label="Close history"
                  className="absolute inset-0 bg-black/45"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.05, 0.7, 0.1, 1] }}
                  onClick={() => setHistoryOpen(false)}
                />
                <motion.div
                  id={historyId}
                  role="region"
                  aria-label="Previous chats"
                  className="absolute inset-y-0 left-0 flex h-full w-64 max-w-[78%] flex-col bg-surface shadow-float"
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ duration: 0.28, ease: [0.05, 0.7, 0.1, 1] }}
                >
                  <p className="px-4 pt-4 pb-2 text-[15px] font-medium text-ink">Previous chats</p>
                  {chats.length === 0 ? (
                    <p className="px-4 py-3 text-caption text-muted">No previous chats yet.</p>
                  ) : (
                    <ul className="min-h-0 flex-1 overflow-y-auto py-1">
                      {chats.map((chat) => (
                        <li key={chat.id}>
                          <button
                            type="button"
                            className={`flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left hover:bg-fill ${chat.id === activeChatId ? "bg-fill" : ""}`}
                            onClick={() => showChat(chat.id, chat.messages)}
                          >
                            <span className="w-full truncate text-[15px] text-ink">{chat.title}</span>
                            <span className="text-[12px] text-muted">{chatStamp(chat.updatedAt)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              </div>
            ) : null}
          </AnimatePresence>
          {voiceNote ? <p className="flex-shrink-0 px-4 pt-3 text-caption text-warn">{voiceNote}</p> : null}
          <div
            ref={scrollerRef}
            className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] px-4 py-3"
            aria-live="polite"
          >
            <p className="text-callout text-ink-2">{intro}</p>
            {showQuickPrompts ? (
              <ul className="clinic-quick-prompts flex flex-wrap gap-2 pt-1" aria-label="Suggested questions">
                {quickPrompts.map((prompt) => (
                  <li key={prompt}>
                    <button
                      type="button"
                      className="clinic-quick-prompt rounded-full border border-hairline bg-fill px-3 py-1.5 text-left text-caption font-medium text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      onClick={() => void send(prompt)}
                    >
                      {prompt}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {/* One flat keyed list, so a turn's working line is the same element that settles above its reply. */}
            {[
              ...messages.flatMap((message, index) => {
                const rows: ReactElement[] = [];
                if (message.role === "assistant" && message.turn != null && message.thoughtFor != null) {
                  rows.push(<ThoughtRow key={`thought-${message.turn}`} working={false} elapsed={message.thoughtFor} />);
                }
                rows.push(
                  <div key={`${message.role}-${index}`} className={message.role === "user" ? "ml-8 rounded-2xl bg-ink px-3.5 py-2.5 text-callout text-canvas" : "mr-6 text-callout text-ink"}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.payUrl ? (
                      <a href={message.payUrl} className={`${buttonClass("primary")} mt-2`}>Pay now</a>
                    ) : null}
                    {message.slots?.length ? <SlotList slots={message.slots} onPick={() => setOpen(false)} /> : null}
                  </div>,
                );
                return rows;
              }),
              ...(waiting && liveTurn != null && !messages.some((message) => message.turn === liveTurn)
                ? [<ThoughtRow key={`thought-${liveTurn}`} working />]
                : []),
            ]}
            {pending ? (
              <div className="rounded-2xl border border-hairline bg-surface-2 p-3.5 shadow-card">
                <p className="text-callout font-semibold text-ink">{pending.title}</p>
                <p className="mt-1 text-callout text-ink-2">{pending.summary}</p>
                <p className="mt-1 text-caption text-muted">Nothing changes until you confirm. This offer expires {expiryLabel(pending.expiresAt)}.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <HoldButton
                    doneLabel={heldDone(pending.confirmLabel)}
                    backgroundColor="#27272a"
                    fillColor="#5227FF"
                    textColor="#f5f5f5"
                    fillTextColor="#ffffff"
                    size="md"
                    radius={14}
                    fillDirection="right"
                    holdTime={2000}
                    releaseTime={200}
                    pressScale={0.97}
                    wave
                    waveAmplitude={6}
                    glow
                    resetAfter={1200}
                    disabled={waiting}
                    onHold={() => void decide("confirm")}
                  >
                    {`Hold to ${pending.confirmLabel.charAt(0).toLowerCase()}${pending.confirmLabel.slice(1)}`}
                  </HoldButton>
                  <button type="button" className={buttonClass("secondary")} disabled={waiting} onClick={() => void decide("reject")}>
                    Don't change
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <form
            className="flex flex-shrink-0 items-center gap-2 overflow-visible border-t border-hairline p-3"
            onSubmit={(event) => {
              event.preventDefault();
              // A leftover Enter in the box does not submit the form (see onKeyDown), so this
              // path is the Send/Cancel button. While a reply is on its way, treat it as Cancel.
              if (waiting) cancelRequest();
              else void send(interim || draft);
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
                  // Enter does nothing while a request is in flight, so a leftover Enter cannot cancel it.
                  if (!waiting) void send(interim || draft);
                }}
                placeholder={listening ? "Listening…" : "Ask about a visit"}
                className={`h-12 w-full resize-none rounded-full border border-hairline bg-canvas py-3 pl-4 text-callout text-ink outline-none focus:border-accent ${
                  pillOpen || voiceOn ? "pr-[9.75rem]" : "pr-12"
                }`}
              />
              <span className="absolute top-1/2 right-1.5 flex -translate-y-1/2">
                <VoicePill
                  key={pillKey}
                  className="clinic-voice-pill"
                  ariaLabel={voiceOn ? "Stop voice" : "Speak"}
                  background="#ececf0"
                  iconColor="#1d1d1f"
                  accentColor="#ffffff"
                  size={PILL_SIZE}
                  shape="pill"
                  reach={8}
                  showTime
                  waveform
                  slideToCancel
                  cancelDistance={64}
                  mode="auto"
                  holdAfter={300}
                  reactive={pillWave}
                  onStart={onPillStart}
                  onStop={onPillStop}
                />
                {speaking ? (
                  // While a reply is read aloud, a press stops the reading and listens again.
                  <button
                    type="button"
                    aria-label="Stop speaking"
                    className="absolute inset-0 z-10 rounded-full"
                    onClick={interrupt}
                  />
                ) : null}
              </span>
            </div>
            {waiting ? (
              <button type="button" className={`${buttonClass("secondary")} h-12`} aria-label="Cancel request" onClick={cancelRequest}>
                Cancel
              </button>
            ) : (
              <button type="submit" className={`${buttonClass("primary")} h-12`} disabled={!(interim || draft).trim()}>
                Send
              </button>
            )}
          </form>
        </dialog>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
