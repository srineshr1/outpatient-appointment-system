"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useDeferredValue, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ChevronRight, Search, XCircle } from "@/components/icons";
import { DoctorPortrait } from "@/components/doctors/DoctorPortrait";
import { useClock } from "@/components/providers/ClockProvider";
import { Button } from "@/components/ui/Button";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { practice, type Doctor, type Slot } from "@/lib/data";
import { formatWhen, pluralise, yearsLabel } from "@/lib/format";
import { spring } from "@/lib/motion";
import { clampWeek, slotStatus } from "@/lib/schedule";
import { WeekPicker } from "@/components/schedule/WeekPicker";

interface Props {
  doctors: Doctor[];
  upcoming: Record<string, Slot[]>;
  /**
   * Pinned with the search and filters while the cards scroll underneath. The booking page puts
   * its greeting (the page's h1) here. Without it the section opens with its own "Meet our doctors"
   * introduction, which scrolls away as usual.
   */
  heading?: ReactNode;
  /** Id of the heading inside `heading`. It names the section. */
  labelledBy?: string;
  /** Under the pinned bar and above the cards. Scrolls with the cards. */
  lead?: ReactNode;
  /** Every doctor's times. When given, cards open in place to show the week instead of linking away. */
  slots?: Record<string, Slot[]>;
  /** Signed in as a patient (Continue skips sign-in). */
  signedIn?: boolean;
}

export function filterDoctors(doctors: Doctor[], query: string, specialty: string): Doctor[] {
  const needle = query.trim().toLowerCase();
  return doctors.filter((doctor) => {
    const named =
      !needle ||
      doctor.name.toLowerCase().includes(needle) ||
      doctor.interest.toLowerCase().includes(needle) ||
      doctor.languages.some((language) => language.toLowerCase().includes(needle));
    return named && (!specialty || doctor.interest === specialty);
  });
}

