"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PublicUser } from "@/lib/clinic-types";
import { isEcho } from "@/lib/assistant/echo";
import { Magnet } from "@/components/reactbits/Magnet";
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
}

interface TurnResponse {
  reply?: string;
  pending?: PendingCard | null;
  payUrl?: string;
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

interface SpeechRec {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
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

/**
 * Text and voice clinic assistant. Speech recognition is paused while the reply is spoken,
 * so the microphone does not transcribe the assistant. A separate level meter can interrupt
 * speech; that audio is never sent anywhere.
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
      if (event.key === "Escape") {
        setOpen(false);
        launcherRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function stopBarge() {
    bargeRef.current?.();
    bargeRef.current = null;
  }

  function pauseListen() {
    wantListenRef.current = false;
    recRef.current?.abort();
    recRef.current = null;
    setListening(false);
    setInterim("");
  }

  function startListen() {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setVoiceNote("This browser has no speech recognition. You can type instead.");
      setVoiceOn(false);
      voiceOnRef.current = false;
      return;
    }
    wantListenRef.current = true;
    if (speakingRef.current || recRef.current) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = localeRef.current;
    rec.onresult = (event) => {
      if (!wantListenRef.current || speakingRef.current) return;
      let finalText = "";
      let partial = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i]?.[0]?.transcript ?? "";
        if (event.results[i]?.isFinal) finalText += piece;
        else partial += piece;
      }
      setInterim(partial);
      const heard = finalText.trim();
      if (!heard) return;
      localeRef.current = localeFor(heard);
      if (Date.now() < ignoreUntilRef.current || isEcho(heard, lastSpokenRef.current)) return;
      setInterim("");
      void send(heard);
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed") setVoiceNote("The microphone is blocked in the browser settings.");
      if (event.error === "aborted" || event.error === "no-speech") return;
    };
    rec.onend = () => {
      if (recRef.current !== rec) return;
      recRef.current = null;
      setListening(false);
      if (wantListenRef.current && !speakingRef.current && voiceOnRef.current) startListen();
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
      setVoiceNote("");
    } catch {
      recRef.current = null;
      setVoiceNote("The microphone didn't start. Try again.");
    }
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

  function speak(text: string): Promise<void> {
    const generation = speakGen.current + 1;
    speakGen.current = generation;
    return new Promise((resolve) => {
      if (typeof speechSynthesis === "undefined" || !text.trim()) {
        resolve();
        return;
      }
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/\s+/g, " ").slice(0, 600));
      const locale = localeFor(text);
      localeRef.current = locale;
      utterance.lang = locale;
      const voices = speechSynthesis.getVoices();
      const prefix = locale === "hi-IN" ? "hi" : "en";
      utterance.voice = voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix)) ?? null;
      lastSpokenRef.current = utterance.text;
      let settled = false;
      const finish = () => {
        if (settled || speakGen.current !== generation) return;
        settled = true;
        speakingRef.current = false;
        setSpeaking(false);
        stopBarge();
        ignoreUntilRef.current = Date.now() + 400;
        resolve();
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      speakingRef.current = true;
      setSpeaking(true);
      void armBarge(generation, () => {
        if (speakGen.current !== generation) return;
        speechSynthesis.cancel();
        finish();
      });
      speechSynthesis.speak(utterance);
      window.setTimeout(finish, 30_000);
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
      const next = [...history, { role: "assistant" as const, content: reply, ...(data.payUrl ? { payUrl: data.payUrl } : {}) }];
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

  function toggleVoice() {
    if (voiceOnRef.current) {
      voiceOnRef.current = false;
      setVoiceOn(false);
      pauseListen();
      speakingRef.current = false;
      setSpeaking(false);
      stopBarge();
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
      return;
    }
    voiceOnRef.current = true;
    setVoiceOn(true);
    startListen();
  }

  function interrupt() {
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    speakingRef.current = false;
    setSpeaking(false);
    stopBarge();
    if (voiceOnRef.current && !busyRef.current) startListen();
  }

  const intro =
    user.role === "doctor"
      ? "Ask about today's book, your hours, or a clash. I prepare a cancellation or a move, and I wait for you to confirm before anything changes."
      : "Ask about your visits, a doctor, or a free time. I prepare a booking, a move, a cancellation or a payment, and I wait for you to confirm before anything changes.";
  const suggestions =
    user.role === "doctor"
      ? ["What is on today's book?", "Show my hours this week", "Check for any clashes"]
      : ["Show my upcoming visits", "Find a free time", "List available doctors"];

  return (
    <>
      {open ? null : (
        <Magnet
          padding={24}
          magnetStrength={2}
          maxOffset={5}
          wrapperClassName="fixed right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40"
          style={{ position: "fixed" }}
        >
          <button
            ref={launcherRef}
            type="button"
            aria-label="Ask the clinic assistant"
            className="grid size-14 place-items-center rounded-full bg-ink text-canvas shadow-raised transition-all hover:opacity-90 active:scale-95"
            onClick={() => setOpen(true)}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H9l-4 3.5V6.5Z" />
            </svg>
          </button>
        </Magnet>
      )}
      {open ? (
        <dialog
          ref={panelRef}
          open
          aria-labelledby={titleId}
          className="fixed inset-x-0 bottom-0 z-40 m-0 flex max-h-[min(88dvh,40rem)] w-auto max-w-none flex-col overflow-hidden rounded-t-3xl border border-hairline bg-surface p-0 text-ink shadow-float pb-[env(safe-area-inset-bottom)] md:inset-auto md:right-5 md:bottom-5 md:w-[26rem] md:rounded-3xl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-hairline bg-surface px-4 py-3">
            <div>
              <h2 id={titleId} className="text-callout font-semibold text-ink">Clinic assistant</h2>
              <p className="text-caption text-muted">{user.role === "doctor" ? "Your book" : user.name}</p>
            </div>
            <button type="button" className={buttonClass("plain")} onClick={() => { setOpen(false); launcherRef.current?.focus(); }}>
              Close
            </button>
          </div>
          {voiceNote ? <p className="px-4 pt-3 text-caption text-warn">{voiceNote}</p> : null}
          <div ref={scrollerRef} className="mt-2 flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
            <p className="text-callout text-ink-2">{intro}</p>
            {messages.length === 0 && !waiting && !pending ? (
              <fieldset className="flex flex-wrap gap-2 border-0 p-0 pt-1">
                <legend className="sr-only">Suggested questions</legend>
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="rounded-full border border-hairline bg-surface-2 px-3 py-1.5 text-left text-caption font-medium text-ink-2 transition-colors hover:border-control hover:bg-fill hover:text-ink"
                  >
                    {suggestion}
                  </button>
                ))}
              </fieldset>
            ) : null}
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={
                  message.role === "user"
                    ? "ml-8 rounded-2xl bg-ink px-3.5 py-2.5 text-callout text-canvas"
                    : "mr-6 rounded-2xl border border-hairline bg-surface-2 px-3.5 py-2.5 text-callout text-ink"
                }
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.payUrl ? (
                  <a href={message.payUrl} className={`${buttonClass("primary")} mt-2`}>Pay now</a>
                ) : null}
              </div>
            ))}
            {waiting ? <p className="text-callout text-muted">Checking the book…</p> : null}
            {pending ? (
              <div className="rounded-2xl border border-hairline bg-surface-2 p-3.5 shadow-card">
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
            className="flex items-center gap-2 border-t border-hairline bg-surface-2 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
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
                  if (!waiting) void send(draft);
                }}
                placeholder={listening ? "Listening…" : "Ask about a visit"}
                className="h-12 w-full resize-none rounded-full border border-hairline bg-canvas py-3 pr-12 pl-4 text-callout text-ink placeholder:text-muted outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <button
                type="button"
                aria-label={speaking ? "Stop speaking" : voiceOn ? "Stop voice" : "Speak"}
                aria-pressed={voiceOn}
                onClick={() => (speaking ? interrupt() : toggleVoice())}
                className={`absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-full transition-colors ${
                  voiceOn || speaking
                    ? "bg-ink text-canvas"
                    : "bg-fill text-ink-2 hover:bg-fill-strong hover:text-ink"
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
            <button type="submit" className={`${buttonClass("primary")} h-12 shrink-0`} disabled={waiting || !draft.trim()}>
              Send
            </button>
          </form>
        </dialog>
      ) : null}
    </>
  );
}
