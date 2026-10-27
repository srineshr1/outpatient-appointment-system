"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, ChevronLeft, ChevronRight } from "@/components/icons";
import { DoctorPortrait } from "@/components/doctors/DoctorPortrait";
import { useBooking } from "@/components/providers/BookingProvider";
import { useClock } from "@/components/providers/ClockProvider";
import { PageHeading } from "@/components/shell/PageHeading";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Card";
import { addDays, dayOfMonth, mondayOf } from "@/lib/clock";
import { practice, type Doctor, type Slot } from "@/lib/data";
import {
  formatShortDate,
  formatWeekRange,
  formatWhen,
  monthLong,
  pluralise,
  weekdayLong,
  yearsLabel,
} from "@/lib/format";
import { spring } from "@/lib/motion";
import { canShiftWeek, clampWeek, openSlots, slotsOn, slotStatus, weekDays, type SlotStatus } from "@/lib/schedule";

interface Props {
  doctor: Doctor;
  slots: Slot[];
  initialWeek: string;
  /** Signed in as a patient. Otherwise Continue goes through sign-in first. */
  signedIn?: boolean;
}

const STATUS_TEXT: Record<Exclude<SlotStatus, "open">, string> = {
  taken: "booked",
  past: "closed",
  teaching: "teaching session",
};

