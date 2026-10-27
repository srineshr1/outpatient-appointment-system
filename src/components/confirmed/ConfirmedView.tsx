"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AppointmentSummary } from "@/components/booking/AppointmentSummary";
import { Calendar } from "@/components/icons";
import { useBooking } from "@/components/providers/BookingProvider";
import { useClock } from "@/components/providers/ClockProvider";
import { PageHeading } from "@/components/shell/PageHeading";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { practice, reasons, type Doctor } from "@/lib/data";
import { dayOfMonth } from "@/lib/clock";
import { ageLabel, formatPhone, monthLong, weekdayLong } from "@/lib/format";
import { downloadIcs } from "@/lib/ics";
import { spring } from "@/lib/motion";

function SuccessMark() {
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...spring.gentle, delay: 0.05 }}
      className="grid size-16 place-items-center rounded-full bg-success text-white md:size-20"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="size-8 md:size-10" fill="none" stroke="currentColor" strokeWidth={2.6}>
        <motion.path
          d="M5 12.5 10 17.5 19 7"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
    </motion.div>
  );
}

export function ConfirmedView({ doctors }: { doctors: Doctor[] }) {
  const router = useRouter();
  const { state, dispatch, ready } = useBooking();
  const { now, window } = useClock();
  const booking = state.booking;
  const doctor = booking ? (doctors.find((item) => item.id === booking.doctorId) ?? null) : null;
  const reason = booking ? (reasons.find((item) => item.id === booking.reasonId) ?? null) : null;

  useEffect(() => {
    if (ready && (!booking || !doctor || !reason)) router.replace("/book");
  }, [ready, booking, doctor, reason, router]);

  if (!ready || !booking || !doctor || !reason) {
    return (
      <div className="mx-auto max-w-page px-5 pt-10 md:px-8" aria-busy="true">
        <div className="h-10 w-64 animate-pulse rounded-field bg-fill" />
      </div>
    );
  }

  const { patient, slot, reference } = booking;
  const chi = patient?.chi.replace(/\s/g, "") ?? "";

  function startOver() {
    dispatch({ type: "startOver" });
    router.push("/book");
  }

  return (
    <div className="mx-auto max-w-page px-5 pt-10 pb-20 md:px-8 md:pt-16">
      <div className="mx-auto max-w-2xl text-center">
        <div className="flex justify-center">
          <SuccessMark />
        </div>
        <PageHeading className="mt-6 text-title1 font-semibold text-ink md:text-hero">You’re booked</PageHeading>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.gentle, delay: 0.15 }}
        >
          <p className="mt-3 text-title3 font-normal text-ink-2">
            {patient ? `We’ll see ${patient.name.trim().split(/\s+/)[0]}` : "We’ll see you"}{" "}
            {slot.date === window.today
              ? "today"
              : `on ${weekdayLong(slot.date)} ${dayOfMonth(slot.date)} ${monthLong(slot.date)}`}{" "}
            at <span className="tabular">{slot.time}</span> with {doctor.short}.
          </p>
          <p className="mt-6 text-callout text-muted">Booking reference</p>
          <p className="tabular mt-1 text-title2 font-semibold tracking-wide text-ink select-all">{reference}</p>
          <p className="mt-4 text-callout">
            <Link href="/appointments" className="text-accent hover:underline underline-offset-4">
              View your appointments
            </Link>
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              onClick={() =>
                downloadIcs(
                  {
                    reference,
                    doctorName: doctor.name,
                    room: doctor.room,
                    date: slot.date,
                    time: slot.time,
                    minutes: reason.minutes,
                    reasonLabel: reason.label,
                  },
                  now,
                )
              }
            >
              <Calendar size={20} />
              Add to calendar
            </Button>
            <Button size="lg" variant="secondary" onClick={startOver}>
              Book another appointment
            </Button>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring.gentle, delay: 0.3 }}
        className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-2"
      >
        <AppointmentSummary doctor={doctor} slot={slot} reason={reason} />
        <Card className="p-5 md:p-6">
          <h2 className="text-callout font-semibold text-muted">Before you come</h2>
          <dl className="mt-4 grid gap-4 text-body">
            {patient ? (
              <Item term="Patient">
                {patient.name.trim()}, {ageLabel(patient.dob, window.today)}
                <span className="block text-callout text-muted tabular">{formatPhone(patient.mobile)}</span>
              </Item>
            ) : null}
            <Item term="Visit">{reason.label}</Item>
            <Item term="Bring">
              {chi ? `Your CHI number (${chi}).` : "Your CHI number, if you have it."} Please arrive five minutes early.
            </Item>
            <Item term="Can’t make it?">
              Cancel the visit from{" "}
              <Link href="/appointments" className="text-accent hover:underline underline-offset-4">
                your appointments
              </Link>
              , or call{" "}
              <a href={practice.phoneHref} className="tabular text-accent hover:underline underline-offset-4">
                {practice.phoneDisplay}
              </a>{" "}
              with at least two hours’ notice, so someone else can have the time.
            </Item>
          </dl>
          {patient?.note.trim() ? (
            <div className="mt-4 border-t border-hairline pt-4">
              <p className="text-callout font-semibold text-ink">Your note for {doctor.short}</p>
              <p className="mt-1 text-callout text-ink-2 whitespace-pre-line">{patient.note.trim()}</p>
            </div>
          ) : null}
        </Card>
      </motion.div>
    </div>
  );
}

function Item({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-callout font-semibold text-ink">{term}</dt>
      <dd className="mt-0.5 text-ink-2">{children}</dd>
    </div>
  );
}
