import { useEffect, useRef, useState } from "react";
import { practice, slots, TODAY } from "./data";
import {
  addDays,
  canShiftWeek,
  clockLabel,
  dayNumber,
  formatHold,
  formatNext,
  formatWeekTitle,
  formatWhen,
  monthLong,
  nextOpening,
  slotStatus,
  weekdayLong,
} from "./format";
import { IconNext, IconPrev } from "./icons";
import { Button } from "./ui";

const STATUS_LABEL = {
  open: "Open",
  past: "Closed",
  taken: "Taken",
  unsupervised: "Teaching",
};

function slotsFor(doctorId, date) {
  return slots
    .filter((slot) => slot.doctorId === doctorId && slot.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));
}

function weekSlots(doctorId, weekStart) {
  const end = addDays(weekStart, 4);
  return slots.filter((slot) => slot.doctorId === doctorId && slot.date >= weekStart && slot.date <= end);
}

function monogram(name) {
  const parts = name.replace(/^Dr\s+/, "").split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

function yearsLabel(years) {
  return years === 1 ? "1 year in practice" : `${years} years in practice`;
}

function specialtiesOf(doctors) {
  const list = [];
  for (const person of doctors) {
    if (!list.includes(person.interest)) list.push(person.interest);
  }
  return list;
}

export function Book({
  doctors,
  doctor,
  weekStart,
  slotId,
  takenIds,
  loading,
  slotError,
  errorRef,
  onDoctor,
  onLeave,
  onSlot,
  onWeek,
  onJump,
  onHold,
}) {
  const panelRef = useRef(null);
  const skipFocus = useRef(true);

  useEffect(() => {
    if (skipFocus.current) {
      skipFocus.current = false;
      return;
    }
    panelRef.current?.focus();
  }, [doctor]);

  return (
    <div className="mx-auto max-w-page px-4 md:px-8">
      {doctor ? (
        <Schedule
          panelRef={panelRef}
          doctor={doctor}
          weekStart={weekStart}
          slotId={slotId}
          takenIds={takenIds}
          loading={loading}
          slotError={slotError}
          errorRef={errorRef}
          onLeave={onLeave}
          onSlot={onSlot}
          onWeek={onWeek}
          onJump={onJump}
          onHold={onHold}
        />
      ) : (
        <Directory panelRef={panelRef} doctors={doctors} takenIds={takenIds} onDoctor={onDoctor} />
      )}
    </div>
  );
}

function Directory({ panelRef, doctors, takenIds, onDoctor }) {
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("");
  const specialties = specialtiesOf(doctors);
  const needle = query.trim().toLowerCase();
  const shown = doctors.filter((person) => {
    const named = !needle || person.name.toLowerCase().includes(needle) || person.short.toLowerCase().includes(needle);
    return named && (!specialty || person.interest === specialty);
  });

  return (
    <section id="book" ref={panelRef} tabIndex={-1} className="outline-none" aria-labelledby="book-title">
      <p className="text-label text-muted uppercase">1 of 3 — Find a doctor</p>
      <h1 id="book-title" className="mt-2 max-w-prose font-display text-title font-medium text-ink md:text-day">
        Find and select your preferred doctor
      </h1>
      <p className="mt-3 max-w-prose text-body text-ink-soft">
        Search by name. Each row is one clinician at Halden Street, with the next time they can see you.
      </p>

      <div className="mt-8 max-w-prose">
        <label htmlFor="doctor-search" className="text-label text-muted uppercase">
          Search by doctor’s name
        </label>
        <input
          id="doctor-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="For example, Adeyemi"
          autoComplete="off"
          className="mt-2 w-full rounded-sm border border-line bg-paper-raised px-3 py-3 text-body text-ink"
        />
      </div>

      <p className="mt-6 max-w-prose text-body text-ink">Not sure which doctor to consult? Use the filters below.</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Specialty">
        <FilterChip pressed={specialty === ""} onClick={() => setSpecialty("")}>
          All
        </FilterChip>
        {specialties.map((item) => (
          <FilterChip key={item} pressed={specialty === item} onClick={() => setSpecialty(item)}>
            {item}
          </FilterChip>
        ))}
      </div>

      <div className="mt-6 flex items-baseline justify-between gap-4">
        <p className="text-ui text-ink-soft" aria-live="polite">
          {shown.length === 1 ? "1 doctor" : `${shown.length} doctors`}
          {specialty ? ` in ${specialty}` : " at Halden Street"}
        </p>
        {needle || specialty ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSpecialty("");
            }}
            className="text-ui text-ink underline decoration-line underline-offset-4 hover:decoration-accent"
          >
            Clear search
          </button>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 border border-line bg-well px-4 py-6 text-body text-ink" role="status">
          {emptyCopy(query, specialty)}
        </p>
      ) : (
        <ul className="mt-2 border-t border-line" aria-label="Doctors">
          {shown.map((person) => {
            const next = nextOpening(person.id, takenIds);
            return (
              <li key={person.id} className="border-b border-line py-6">
                <div className="grid grid-cols-12 items-center gap-4">
                  <div className="col-span-12 flex gap-4 md:col-span-8">
                    <span
                      aria-hidden="true"
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center bg-well font-display text-section font-medium text-ink"
                    >
                      {monogram(person.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-section font-medium text-ink">{person.name}</p>
                      <p className="mt-1 text-ui text-ink">
                        {person.qualification} · {person.interest}
                      </p>
                      <p className="mt-1 text-ui text-ink-soft">
                        {yearsLabel(person.years)} · {person.room}
                      </p>
                      <p className="mt-2 text-ui text-ink tabular-nums">
                        {next ? `Next open ${formatNext(next)}` : "None open. Call the practice."}
                      </p>
                    </div>
                  </div>
                  <div className="col-span-12 md:col-span-4 md:text-right">
                    <Button
                      className="w-full md:w-auto"
                      aria-label={`Book an appointment with ${person.name}`}
                      onClick={() => onDoctor(person.id)}
                    >
                      Book an appointment
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <dl className="mt-8 grid gap-x-6 md:grid-cols-3">
        <Rule term="Same day" detail={`Book until ${practice.sameDayClose}. After that, phone the desk.`} />
        <Rule term="Length" detail="10 or 15 minutes, set by the reason for the visit." />
        <Rule term="New patients" detail="Register by phone. This book is for people already on the list." />
      </dl>
    </section>
  );
}

function emptyCopy(query, specialty) {
  const named = query.trim();
  if (named && specialty) {
    return `No doctor matches “${named}” in ${specialty}. Clear the search, or call the practice.`;
  }
  if (named) return "No doctor matches that name. Try a specialty, or call the practice.";
  return `No doctor is listed under ${specialty}. Call the practice.`;
}

function FilterChip({ pressed, children, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-sm border px-3 py-3 text-ui transition-colors ${
        pressed
          ? "border-accent bg-accent text-accent-ink"
          : "border-line bg-paper text-ink hover:bg-well active:bg-line"
      }`}
    >
      {children}
    </button>
  );
}

function Schedule({
  panelRef,
  doctor,
  weekStart,
  slotId,
  takenIds,
  loading,
  slotError,
  errorRef,
  onLeave,
  onSlot,
  onWeek,
  onJump,
  onHold,
}) {
  const days = [0, 1, 2, 3, 4].map((offset) => addDays(weekStart, offset));
  const selected = slots.find((slot) => slot.id === slotId) ?? null;
  const inWeek = weekSlots(doctor.id, weekStart);
  const openInWeek = inWeek.filter((slot) => slotStatus(slot, takenIds) === "open");

  return (
    <>
      <section id="book" ref={panelRef} tabIndex={-1} className="outline-none" aria-labelledby="book-title">
        <button
          type="button"
          onClick={onLeave}
          className="inline-flex items-center gap-2 text-ui text-ink underline decoration-line underline-offset-4 hover:decoration-accent"
        >
          <IconPrev />
          All doctors
        </button>
        <p className="mt-6 text-label text-muted uppercase">1 of 3 — Choose a time</p>
        <h1 id="book-title" className="mt-2 font-display text-title font-medium text-ink md:text-day">
          {doctor.name}
        </h1>
        <p className="mt-3 max-w-prose text-body text-ink">
          {doctor.qualification} · {doctor.interest} · {yearsLabel(doctor.years)}
        </p>
        <p className="mt-2 text-ui text-ink-soft">{doctor.room}</p>
        <p className="mt-2 max-w-prose text-ui text-ink-soft">{doctor.note}</p>

        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-section font-medium text-ink">{doctor.short}’s week</h2>
            <p className="mt-2 text-ui text-ink-soft">{formatWeekTitle(weekStart)}</p>
          </div>
          <div className="flex gap-2">
            <WeekButton
              label="Show the previous week"
              disabled={!canShiftWeek(weekStart, -1)}
              onClick={() => onWeek(-1)}
            >
              <IconPrev />
            </WeekButton>
            <WeekButton label="Show the next week" disabled={!canShiftWeek(weekStart, 1)} onClick={() => onWeek(1)}>
              <IconNext />
            </WeekButton>
          </div>
        </div>
        <p className="mt-4 max-w-prose text-body text-ink-soft">
          Each time is on {doctor.short}’s schedule. Open times can be booked. Taken, closed, and teaching cannot.
        </p>

        {openInWeek.length === 0 && !loading ? (
          <EmptyWeek doctor={doctor} upcoming={nextOpening(doctor.id, takenIds)} onJump={onJump} />
        ) : null}

        {slotError ? (
          <p
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="mt-6 border border-danger px-4 py-3 text-body text-danger outline-none"
          >
            {slotError}
          </p>
        ) : null}

        <div className="mt-6">
          {loading ? (
            <WeekSkeleton />
          ) : (
            <fieldset>
              <legend className="sr-only">{doctor.name}’s times this week</legend>
              {days.map((iso) => (
                <DayRow
                  key={iso}
                  iso={iso}
                  items={slotsFor(doctor.id, iso)}
                  active={selected?.date === iso}
                  slotId={slotId}
                  takenIds={takenIds}
                  onSlot={onSlot}
                />
              ))}
            </fieldset>
          )}
        </div>

        <div className="mt-6 hidden items-center justify-between gap-4 md:flex">
          <p className="max-w-prose text-ui text-ink">
            {selected
              ? `Holding ${formatWhen(selected)} with ${doctor.name}, ${doctor.room}.`
              : `Choose an open time on ${doctor.short}’s week.`}
          </p>
          <Button disabled={!selected} onClick={onHold}>
            {selected ? `Hold ${selected.time} with ${doctor.short}` : "Choose an open time"}
          </Button>
        </div>
      </section>
      {selected ? (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper-raised px-4 py-4 md:hidden">
          <p className="text-ui text-ink">With {doctor.name}</p>
          <p className="text-ui text-ink-soft tabular-nums">{formatHold(selected, doctor)}</p>
          <Button className="mt-3 w-full" onClick={onHold}>
            Hold {selected.time} with {doctor.short}
          </Button>
        </div>
      ) : null}
    </>
  );
}

function Rule({ term, detail }) {
  return (
    <div className="border-t border-line py-4">
      <dt className="text-label text-muted uppercase">{term}</dt>
      <dd className="mt-2 max-w-prose text-body text-ink-soft">{detail}</dd>
    </div>
  );
}

function WeekButton({ label, children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex h-12 w-12 items-center justify-center rounded-sm border border-line text-ink transition-colors hover:bg-well active:bg-line disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent"
      {...props}
    >
      {children}
    </button>
  );
}

function DayRow({ iso, items, active, slotId, takenIds, onSlot }) {
  const openCount = items.filter((slot) => slotStatus(slot, takenIds) === "open").length;
  const openLabel = openCount === 0 ? "None open" : openCount === 1 ? "1 open" : `${openCount} open`;

  return (
    <div
      className={`grid grid-cols-12 gap-4 border-t border-l-2 border-line py-4 pl-4 ${active ? "border-l-accent" : "border-l-transparent"}`}
    >
      <div className="col-span-12 md:col-span-4">
        <p className="text-label text-muted uppercase">{weekdayLong(iso)}</p>
        <p className="mt-1 font-display text-section font-medium text-ink tabular-nums">
          {dayNumber(iso)} {monthLong(iso)}
        </p>
        <p className="mt-2 text-ui text-ink-soft tabular-nums">
          {iso === TODAY ? "Today · " : ""}
          {openLabel}
        </p>
        {iso === TODAY ? (
          <p className="mt-2 max-w-prose text-ui text-ink-soft">
            Same-day booking closes at {practice.sameDayClose}. It is {clockLabel()}.
          </p>
        ) : null}
      </div>
      <div className="col-span-12 flex flex-wrap gap-2 md:col-span-8">
        {items.length === 0 ? (
          <p className="text-ui text-ink-soft">Not in clinic.</p>
        ) : (
          items.map((slot) => (
            <SlotOption
              key={slot.id}
              slot={slot}
              status={slotStatus(slot, takenIds)}
              checked={slot.id === slotId}
              onSlot={onSlot}
            />
          ))
        )}
      </div>
    </div>
  );
}

function WeekSkeleton() {
  return (
    <>
      <div aria-hidden="true">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="grid grid-cols-12 gap-4 border-t border-line py-4">
            <div className="col-span-12 h-12 bg-well md:col-span-4" />
            <div className="col-span-12 flex gap-2 md:col-span-8">
              <div className="h-12 w-16 bg-well" />
              <div className="h-12 w-16 bg-well" />
              <div className="h-12 w-16 bg-well" />
            </div>
          </div>
        ))}
      </div>
      <p className="sr-only" role="status">
        Loading the week.
      </p>
    </>
  );
}

function SlotOption({ slot, status, checked, onSlot }) {
  const open = status === "open";
  const label = checked ? "Held" : STATUS_LABEL[status];

  return (
    <label className={`relative ${open ? "" : "cursor-not-allowed"}`}>
      <input
        type="radio"
        name="slot"
        value={slot.id}
        checked={checked}
        disabled={!open}
        onChange={() => onSlot(slot.id)}
        className="peer sr-only"
      />
      <span
        className={`inline-flex items-baseline gap-3 rounded-sm border px-3 py-3 text-ui tabular-nums transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus ${
          checked
            ? "border-accent bg-accent text-accent-ink hover:bg-ink"
            : open
              ? "border-line bg-paper text-ink hover:bg-well active:bg-line"
              : "border-line bg-paper text-muted"
        }`}
      >
        <span className={status === "taken" ? "line-through" : ""}>{slot.time}</span>
        {label ? <span className="text-label uppercase">{label}</span> : null}
      </span>
    </label>
  );
}

function EmptyWeek({ doctor, upcoming, onJump }) {
  return (
    <div className="mt-6 border border-line bg-well px-4 py-6">
      <p className="max-w-prose text-body text-ink">
        {upcoming
          ? `Nothing is open on ${doctor.name}’s list this week. The next time is ${formatWhen(upcoming)}.`
          : `${doctor.name} has nothing further in the book. Call the practice.`}
      </p>
      {upcoming ? (
        <Button variant="quiet" className="mt-4" onClick={() => onJump(upcoming.date)}>
          Show {doctor.short} on {formatWhen(upcoming)}
        </Button>
      ) : null}
    </div>
  );
}
