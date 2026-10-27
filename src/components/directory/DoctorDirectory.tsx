"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
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
  /** On the booking page the page's own h1 introduces the list, labelled by this id. */
  labelledBy?: string;
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

export function DoctorDirectory({ doctors, upcoming, labelledBy }: Props) {
  const { now, window } = useClock();
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("");
  const deferredQuery = useDeferredValue(query);

  const specialties = Array.from(new Set(doctors.map((doctor) => doctor.interest)));
  const shown = filterDoctors(doctors, deferredQuery, specialty);
  const filtered = Boolean(query.trim() || specialty);

  function nextFor(doctorId: string): Slot | null {
    return (upcoming[doctorId] ?? []).find((slot) => slotStatus(slot, [], now) === "open") ?? null;
  }

  return (
    <section
      id="doctors"
      aria-labelledby={labelledBy ?? "doctors-title"}
      className={`mx-auto max-w-page scroll-mt-24 px-5 md:px-8 ${labelledBy ? "pt-2" : "pt-16 md:pt-24"}`}
    >
      {labelledBy ? null : (
        <>
          <p className="text-callout font-bold tracking-wide text-accent uppercase">Our team</p>
          <h2 id="doctors-title" className="mt-2 text-title1 font-bold text-ink">
            Meet our doctors
          </h2>
          <p className="mt-3 max-w-prose text-body text-ink-2">
            Five GPs, each with something they’re especially good at. Pick the one that fits, then choose a time.
          </p>
        </>
      )}

      <div className="mt-8 grid gap-5 md:mt-10">
        <div className="relative max-w-xl">
          <label htmlFor="doctor-search" className="sr-only">
            Search by name, specialty or language
          </label>
          <Search size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
          <input
            id="doctor-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, specialty or language"
            autoComplete="off"
            enterKeyHint="search"
            className="field h-12 rounded-full! border-transparent! bg-fill! pr-12 pl-12 hover:bg-fill-strong! focus-visible:bg-surface!"
          />
          <AnimatePresence>
            {query ? (
              <motion.button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
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

        <ChipGroup
          label="Filter by specialty"
          value={specialty}
          onChange={setSpecialty}
          options={[{ value: "", label: "All doctors" }, ...specialties.map((item) => ({ value: item, label: item }))]}
        />
      </div>

      <div className="mt-8 flex min-h-11 items-center justify-between gap-4">
        <p className="text-callout text-muted" aria-live="polite" aria-atomic="true">
          {pluralise(shown.length, "doctor")}
          {specialty ? ` in ${specialty.toLowerCase()}` : ""}
        </p>
        {filtered ? (
          <Button
            variant="plain"
            onClick={() => {
              setQuery("");
              setSpecialty("");
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      <motion.ul layout="position" aria-label="Doctors" className="mt-3 grid gap-3 md:grid-cols-2 md:gap-4">
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
    </section>
  );
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
