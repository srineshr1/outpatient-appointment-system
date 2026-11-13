"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DoctorPortrait } from "@/components/doctors/DoctorPortrait";
import { DoctorDirectory } from "@/components/directory/DoctorDirectory";
import { Calendar, Check, Clock, Lock, Phone, Pin } from "@/components/icons";
import { useClock } from "@/components/providers/ClockProvider";
import { PageHeading } from "@/components/shell/PageHeading";
import { AuroraBackground } from "@/components/ui/AuroraBackground";
import { GradientBadge } from "@/components/ui/GradientBadge";
import { ShinyText } from "@/components/ui/ShinyText";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
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
  { left: 34, top: 4, size: 168, delay: 0.03, rotate: -3 },
  { left: 2, top: 30, size: 120, delay: 0.06, rotate: 4 },
  { left: 70, top: 26, size: 128, delay: 0.09, rotate: 3 },
  { left: 12, top: 66, size: 112, delay: 0.12, rotate: -4 },
  { left: 60, top: 66, size: 116, delay: 0.15, rotate: 2 },
];

export function LandingPage({ doctors, upcoming, role }: Props) {
  const { now, window } = useClock();
  const bookHref = role === null ? `/sign-in?next=${encodeURIComponent("/book")}` : role === "patient" ? "/book" : "#doctors";

  const soonest = doctors
    .map((doctor) => ({ doctor, slot: (upcoming[doctor.id] ?? []).find((slot) => slotStatus(slot, [], now) === "open") }))
    .filter((item): item is { doctor: Doctor; slot: Slot } => Boolean(item.slot))
    .sort((a, b) => (a.slot.date === b.slot.date ? a.slot.time.localeCompare(b.slot.time) : a.slot.date.localeCompare(b.slot.date)))[0];

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative isolate overflow-hidden">
        <AuroraBackground className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 opacity-35 [background-image:radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_75%_70%_at_50%_30%,#000_20%,transparent_100%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-48 -left-40 -z-10 size-[44rem] rounded-full bg-[radial-gradient(circle,var(--color-accent-soft)_0%,transparent_65%)]"
          />
          <div className="relative z-10 mx-auto grid max-w-page items-center gap-10 px-5 pt-10 pb-8 md:px-8 md:pt-16 lg:grid-cols-12 lg:gap-6">
            <motion.div
              className="lg:order-2 lg:col-span-6"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring.gentle}
            >
              <GradientBadge className="border-accent/25 dark:border-cyan-400/25 bg-accent/12 dark:bg-cyan-400/12 text-accent dark:text-cyan-300">
                <Pin size={15} />
                {practice.name}, Edinburgh
              </GradientBadge>
              <PageHeading className="mt-5 text-title1 font-bold text-ink md:text-hero">
                <ShinyText speed={5} className="pb-1">
                  Book your GP in under a minute.
                </ShinyText>
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
                  <Link href="/sign-in" className="btn-chunky btn-chunky-secondary sm:w-auto">
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
              <ul className="mt-8 grid max-w-lg grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-callout text-ink-2">
                <Perk>Pay online or at the desk</Perk>
                <Perk>Book up to 4 weeks ahead</Perk>
                <Perk>Same day until {practice.sameDayClose}</Perk>
                <Perk>Cancel online any time</Perk>
              </ul>
            </motion.div>

            {/* Portrait collage */}
            <div className="relative mx-auto aspect-square w-full max-w-[30rem] lg:order-1 lg:col-span-6" aria-hidden="true">
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
                    <div className="rounded-[28%] border border-ink/12 bg-surface/80 dark:bg-zinc-900/80 p-1.5 shadow-raised">
                      <DoctorPortrait doctor={doctor} size={spot.size} shape="rounded" className="h-auto w-full" />
                    </div>
                  </motion.div>
                );
              })}

              {soonest ? (
                <motion.div
                  className="absolute bottom-[34%] left-1/2 w-max rounded-2xl border border-ink/12 bg-surface/90 dark:bg-zinc-900/90 px-4 py-3 shadow-raised backdrop-blur-md"
                  style={{ x: "-50%" }}
                  initial={{ opacity: 0, y: 12, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ ...spring.press, delay: 0.16 }}
                >
                  <p className="flex items-center gap-2 text-caption font-bold text-emerald-700 dark:text-emerald-300">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    </span>
                    Next available
                  </p>
                  <p className="tabular mt-0.5 text-callout font-bold text-ink">
                    {soonest.doctor.short} · {formatWhen(soonest.slot, window.today)}
                  </p>
                </motion.div>
              ) : null}

              <motion.div
                className="absolute top-[6%] right-[2%] flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1.5 text-caption font-bold text-emerald-700 dark:text-emerald-300 shadow-raised backdrop-blur-md"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...spring.press, delay: 0.18 }}
              >
                <Check size={14} strokeWidth={3} />
                You’re booked
              </motion.div>
            </div>
          </div>
        </AuroraBackground>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how-it-works" aria-labelledby="how-title" className="mx-auto max-w-page px-5 pt-16 md:px-8 md:pt-20">
        <p className="text-callout font-bold tracking-wide text-accent dark:text-cyan-300 uppercase">How it works</p>
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
        <div className="mt-4 grid gap-4 rounded-sheet border border-ink/10 bg-surface/80 dark:bg-zinc-900/80 p-6 shadow-card md:grid-cols-3 md:p-8 [background:radial-gradient(ellipse_75%_60%_at_15%_0%,rgba(34,211,238,0.08),transparent_60%),radial-gradient(ellipse_60%_60%_at_85%_100%,rgba(168,85,247,0.08),transparent_60%),rgba(24,24,27,0.85)]">
          <div>
            <p className="text-callout font-bold text-muted">Visit us</p>
            <p className="mt-1 text-body text-ink">{practice.address}</p>
          </div>
          <div>
            <p className="text-callout font-bold text-muted">Opening hours</p>
            <p className="mt-1 text-body text-ink">{practice.hours}</p>
          </div>
          <div>
            <p className="text-callout font-bold text-muted">Rather talk to someone?</p>
            <a
              href={practice.phoneHref}
              className="tabular mt-1 inline-flex min-h-11 items-center gap-2 text-body font-bold text-accent dark:text-cyan-300 underline-offset-4 hover:text-accent dark:hover:text-cyan-200 hover:underline"
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
    <li className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-400/30"
      >
        <Check size={12} strokeWidth={3.2} />
      </span>
      {children}
    </li>
  );
}

function Step({ number, icon, title, children }: { number: number; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <SpotlightCard as="li" className="p-5 md:p-6">
      <span className="relative z-10 flex items-center justify-between">
        <span
          aria-hidden="true"
          className="grid size-11 place-items-center rounded-2xl bg-accent/12 dark:bg-cyan-400/12 text-accent dark:text-cyan-300 ring-1 ring-accent/25 dark:ring-cyan-400/25"
        >
          {icon}
        </span>
        <span aria-hidden="true" className="tabular text-title1 font-bold text-zinc-300 dark:text-zinc-700">
          {number}
        </span>
      </span>
      <h3 className="relative z-10 mt-4 text-body font-bold text-ink">
        <span className="sr-only">Step {number}: </span>
        {title}
      </h3>
      <p className="relative z-10 mt-1 text-callout text-ink-2">{children}</p>
    </SpotlightCard>
  );
}

function Fact({ term, detail }: { term: string; detail: string }) {
  return (
    <SpotlightCard className="p-5">
      <dt className="relative z-10 text-callout font-bold text-ink">{term}</dt>
      <dd className="relative z-10 mt-1 text-callout text-ink-2">{detail}</dd>
    </SpotlightCard>
  );
}
