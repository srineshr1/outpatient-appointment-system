"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { DoctorPortrait } from "@/components/doctors/DoctorPortrait";
import { useBooking } from "@/components/providers/BookingProvider";
import { useClock } from "@/components/providers/ClockProvider";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Card";
import { addDays, dayOfMonth, mondayOf, weekdayIndex } from "@/lib/clock";
import { practice, type Doctor, type Slot } from "@/lib/data";
import { formatMoney } from "@/lib/fees";
import { formatShortDate, formatWeekRange, formatWhen, monthLong, pluralise, weekdayLong } from "@/lib/format";
import { spring } from "@/lib/motion";
import { placesLabel, slotTimeLabel } from "@/lib/sessions";
import { canShiftWeek, clampWeek, openSlots, slotsOn, slotStatus, weekDays, type SlotStatus } from "@/lib/schedule";

const STATUS_TEXT: Record<Exclude<SlotStatus, "open">, string> = {
  taken: "booked",
  past: "closed",
  teaching: "teaching session",
};

interface Props {
  doctor: Doctor;
  slots: Slot[];
  initialWeek: string;
  signedIn?: boolean;
  /** Show Saturday even with no Saturday slots (the doctor has Saturday sessions). */
  saturday?: boolean;
  /** Keep ?week= in the URL in step (the standalone doctor page). */
  syncUrl?: boolean;
  /** h2 on the doctor page, h3 inside a doctor card. */
  headingLevel?: 2 | 3;
}

