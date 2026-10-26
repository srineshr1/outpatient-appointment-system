"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { ChevronRight, Search, XCircle } from "@/components/icons";
import { useBooking } from "@/components/providers/BookingProvider";
import { useClock } from "@/components/providers/ClockProvider";
import { PageHeading } from "@/components/shell/PageHeading";
import { Button } from "@/components/ui/Button";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { practice, type Doctor, type Slot } from "@/lib/data";
import { formatWhen, monogram, pluralise, yearsLabel } from "@/lib/format";
import { spring } from "@/lib/motion";
import { slotStatus } from "@/lib/schedule";

interface Props {
  doctors: Doctor[];
  upcoming: Record<string, Slot[]>;
}

export function filterDoctors(doctors: Doctor[], query: string, specialty: string): Doctor[] {
  const needle = query.trim().toLowerCase();
  return doctors.filter((doctor) => {
    const named =
      !needle ||
      doctor.name.toLowerCase().includes(needle) ||
      doctor.interest.toLowerCase().includes(needle);
    return named && (!specialty || doctor.interest === specialty);
  });
}

export function DoctorDirectory({ doctors, upcoming }: Props) {
  const { state } = useBooking();
  const { now, window } = useClock();
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("");
  const deferredQuery = useDeferredValue(query);

  const specialties = Array.from(new Set(doctors.map((doctor) => doctor.interest)));
  const shown = filterDoctors(doctors, deferredQuery, specialty);
  const filtered = Boolean(query.trim() || specialty);

  function nextFor(doctorId: string): Slot | null {
    return (upcoming[doctorId] ?? []).find((slot) => slotStatus(slot, state.takenIds, now) === "open") ?? null;
  }

  return (
    <div className="mx-auto max-w-page px-5 pt-10 pb-20 md:px-8 md:pt-16">
      <PageHeading className="text-title1 font-semibold text-ink md:text-hero">Book a GP appointment</PageHeading>
      <p className="mt-3 max-w-prose text-title3 font-normal text-ink-2 md:mt-4">
        Choose a doctor at {practice.shortName}, then pick a time that suits you.
      </p>

      <div className="mt-8 grid gap-5 md:mt-10">
        <div className="relative max-w-xl">
          <label htmlFor="doctor-search" className="sr-only">
            Search by doctor or specialty
          </label>
          <Search size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
          <input
            id="doctor-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by doctor or specialty"
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

      <section aria-labelledby="good-to-know" className="mt-16">
        <h2 id="good-to-know" className="text-title3 font-semibold text-ink">
          Good to know
        </h2>
        <dl className="mt-4 grid gap-3 md:grid-cols-3 md:gap-4">
          <Fact term="Same-day visits" detail={`Book online until ${practice.sameDayClose}. After that, call the desk.`} />
          <Fact term="Visit length" detail="10 or 15 minutes, depending on the reason for your visit." />
          <Fact term="New patients" detail="Please register by phone first. Online booking is for registered patients." />
        </dl>
      </section>
    </div>
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
      className="group flex h-full items-start gap-4 rounded-card bg-surface p-5 shadow-card transition-[box-shadow,transform] duration-300 ease-out-quint hover:shadow-raised active:scale-[0.99] md:p-6"
    >
      <span
        aria-hidden="true"
        className="grid size-14 shrink-0 place-items-center rounded-full bg-fill text-title3 font-semibold text-ink-2"
      >
        {monogram(doctor.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-title3 font-semibold text-ink">{doctor.name}</span>
        <span className="mt-0.5 block text-callout text-ink-2">
          {doctor.interest} · {doctor.qualification}
        </span>
        <span className="mt-0.5 block text-callout text-muted">
          {yearsLabel(doctor.years)} · {doctor.room}
        </span>
        <span className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {next ? (
            <span id={`next-${doctor.id}`} className="tabular inline-flex items-center gap-2 text-callout text-ink">
              <span aria-hidden="true" className="size-2 rounded-full bg-success" />
              <span>
                <span className="text-muted">Next available </span>
                <span className="font-medium">{formatWhen(next, today)}</span>
              </span>
            </span>
          ) : (
            <span id={`next-${doctor.id}`} className="text-callout text-muted">
              No times online. Call the desk.
            </span>
          )}
          <span className="inline-flex items-center gap-0.5 text-callout font-medium text-accent">
            See times
            <ChevronRight size={18} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </span>
      </span>
    </Link>
  );
}

function Fact({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="rounded-card bg-surface p-5 shadow-card">
      <dt className="text-callout font-semibold text-ink">{term}</dt>
      <dd className="mt-1 text-callout text-muted">{detail}</dd>
    </div>
  );
}