export function DoctorDirectory({ doctors, upcoming, heading, labelledBy, lead, slots, signedIn = false }: Props) {
  // Independent: several doctors can be open at once to compare times.
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());
  function toggle(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const { now, window } = useClock();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("");
  const deferredQuery = useDeferredValue(query);
  const sectionRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const stuck = usePinnedBar(sectionRef, sentinelRef, barRef);

  const specialties = Array.from(new Set(doctors.map((doctor) => doctor.interest)));
  const shown = filterDoctors(doctors, deferredQuery, specialty);
  const filtered = Boolean(query.trim() || specialty);

  function nextFor(doctorId: string): Slot | null {
    return (upcoming[doctorId] ?? []).find((slot) => slotStatus(slot, [], now) === "open") ?? null;
  }

  /** Filtering from deep in the list: bring the results back up to just under the bar. */
  function revealResults() {
    const bar = barRef.current;
    const results = resultsRef.current;
    if (!bar || !results || globalThis.getComputedStyle(bar).position !== "sticky") return;
    const hidden = bar.getBoundingClientRect().bottom + 8 - results.getBoundingClientRect().top;
    if (hidden > 0) globalThis.scrollBy({ top: -hidden, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function search(value: string) {
    revealResults();
    setQuery(value);
  }

  function clearAll() {
    revealResults();
    setQuery("");
    setSpecialty("");
    // The button that was pressed goes away; keep focus in the finder.
    searchRef.current?.focus({ preventScroll: true });
  }

  return (
    <section
      ref={sectionRef}
      id="doctors"
      aria-labelledby={labelledBy ?? "doctors-title"}
      className={heading ? undefined : "pt-16 md:pt-24"}
    >
      {heading ? null : (
        <div className="mx-auto max-w-page px-5 md:px-8">
          <p className="text-callout font-bold tracking-wide text-accent dark:text-cyan-300 uppercase">Our team</p>
          <h2 id="doctors-title" className="mt-2 text-title1 font-bold text-ink">
            Meet our doctors
          </h2>
          <p className="mt-3 max-w-prose text-body text-ink-2">
            Five GPs, each with something they’re especially good at. Pick the one that fits, then choose a time.
          </p>
        </div>
      )}

      {/* Marks where the bar starts, so we can tell when it has stuck under the header. */}
      <div ref={sentinelRef} aria-hidden="true" />

      {/* The finder: pinned under the site header while the cards scroll beneath it. On short
          screens (a phone on its side, a zoomed-in window) it scrolls like the rest of the page. */}
      <div
        ref={barRef}
        data-pinned-bar=""
        data-stuck={stuck ? "" : undefined}
        className={`top-(--header-h) z-20 border-b transition-[background-color,border-color,box-shadow] duration-200 tall:sticky ${
          stuck
            ? "border-ink/[0.08] bg-canvas/85 shadow-[0_12px_32px_-16px_rgb(0_0_0/0.8)] backdrop-blur-xl backdrop-saturate-150"
            : "border-transparent bg-canvas"
        }`}
      >
        <div className={`mx-auto max-w-page px-5 pb-3 md:px-8 md:pb-4 ${heading ? "pt-5 md:pt-7" : "pt-5 md:pt-6"}`}>
          <div className={heading ? "grid gap-3 md:gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-center lg:gap-8" : undefined}>
            {heading ? <div className="min-w-0">{heading}</div> : null}
            <div className={`relative ${heading ? "" : "max-w-xl"}`}>
              <label htmlFor="doctor-search" className="sr-only">
                Search by name, specialty or language
              </label>
              <Search size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
              <input
                ref={searchRef}
                id="doctor-search"
                type="search"
                value={query}
                onChange={(event) => search(event.target.value)}
                placeholder="Name, specialty or language"
                autoComplete="off"
                enterKeyHint="search"
                className={`field h-12 rounded-full! border-ink/12! bg-surface-2! pl-11 text-ink text-ellipsis placeholder:text-muted hover:border-ink/25! focus-visible:border-accent! ${
                  query ? "pr-12" : "pr-4"
                }`}
              />
              <AnimatePresence>
                {query ? (
                  <motion.button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => {
                      search("");
                      searchRef.current?.focus({ preventScroll: true });
                    }}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={spring.press}
                    className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center text-muted transition-colors hover:text-ink-2 dark:hover:text-zinc-200"
                  >
                    <XCircle size={20} />
                  </motion.button>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          {/* One row that swipes sideways on phones and tablets, so the bar stays short; wraps on wide screens. */}
          <ChipGroup
            label="Filter by specialty"
            value={specialty}
            onChange={(value) => {
              revealResults();
              setSpecialty(value);
            }}
            options={[{ value: "", label: "All doctors" }, ...specialties.map((item) => ({ value: item, label: item }))]}
            className="scrollbar-none -mx-5 mt-1.5 flex scroll-px-5 gap-2 overflow-x-auto px-5 py-1.5 md:-mx-8 md:mt-2.5 md:scroll-px-8 md:px-8 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
          />
        </div>
      </div>

      <div className="pin-clear mx-auto max-w-page px-5 md:px-8">
        {lead ? <div className="mt-5 grid gap-4 md:mt-6">{lead}</div> : null}

        <div ref={resultsRef} className="mt-5 flex min-h-11 items-center justify-between gap-4 md:mt-6">
          <p className="text-callout text-muted" aria-live="polite" aria-atomic="true">
            {pluralise(shown.length, "doctor")}
            {specialty ? ` in ${specialty.toLowerCase()}` : ""}
          </p>
          {filtered ? (
            <Button variant="plain" onClick={clearAll}>
              Clear filters
            </Button>
          ) : null}
        </div>

        <motion.ul layout="position" aria-label="Doctors" className="mt-2 grid gap-3 md:grid-cols-2 md:gap-4">
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((doctor) => (
              <motion.li
                key={doctor.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={reduceMotion ? { duration: 0 } : spring.layout}
                className={openIds.has(doctor.id) ? "md:col-span-2" : undefined}
              >
                {slots ? (
                  <ExpandableDoctorCard
                    doctor={doctor}
                    next={nextFor(doctor.id)}
                    today={window.today}
                    slots={slots[doctor.id] ?? []}
                    open={openIds.has(doctor.id)}
                    onToggle={() => toggle(doctor.id)}
                    signedIn={signedIn}
                  />
                ) : (
                  <DoctorCard doctor={doctor} next={nextFor(doctor.id)} today={window.today} />
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>

        <AnimatePresence initial={false}>
          {shown.length === 0 ? (
            <motion.div
              role="status"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.25 }}
            >
              <SpotlightCard className="rounded-card px-6 py-10 text-center">
                <p className="relative z-10 text-title3 font-semibold text-ink">No doctors found</p>
                <p className="relative z-10 mx-auto mt-2 max-w-sm text-callout text-muted">
                  {emptyCopy(query, specialty)} Or call the desk on{" "}
                  <a href={practice.phoneHref} className="tabular text-accent dark:text-cyan-300 hover:text-accent dark:hover:text-cyan-200">
                    {practice.phoneDisplay}
                  </a>
                  .
                </p>
              </SpotlightCard>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}

/**
 * Watches the pinned bar. Returns whether it is stuck under the header (for its shadow), and
 * publishes its height on the section as --pin-h, so focused cards stop below it (WCAG 2.4.11).
 */
function usePinnedBar(
  sectionRef: RefObject<HTMLElement | null>,
  sentinelRef: RefObject<HTMLElement | null>,
  barRef: RefObject<HTMLElement | null>,
): boolean {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const sentinel = sentinelRef.current;
    const bar = barRef.current;
    if (!section || !sentinel || !bar) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const style = globalThis.getComputedStyle(bar);
      const pinned = style.position === "sticky";
      section.style.setProperty("--pin-h", pinned ? `${bar.offsetHeight}px` : "0px");
      setStuck(pinned && sentinel.getBoundingClientRect().top < (Number.parseFloat(style.top) || 0) - 1);
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    schedule();
    globalThis.addEventListener("scroll", schedule, { passive: true });
    globalThis.addEventListener("resize", schedule);
    const resize = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    resize?.observe(bar);
    return () => {
      cancelAnimationFrame(frame);
      globalThis.removeEventListener("scroll", schedule);
      globalThis.removeEventListener("resize", schedule);
      resize?.disconnect();
    };
  }, [sectionRef, sentinelRef, barRef]);

  return stuck;
}

export function emptyCopy(query: string, specialty: string): string {
  const named = query.trim();
  if (named && specialty) return `Nobody matches “${named}” in ${specialty.toLowerCase()}. Try clearing a filter.`;
  if (named) return `Nobody matches “${named}”. Check the spelling or try a specialty.`;
  return "Nobody is listed under that specialty.";
}

function CardBody({ doctor, next, today, action }: { doctor: Doctor; next: Slot | null; today: string; action: ReactNode }) {
  return (
    <>
      <span className="flex items-start gap-4">
        <DoctorPortrait
          doctor={doctor}
          size={80}
          shape="rounded"
          className="ring-1 ring-ink/10 transition-transform duration-300 ease-out-quint group-hover:scale-105 group-hover:-rotate-2"
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-title3 font-bold text-ink">
            {doctor.name}
            {doctor.verified ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/12 px-2 py-0.5 text-caption font-bold text-emerald-700 dark:text-emerald-300"
                title="Verified by the practice"
              >
                ✓ Verified
              </span>
            ) : null}
          </span>
          <span className="mt-1.5 inline-flex rounded-full border border-accent/25 dark:border-cyan-400/25 bg-accent/12 dark:bg-cyan-400/12 px-2.5 py-0.5 text-caption font-bold text-accent dark:text-cyan-300">
            {doctor.interest}
          </span>
          <span className="mt-1.5 block text-callout text-muted">
            {doctor.qualification} · {yearsLabel(doctor.years)}
          </span>
        </span>
      </span>
      <span className="mt-4 block text-callout text-ink-2">{doctor.bio}</span>
      <span className="mt-3 mb-4 grid gap-1 text-caption text-muted">
        <span>
          <span className="font-semibold text-ink-2 dark:text-zinc-200">Speaks</span> {doctor.languages.join(", ")}
        </span>
        <span>
          <span className="font-semibold text-ink-2 dark:text-zinc-200">In clinic</span> {doctor.days} · {doctor.room}
        </span>
      </span>
      <span className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-ink/[0.08] pt-4">
        {next ? (
          <span id={`next-${doctor.id}`} className="tabular inline-flex items-center gap-2 text-callout text-ink">
            <span aria-hidden="true" className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
            </span>
            <span>
              <span className="text-muted">Next available </span>
              <span className="font-semibold text-ink">{formatWhen(next, today)}</span>
            </span>
          </span>
        ) : (
          <span id={`next-${doctor.id}`} className="text-callout text-muted">
            No times online. Call the desk.
          </span>
        )}
        {action}
      </span>
    </>
  );
}

const CARD = "group relative z-10 flex h-full w-full flex-col p-5 text-left no-underline md:p-6";

function DoctorCard({ doctor, next, today }: { doctor: Doctor; next: Slot | null; today: string }) {
  return (
    <SpotlightCard className="h-full transition-[box-shadow,transform] duration-300 ease-out-quint hover:-translate-y-0.5 active:scale-[0.99]">
      <Link
        href={`/doctors/${doctor.id}`}
        aria-label={`${doctor.name}, ${doctor.interest}. See times`}
        aria-describedby={`next-${doctor.id}`}
        className={`${CARD} rounded-sheet focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent/65`}
      >
        <CardBody
          doctor={doctor}
          next={next}
          today={today}
          action={
            <span className="inline-flex items-center gap-0.5 text-callout font-bold text-accent dark:text-cyan-300">
              See times
              <ChevronRight size={18} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          }
        />
      </Link>
    </SpotlightCard>
  );
}

/** A doctor card that opens in place to show the week of times (the booking page). */
function ExpandableDoctorCard({
  doctor,
  next,
  today,
  slots,
  open,
  onToggle,
  signedIn,
}: {
  doctor: Doctor;
  next: Slot | null;
  today: string;
  slots: Slot[];
  open: boolean;
  onToggle: () => void;
  signedIn: boolean;
}) {
  const reduce = useReducedMotion();
  const { now, window } = useClock();
  const panelId = `times-${doctor.id}`;
  const buttonId = `doctor-${doctor.id}`;
  const firstOpen = slots.find((slot) => slotStatus(slot, [], now) === "open");
  const initialWeek = clampWeek(null, window, firstOpen?.date);
  return (
    <SpotlightCard
      className={`overflow-clip! transition-shadow duration-300 ${open ? "shadow-raised ring-1 ring-accent/35 dark:ring-cyan-400/35" : ""}`}
      data-expanded={open ? "true" : undefined}
    >
      <button
        id={buttonId}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-describedby={`next-${doctor.id}`}
        onClick={onToggle}
        className={`${CARD} focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent/65 ${
          open ? "rounded-t-sheet" : "rounded-sheet active:scale-[0.995]"
        }`}
      >
        <CardBody
          doctor={doctor}
          next={next}
          today={today}
          action={
            <span className="inline-flex items-center gap-1 text-callout font-bold text-accent dark:text-cyan-300">
              {open ? "Hide times" : "See times"}
              <motion.span
                aria-hidden="true"
                animate={{ rotate: open ? -90 : 90 }}
                transition={reduce ? { duration: 0 } : spring.press}
                className="inline-flex"
              >
                <ChevronRight size={18} />
              </motion.span>
            </span>
          }
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.section
            key="times"
            id={panelId}
            aria-labelledby={buttonId}
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0, overflow: "hidden" }}
            animate={
              reduce
                ? { opacity: 1 }
                : { height: "auto", opacity: 1, overflow: "hidden", transitionEnd: { overflow: "visible" } }
            }
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0, overflow: "hidden" }}
            transition={
              reduce
                ? { duration: 0 }
                : { height: { type: "spring", stiffness: 320, damping: 32 }, opacity: { duration: 0.2 } }
            }
          >
            <div className="relative z-10 border-t border-ink/[0.08] px-5 pt-5 pb-5 md:px-6 md:pb-6">
              <WeekPicker doctor={doctor} slots={slots} initialWeek={initialWeek} signedIn={signedIn} headingLevel={3} />
              <Link
                href={`/doctors/${doctor.id}`}
                className="mt-4 inline-flex min-h-11 items-center gap-0.5 text-callout font-medium text-accent dark:text-cyan-300 hover:text-accent dark:hover:text-cyan-200"
              >
                Open {doctor.short}’s full page
                <ChevronRight size={18} />
              </Link>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </SpotlightCard>
  );
}