export function ScheduleView({ doctor, slots, initialWeek, signedIn = false }: Props) {
  const router = useRouter();
  const { state, dispatch } = useBooking();
  const { now, window } = useClock();
  const [week, setWeek] = useState(initialWeek);
  const [direction, setDirection] = useState<1 | -1>(1);
  const flashRef = useRef<HTMLDivElement>(null);

  const held =
    state.held && state.held.doctorId === doctor.id && slotStatus(state.held, [], now) === "open"
      ? state.held
      : null;
  const flash = state.flash?.doctorId === doctor.id ? state.flash.message : null;

  // Keep the URL in step with the visible week, so refresh and sharing land in the same place.
  useEffect(() => {
    const url = new URL(globalThis.location.href);
    if (url.searchParams.get("week") === week) return;
    url.searchParams.set("week", week);
    globalThis.history.replaceState(globalThis.history.state, "", url);
  }, [week]);

  useEffect(() => {
    if (flash) flashRef.current?.focus();
  }, [flash]);

  function goToWeek(next: string) {
    const target = clampWeek(next, window);
    if (target === week) return;
    setDirection(target > week ? 1 : -1);
    setWeek(target);
  }

  function choose(slot: Slot) {
    dispatch({ type: "hold", slot });
  }

  const days = weekDays(week);
  const weekSlots = slots.filter((slot) => slot.date >= week && slot.date <= addDays(week, 4));
  const openThisWeek = openSlots(weekSlots, [], now);
  const upcoming = openSlots(slots, [], now).find((slot) => slot.date > addDays(week, 4)) ?? null;

  return (
    <div className="mx-auto max-w-page px-5 pt-6 pb-16 md:px-8 md:pt-10">
      <Link
        href="/"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full pr-3 pl-1 text-body text-accent hover:bg-accent-soft"
      >
        <ChevronLeft size={22} />
        All doctors
      </Link>

      <div className="mt-4 flex items-start gap-4 md:gap-6">
        <DoctorPortrait doctor={doctor} size={80} className="shadow-card md:size-24" />
        <div className="min-w-0">
          <PageHeading className="text-title2 font-semibold text-ink md:text-title1">{doctor.name}</PageHeading>
          <p className="mt-1 text-body text-ink-2">
            {doctor.interest} · {doctor.qualification} · {yearsLabel(doctor.years)}
          </p>
          <p className="mt-1 max-w-prose text-callout text-muted">
            {doctor.room}. {doctor.note}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {flash ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring.gentle}
            className="overflow-hidden"
          >
            <Notice
              ref={flashRef}
              tone="danger"
              role="alert"
              tabIndex={-1}
              className="mt-6 flex items-start gap-3 outline-none"
            >
              <Alert size={20} className="mt-0.5 shrink-0 text-danger" />
              <div>
                <p className="font-semibold">That time is no longer available</p>
                <p className="mt-0.5 text-ink-2">{flash} Your details are saved, so just pick another time.</p>
              </div>
            </Notice>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <section aria-labelledby="week-title" className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="week-title" className="text-title3 font-semibold text-ink">
              Choose a time
            </h2>
            <p className="tabular mt-1 text-callout text-muted" aria-live="polite">
              {formatWeekRange(week)} · {pluralise(openThisWeek.length, "time")} available
            </p>
          </div>
          <div className="flex gap-2">
            <WeekButton
              label="Previous week"
              disabled={!canShiftWeek(week, -1, window)}
              onClick={() => goToWeek(addDays(week, -7))}
            >
              <ChevronLeft size={22} />
            </WeekButton>
            <WeekButton
              label="Next week"
              disabled={!canShiftWeek(week, 1, window)}
              onClick={() => goToWeek(addDays(week, 7))}
            >
              <ChevronRight size={22} />
            </WeekButton>
          </div>
        </div>

        <div className="relative mt-5 overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={week}
              custom={direction}
              variants={{
                enter: (dir: number) => ({ x: dir * 48, opacity: 0 }),
                center: { x: 0, opacity: 1 },
                exit: (dir: number) => ({ x: dir * -48, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={spring.gentle}
            >
              {openThisWeek.length === 0 ? (
                <Notice tone="info" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    {upcoming
                      ? `No times left with ${doctor.short} this week. The next one is ${formatWhen(upcoming, window.today)}.`
                      : `${doctor.short} has no more times online. Call the desk on ${practice.phoneDisplay}.`}
                  </p>
                  {upcoming ? (
                    <Button variant="secondary" onClick={() => goToWeek(mondayOf(upcoming.date))}>
                      Go to {formatShortDate(upcoming.date)}
                    </Button>
                  ) : null}
                </Notice>
              ) : null}

              <LayoutGroup id="slots">
                <fieldset>
                  <legend className="sr-only">
                    Times with {doctor.name}, {formatWeekRange(week)}
                  </legend>
                  <div className="grid gap-3">
                    {days.map((iso) => (
                      <DayCard
                        key={iso}
                        iso={iso}
                        today={window.today}
                        now={now}
                        items={slotsOn(weekSlots, doctor.id, iso)}
                        heldId={held?.id ?? null}
                        onChoose={choose}
                      />
                    ))}
                  </div>
                </fieldset>
              </LayoutGroup>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      <AnimatePresence>
        {held ? (
          <motion.div
            key="continue"
            initial={{ y: 96, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 96, opacity: 0 }}
            transition={spring.gentle}
            className="sticky bottom-0 z-20 -mx-5 mt-6 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:bottom-4 md:mx-0 md:px-0 md:pb-0"
          >
            <div className="flex flex-col gap-3 rounded-sheet bg-surface/90 p-4 shadow-float ring-1 ring-black/[0.04] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between md:p-5">
              <div aria-live="polite">
                <p className="text-caption text-muted">Your time</p>
                <p className="tabular text-body font-semibold text-ink">
                  {weekdayLong(held.date)} {dayOfMonth(held.date)} {monthLong(held.date)}, {held.time}
                </p>
                {signedIn ? null : (
                  <p className="mt-0.5 text-caption text-muted">Next, sign in. We’ll keep this time for you.</p>
                )}
              </div>
              <Button
                size="lg"
                className="w-full sm:w-auto"
                onClick={() =>
                  router.push(signedIn ? "/book/details" : `/sign-in?next=${encodeURIComponent("/book/details")}`)
                }
              >
                Continue
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function WeekButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      transition={spring.press}
      className="grid size-11 place-items-center rounded-full bg-surface text-accent shadow-card transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:bg-fill disabled:text-control disabled:shadow-none"
    >
      {children}
    </motion.button>
  );
}

interface DayCardProps {
  iso: string;
  today: string;
  now: Date;
  items: Slot[];
  heldId: string | null;
  onChoose: (slot: Slot) => void;
}

function DayCard({ iso, today, now, items, heldId, onChoose }: DayCardProps) {
  const statuses = items.map((slot) => slotStatus(slot, [], now));
  const open = statuses.filter((status) => status === "open").length;
  const isToday = iso === today;
  const sameDayClosed = isToday && items.length > 0 && open === 0 && statuses.some((status) => status === "past");

  return (
    <div className="rounded-card bg-surface p-4 shadow-card md:flex md:gap-6 md:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3 md:mb-0 md:block md:w-52 md:shrink-0">
        <h3 className="text-body font-semibold text-ink">
          {weekdayLong(iso)} {dayOfMonth(iso)} {monthLong(iso)}
        </h3>
        <p className="mt-0.5 flex items-center gap-2 text-callout text-muted">
          {isToday ? (
            <span className="rounded-full bg-accent-soft px-2 py-px text-caption font-semibold text-accent">Today</span>
          ) : null}
          <span className="tabular">{items.length === 0 ? "Not in clinic" : `${open} available`}</span>
        </p>
      </div>
      <div className="min-w-0 flex-1">
        {items.length === 0 ? (
          <p className="text-callout text-muted md:pt-2">No clinic this day.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {items.map((slot, index) => (
              <SlotPill
                key={slot.id}
                slot={slot}
                status={statuses[index]!}
                checked={slot.id === heldId}
                onChoose={onChoose}
              />
            ))}
          </div>
        )}
        {sameDayClosed ? (
          <p className="mt-3 text-callout text-muted">
            Same-day booking closes at {practice.sameDayClose}. Call the desk for today.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SlotPill({
  slot,
  status,
  checked,
  onChoose,
}: {
  slot: Slot;
  status: SlotStatus;
  checked: boolean;
  onChoose: (slot: Slot) => void;
}) {
  const open = status === "open";
  return (
    <label className={`relative block ${open ? "cursor-pointer" : "cursor-not-allowed"}`}>
      <input
        type="radio"
        name="slot"
        value={slot.id}
        checked={checked}
        disabled={!open}
        onChange={() => onChoose(slot)}
        className="peer sr-only"
      />
      <motion.span
        whileTap={open ? { scale: 0.95 } : undefined}
        transition={spring.press}
        className={`tabular relative isolate flex h-11 items-center justify-center rounded-field text-callout font-medium transition-colors duration-200 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent/55 ${
          checked
            ? "text-white"
            : open
              ? "text-accent shadow-[inset_0_0_0_1px_var(--color-hairline)] hover:bg-accent-soft hover:shadow-[inset_0_0_0_1px_var(--color-accent)]"
              : "bg-fill text-muted line-through decoration-1"
        }`}
      >
        {checked ? (
          <motion.span
            layoutId="slot-highlight"
            transition={spring.snap}
            aria-hidden="true"
            className="absolute inset-0 -z-10 rounded-field bg-accent"
          />
        ) : null}
        {slot.time}
        {open ? null : <span className="sr-only">, {STATUS_TEXT[status]}</span>}
      </motion.span>
    </label>
  );
}
