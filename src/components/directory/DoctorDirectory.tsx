"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useDeferredValue, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ChevronRight, Search, XCircle } from "@/components/icons";
import { DoctorPortrait } from "@/components/doctors/DoctorPortrait";
import { useClock } from "@/components/providers/ClockProvider";
import { Button } from "@/components/ui/Button";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { practice, type Doctor, type Slot } from "@/lib/data";
import { formatWhen, pluralise, yearsLabel } from "@/lib/format";
import { spring } from "@/lib/motion";
import { slotStatus } from "@/lib/schedule";

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

export function DoctorDirectory({ doctors, upcoming, heading, labelledBy, lead }: Props) {
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
          <p className="text-callout font-bold tracking-wide text-accent uppercase">Our team</p>
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
            ? "border-hairline/80 bg-canvas/85 shadow-[0_12px_24px_-20px_rgb(0_0_0/0.4)] backdrop-blur-xl backdrop-saturate-150"
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
                className={`field h-12 rounded-full! border-hairline! bg-surface! pl-11 text-ellipsis hover:border-control! focus-visible:border-accent! ${
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
                    className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center text-muted hover:text-ink-2"
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
                transition={spring.layout}
              >
                <DoctorCard doctor={doctor} next={nextFor(doctor.id)} today={window.today} />
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
              className="rounded-card bg-surface px-6 py-10 text-center shadow-card"
            >
              <p className="text-title3 font-semibold text-ink">No doctors found</p>
              <p className="mx-auto mt-2 max-w-sm text-callout text-muted">
                {emptyCopy(query, specialty)} Or call the desk on{" "}
                <a href={practice.phoneHref} className="tabular text-accent">
                  {practice.phoneDisplay}
                </a>
                .
              </p>
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

function DoctorCard({ doctor, next, today }: { doctor: Doctor; next: Slot | null; today: string }) {
  return (
    <Link
      href={`/doctors/${doctor.id}`}
      aria-label={`${doctor.name}, ${doctor.interest}. See times`}
      aria-describedby={`next-${doctor.id}`}
      className="group flex h-full flex-col rounded-sheet bg-surface p-5 no-underline shadow-card transition-[box-shadow,transform] duration-300 ease-out-quint hover:-translate-y-0.5 hover:shadow-raised active:scale-[0.99] md:p-6"
    >
      <span className="flex items-start gap-4">
        <DoctorPortrait
          doctor={doctor}
          size={80}
          shape="rounded"
          className="transition-transform duration-300 ease-out-quint group-hover:scale-105 group-hover:-rotate-2"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-title3 font-bold text-ink">{doctor.name}</span>
          <span className="mt-1.5 inline-flex rounded-full bg-accent-soft px-2.5 py-0.5 text-caption font-bold text-accent">
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
          <span className="font-semibold text-ink-2">Speaks</span> {doctor.languages.join(", ")}
        </span>
        <span>
          <span className="font-semibold text-ink-2">In clinic</span> {doctor.days} · {doctor.room}
        </span>
      </span>
      <span className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-hairline pt-4">
        {next ? (
          <span id={`next-${doctor.id}`} className="tabular inline-flex items-center gap-2 text-callout text-ink">
            <span aria-hidden="true" className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            <span>
              <span className="text-muted">Next available </span>
              <span className="font-semibold">{formatWhen(next, today)}</span>
            </span>
          </span>
        ) : (
          <span id={`next-${doctor.id}`} className="text-callout text-muted">
            No times online. Call the desk.
          </span>
        )}
        <span className="inline-flex items-center gap-0.5 text-callout font-bold text-accent">
          See times
          <ChevronRight size={18} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
      </span>
    </Link>
  );
}
