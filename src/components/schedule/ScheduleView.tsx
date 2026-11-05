"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Alert, ChevronLeft } from "@/components/icons";
import { DoctorPortrait } from "@/components/doctors/DoctorPortrait";
import { useBooking } from "@/components/providers/BookingProvider";
import { useClock } from "@/components/providers/ClockProvider";
import { WeekPicker } from "./WeekPicker";
import { PageHeading } from "@/components/shell/PageHeading";
import { Notice } from "@/components/ui/Card";
import type { ConsultSession } from "@/lib/clinic-types";
import type { Doctor, Slot } from "@/lib/data";
import { describeSession } from "@/lib/sessions";
import { yearsLabel } from "@/lib/format";
import { spring } from "@/lib/motion";

interface Props {
  doctor: Doctor;
  slots: Slot[];
  initialWeek: string;
  /** Signed in as a patient. Otherwise Continue goes through sign-in first. */
  signedIn?: boolean;
  /** Where "All doctors" goes: the booking page for patients, the landing page otherwise. */
  allDoctorsHref?: string;
  /** The doctor's consulting sessions, shown above the times. */
  sessions?: ConsultSession[];
}

export function ScheduleView({ doctor, slots, initialWeek, signedIn = false, allDoctorsHref = "/#doctors", sessions = [] }: Props) {
  const { state } = useBooking();
  const { window } = useClock();
  const flashRef = useRef<HTMLDivElement>(null);
  const flash = state.flash?.doctorId === doctor.id ? state.flash.message : null;

  useEffect(() => {
    if (flash) flashRef.current?.focus();
  }, [flash]);

  const current = sessions.filter((session) => (session.onDate ?? session.endDate ?? "9999-12-31") >= window.today);

  return (
    <div className="mx-auto max-w-page px-5 pt-6 pb-16 md:px-8 md:pt-10">
      <Link
        href={allDoctorsHref}
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

      {sessions.length > 0 ? (
        <section aria-labelledby="sessions-title" className="mt-8">
          <h2 id="sessions-title" className="text-title3 font-semibold text-ink">
            Consulting sessions
          </h2>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {current.map((session) => (
              <li key={session.id} className="rounded-card bg-surface p-4 shadow-card">
                <p className="flex flex-wrap items-center gap-2 text-body font-semibold text-ink">
                  {session.label}
                  <span className="rounded-full bg-accent-soft px-2 py-px text-caption font-semibold text-accent">
                    {session.mode === "wave" ? "Wave" : "Stream"}
                  </span>
                </p>
                <p className="tabular mt-1 text-callout text-ink-2">{describeSession(session)}</p>
                <p className="mt-1 text-caption text-muted">
                  {session.room}.{" "}
                  {session.mode === "wave"
                    ? "Arrive within your wave. You are seen in token order."
                    : "Your time is yours alone."}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-10">
        <WeekPicker
          doctor={doctor}
          slots={slots}
          initialWeek={initialWeek}
          signedIn={signedIn}
          saturday={sessions.some((session) => session.weekdays.includes(6))}
          syncUrl
        />
      </div>
    </div>
  );
}