/** A week of day cards with start–end time pills, week navigation, and the Continue bar once a time is picked. */
export function WeekPicker({ doctor, slots, initialWeek, signedIn = false, saturday = false, syncUrl = false, headingLevel = 2 }: Props) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [continuing, startContinue] = useTransition();
  const { state, dispatch } = useBooking();
  const { now, window } = useClock();
  const [week, setWeek] = useState(initialWeek);
  const [direction, setDirection] = useState<1 | -1>(1);
  const Heading = headingLevel === 2 ? "h2" : "h3";

  const held =
    state.held && state.held.doctorId === doctor.id && slotStatus(state.held, [], now) === "open"
      ? state.held
      : null;

  useEffect(() => {
    if (!syncUrl) return;
    const url = new URL(globalThis.location.href);
    if (url.searchParams.get("week") === week) return;
    url.searchParams.set("week", week);
    globalThis.history.replaceState(globalThis.history.state, "", url);
  }, [week, syncUrl]);

  function goToWeek(next: string) {
    const target = clampWeek(next, window);
    if (target === week) return;
    setDirection(target > week ? 1 : -1);
    setWeek(target);
  }

  function choose(slot: Slot) {
    dispatch({ type: "hold", slot });
  }

  const withSaturday = saturday || slots.some((slot) => weekdayIndex(slot.date) === 6);
  const days = weekDays(week, withSaturday);
  const lastDay = days[days.length - 1]!;
  const weekSlots = slots.filter((slot) => slot.date >= week && slot.date <= lastDay);
  const openThisWeek = openSlots(weekSlots, [], now);
  const upcoming = openSlots(slots, [], now).find((slot) => slot.date > lastDay) ?? null;

  return (
    <>
      <section aria-labelledby={`week-title-${doctor.id}`} className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <Heading id={`week-title-${doctor.id}`} className="text-title3 font-semibold text-zinc-50">
              Choose a time
            </Heading>
            <p className="tabular mt-1 text-callout text-zinc-400" aria-live="polite">
              {formatWeekRange(week, days.length)} · {pluralise(openThisWeek.length, "time")} available
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
              transition={reduce ? { duration: 0 } : spring.gentle}
            >
              {openThisWeek.length === 0 ? (
                <Notice tone="info" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-zinc-200">
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
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      <AnimatePresence>
        {held ? (
          <motion.div
            key="continue"
            initial={reduce ? { opacity: 0 } : { y: 32, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 32, opacity: 0 }}
            transition={reduce ? { duration: 0 } : spring.gentle}
            className="sticky bottom-0 z-20 mt-6 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:bottom-4 md:mx-0 md:px-0 md:pb-0"
          >
            <div className="flex flex-col gap-3 rounded-sheet border border-white/12 bg-zinc-900/90 p-4 shadow-float backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between md:p-5">
              <div aria-live="polite" className="flex min-w-0 items-center gap-3">
                <DoctorPortrait doctor={doctor} size={48} className="hidden shrink-0 ring-1 ring-white/10 sm:block" />
                <div className="min-w-0">
                  <p className="text-caption text-zinc-400">Your selection</p>
                  <p className="text-body font-semibold text-zinc-50">{doctor.name}</p>
                  <p className="tabular text-callout text-zinc-300">
                    {weekdayLong(held.date)} {dayOfMonth(held.date)} {monthLong(held.date)} · {slotTimeLabel(held)}
                  </p>
                  <p className="tabular mt-1 flex flex-wrap gap-1.5 text-caption">
                    <span
                      className={`rounded-full border px-2 py-px font-semibold ${
                        held.mode === "wave"
                          ? "border-amber-400/25 bg-amber-400/12 text-amber-300"
                          : "border-cyan-400/25 bg-cyan-400/12 text-cyan-300"
                      }`}
                    >
                      {held.mode === "wave" ? `Wave · ${placesLabel(held)}` : "Stream · your own slot"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-fill px-2 py-px font-semibold text-zinc-200">
                      {typeof doctor.feePence === "number"
                        ? doctor.feePence > 0
                          ? `Fee ${formatMoney(doctor.feePence)}`
                          : "No fee"
                        : "Fee depends on visit reason"}
                    </span>
                  </p>
                  {held.mode === "wave" ? (
                    <p className="mt-1 text-caption text-zinc-400">You’ll get a token number and be seen in arrival order.</p>
                  ) : null}
                  {signedIn ? null : (
                    <p className="mt-0.5 text-caption text-zinc-400">Next, sign in. We’ll keep this time for you.</p>
                  )}
                </div>
              </div>
              <Button
                size="lg"
                className="w-full sm:w-auto"
                loading={continuing}
                loadingLabel="Continuing…"
                onClick={() =>
                  startContinue(() =>
                    router.push(signedIn ? "/book/details" : `/sign-in?next=${encodeURIComponent("/book/details")}`),
                  )
                }
              >
                Continue
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
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
      className="grid size-11 place-items-center rounded-full border border-hairline bg-surface text-cyan-300 shadow-card transition-colors hover:border-cyan-400/30 hover:bg-cyan-400/12 disabled:cursor-not-allowed disabled:border-white/[0.05] disabled:bg-fill disabled:text-zinc-500 disabled:shadow-none"
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
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-card md:flex md:gap-6 md:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3 md:mb-0 md:block md:w-52 md:shrink-0">
        <h3 className="text-body font-semibold text-zinc-50">
          {weekdayLong(iso)} {dayOfMonth(iso)} {monthLong(iso)}
        </h3>
        <p className="mt-0.5 flex items-center gap-2 text-callout text-zinc-400">
          {isToday ? (
            <span className="rounded-full border border-cyan-400/25 bg-cyan-400/12 px-2 py-px text-caption font-semibold text-cyan-300">
              Today
            </span>
          ) : null}
          <span className="tabular">{items.length === 0 ? "Not in clinic" : `${open} available`}</span>
        </p>
      </div>
      <div className="min-w-0 flex-1">
        {items.length === 0 ? (
          <p className="text-callout text-zinc-400 md:pt-2">No clinic this day.</p>
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
          <p className="mt-3 text-callout text-zinc-400">
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
        className={`tabular relative isolate flex ${slot.mode === "wave" ? "min-h-14 flex-col py-1" : "h-11"} items-center justify-center rounded-field text-callout transition-colors duration-200 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent/65 ${
          checked
            ? "font-semibold text-zinc-950"
            : open
              ? "bg-white/[0.02] font-medium text-cyan-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] hover:bg-cyan-400/12 hover:shadow-[inset_0_0_0_1px_var(--color-accent)]"
              : "bg-fill/70 font-medium text-zinc-400 line-through decoration-1"
        }`}
      >
        {checked ? (
          <motion.span
            layoutId="slot-highlight"
            transition={spring.snap}
            aria-hidden="true"
            className="absolute inset-0 -z-10 rounded-field bg-accent shadow-[0_0_16px_rgba(34,211,238,0.35)]"
          />
        ) : null}
        {slotTimeLabel(slot)}
        {slot.mode === "wave" ? (
          <span className={`text-caption font-normal ${checked ? "text-zinc-900/90" : "text-zinc-400"}`}>{placesLabel(slot)}</span>
        ) : null}
        {open ? null : <span className="sr-only">, {STATUS_TEXT[status]}</span>}
      </motion.span>
    </label>
  );
}
