"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DoctorPortrait } from "@/components/doctors/DoctorPortrait";
import { DoctorDirectory } from "@/components/directory/DoctorDirectory";
import { Calendar, Check, Clock, Lock, Phone, Pin } from "@/components/icons";
import { useClock } from "@/components/providers/ClockProvider";
import { PageHeading } from "@/components/shell/PageHeading";
import { practice, type Doctor, type Slot } from "@/lib/data";
import { formatWhen } from "@/lib/format";
import { spring } from "@/lib/motion";
import { slotStatus } from "@/lib/schedule";

interface Props {
  doctors: Doctor[];
  upcoming: Record<string, Slot[]>;
  /** null when signed out. */
  role: "patient" | "staff" | null;
}

/** Where each portrait sits in the hero collage (percent of the box), and how big it is. */
const COLLAGE = [
  { left: 34, top: 4, size: 168, delay: 0.05, rotate: -3 },
  { left: 2, top: 30, size: 120, delay: 0.15, rotate: 4 },
  { left: 70, top: 26, size: 128, delay: 0.25, rotate: 3 },
  { left: 12, top: 66, size: 112, delay: 0.35, rotate: -4 },
  { left: 60, top: 66, size: 116, delay: 0.45, rotate: 2 },
];

export function LandingPage({ doctors, upcoming, role }: Props) {
  const { now, window } = useClock();
  const bookHref = role === null ? `/sign-in?next=${encodeURIComponent("/#doctors")}` : "#doctors";

  const soonest = doctors
    .map((doctor) => ({ doctor, slot: (upcoming[doctor.id] ?? []).find((slot) => slotStatus(slot, [], now) === "open") }))
    .filter((item): item is { doctor: Doctor; slot: Slot } => Boolean(item.slot))
    .sort((a, b) => (a.slot.date === b.slot.date ? a.slot.time.localeCompare(b.slot.time) : a.slot.date.localeCompare(b.slot.date)))[0];

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-48 -right-40 -z-10 size-[44rem] rounded-full bg-[radial-gradient(circle,var(--color-accent-soft)_0%,transparent_65%)]"
        />
        <div className="mx-auto grid max-w-page items-center gap-10 px-5 pt-10 pb-6 md:px-8 md:pt-16 lg:grid-cols-12 lg:gap-6">
          <motion.div
            className="lg:col-span-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.gentle}
          >
            <p className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-caption font-bold text-ink-2 shadow-card">
              <Pin size={16} className="text-accent" />
              {practice.name}, Edinburgh
            </p>
            <PageHeading className="mt-5 text-title1 font-bold text-ink md:text-hero">
              Book your GP in under a minute.
            </PageHeading>
            <p className="mt-4 max-w-prose text-title3 font-normal text-ink-2">
              Choose one of our doctors, pick a time that suits you and get a calendar invite. No phone queue at 8am.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={bookHref} className="btn-chunky btn-chunky-primary sm:w-auto">
                <Calendar size={20} />
                Book an appointment
              </Link>
              {role === null ? (
                <Link href="/register" className="btn-chunky btn-chunky-secondary sm:w-auto">
                  Create an account
                </Link>
              ) : (
                <Link
                  href={role === "patient" ? "/appointments" : "/dashboard"}
                  className="btn-chunky btn-chunky-secondary sm:w-auto"
                >
                  {role === "patient" ? "Your appointments" : "Clinic book"}
                </Link>
              )}
            </div>
            <ul className="mt-8 grid max-w-lg grid-cols-2 gap-x-6 gap-y-3 text-callout text-ink-2">
              <Perk>NHS visits, no charge</Perk>
              <Perk>Book up to 4 weeks ahead</Perk>
              <Perk>Same day until {practice.sameDayClose}</Perk>
              <Perk>Cancel online any time</Perk>
            </ul>
          </motion.div>

          {/* Portrait collage */}
          <div className="relative mx-auto aspect-square w-full max-w-[30rem] lg:col-span-6" aria-hidden="true">
            {doctors.slice(0, COLLAGE.length).map((doctor, index) => {
              const spot = COLLAGE[index]!;
              return (
                <motion.div
                  key={doctor.id}
                  className="absolute"
                  style={{ left: `${spot.left}%`, top: `${spot.top}%`, width: `${(spot.size / 480) * 100}%` }}
                  initial={{ opacity: 0, scale: 0.6, y: 24, rotate: 0 }}
                  animate={{ opacity: 1, scale: 1, y: 0, rotate: spot.rotate }}
                  transition={{ ...spring.press, delay: spot.delay }}
                  whileHover={{ scale: 1.06, rotate: 0 }}
                >
                  <div className="rounded-[28%] bg-surface p-1.5 shadow-raised">
                    <DoctorPortrait doctor={doctor} size={spot.size} shape="rounded" className="h-auto w-full" />
                  </div>
                </motion.div>
              );
            })}

            {soonest ? (
              <motion.div
                className="absolute bottom-[34%] left-1/2 w-max rounded-2xl bg-surface px-4 py-3 shadow-raised"
                style={{ x: "-50%" }}
                initial={{ opacity: 0, y: 12, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ ...spring.press, delay: 0.7 }}
              >
                <p className="flex items-center gap-2 text-caption font-bold text-success">
                  <span className="size-2 rounded-full bg-success" />
                  Next available
                </p>
                <p className="tabular mt-0.5 text-callout font-bold text-ink">
                  {soonest.doctor.short} · {formatWhen(soonest.slot, window.today)}
                </p>
              </motion.div>
            ) : null}

            <motion.div
              className="absolute top-[6%] right-[2%] flex items-center gap-2 rounded-full bg-success px-3 py-1.5 text-caption font-bold text-white shadow-raised"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...spring.press, delay: 0.9 }}
            >
              <Check size={14} strokeWidth={3} />
              You’re booked
            </motion.div>
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section aria-labelledby="how-title" className="mx-auto max-w-page px-5 pt-16 md:px-8 md:pt-20">
        <p className="text-callout font-bold tracking-wide text-accent uppercase">How it works</p>
        <h2 id="how-title" className="mt-2 text-title1 font-bold text-ink">
          Four steps. That’s it.
        </h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Step number={1} icon={<Lock size={22} />} title="Sign in">
            Use your patient account, or create one in a minute.
          </Step>
          <Step number={2} icon={<Pin size={22} />} title="Choose a doctor">
            See who’s in, what they focus on and when they’re free.
          </Step>
          <Step number={3} icon={<Clock size={22} />} title="Pick a time">
            Tap a time in the next four weeks. We hold it while you finish.
          </Step>
          <Step number={4} icon={<Check size={22} strokeWidth={2.4} />} title="You’re booked">
            Get a reference and a calendar invite. Cancel online if plans change.
          </Step>
        </ol>
      </section>

      <DoctorDirectory doctors={doctors} upcoming={upcoming} />

      {/* ---------- Practice ---------- */}
      <section aria-labelledby="practice-title" className="mx-auto max-w-page px-5 pt-16 pb-20 md:px-8 md:pt-24">
        <h2 id="practice-title" className="text-title2 font-bold text-ink">
          Good to know
        </h2>
        <dl className="mt-6 grid gap-4 md:grid-cols-3">
          <Fact term="Same-day visits" detail={`Book online until ${practice.sameDayClose}. After that, call the desk.`} />
          <Fact term="Visit length" detail="10 or 15 minutes, depending on the reason for your visit." />
          <Fact term="New patients" detail="Register with the practice by phone first. Online booking is for registered patients." />
        </dl>
        <div className="mt-4 grid gap-4 rounded-sheet bg-ink p-6 text-white md:grid-cols-3 md:p-8">
          <div>
            <p className="text-callout font-bold text-white/70">Visit us</p>
            <p className="mt-1 text-body">{practice.address}</p>
          </div>
          <div>
            <p className="text-callout font-bold text-white/70">Opening hours</p>
            <p className="mt-1 text-body">{practice.hours}</p>
          </div>
          <div>
            <p className="text-callout font-bold text-white/70">Rather talk to someone?</p>
            <a
              href={practice.phoneHref}
              className="tabular mt-1 inline-flex min-h-11 items-center gap-2 text-body font-bold text-white underline-offset-4 hover:underline"
            >
              <Phone size={18} />
              {practice.phoneDisplay}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

function Perk({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-success text-white">
        <Check size={12} strokeWidth={3.2} />
      </span>
      {children}
    </li>
  );
}

function Step({ number, icon, title, children }: { number: number; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="relative rounded-sheet bg-surface p-5 shadow-card md:p-6">
      <span className="flex items-center justify-between">
        <span aria-hidden="true" className="grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent">
          {icon}
        </span>
        <span aria-hidden="true" className="tabular text-title1 font-bold text-fill-strong">
          {number}
        </span>
      </span>
      <h3 className="mt-4 text-body font-bold text-ink">
        <span className="sr-only">Step {number}: </span>
        {title}
      </h3>
      <p className="mt-1 text-callout text-ink-2">{children}</p>
    </li>
  );
}

function Fact({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="rounded-sheet bg-surface p-5 shadow-card">
      <dt className="text-callout font-bold text-ink">{term}</dt>
      <dd className="mt-1 text-callout text-ink-2">{detail}</dd>
    </div>
  );
}
