import type { Metadata } from "next";
import Link from "next/link";
import { practice } from "@/lib/data";

export const metadata: Metadata = {
  title: "24/7 Rapid Emergency & Level-1 Trauma Center · Westbrook Medical Practice",
  description:
    "Uncompromising rapid response: sub-38 minute door-to-balloon time, rooftop helipad, dedicated stroke unit, and pediatric emergency bays.",
};

// Clean, accessible SVG icons designed for high-contrast emergency UI
function SirenIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2v3M4.93 4.93l2.12 2.12M2 12h3M19.07 4.93l-2.12 2.12M22 12h-3" />
      <path d="M12 6a7 7 0 0 0-7 7v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a7 7 0 0 0-7-7Z" />
      <path d="M9 17h6" />
    </svg>
  );
}

function HelipadIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 8v8M16 8v8M8 12h8" />
    </svg>
  );
}

function BrainIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 2A4.5 4.5 0 0 0 5 6.5c0 .76.19 1.48.52 2.11A4.5 4.5 0 0 0 4 12.5a4.5 4.5 0 0 0 2.22 3.9A4.5 4.5 0 0 0 11 20.95V17a2 2 0 0 1 2-2" />
      <path d="M14.5 2A4.5 4.5 0 0 1 19 6.5c0 .76-.19 1.48-.52 2.11A4.5 4.5 0 0 1 20 12.5a4.5 4.5 0 0 1-2.22 3.9A4.5 4.5 0 0 1 13 20.95V17a2 2 0 0 0-2-2" />
      <path d="M12 2v20" />
    </svg>
  );
}

function HeartPulseIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.22 12H7l2.5-4 3.5 8 2.5-5 1.5 3h3.78" />
    </svg>
  );
}

function PediatricIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="7" r="4" />
      <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
      <path d="M9 13v2m6-2v2" />
    </svg>
  );
}

function ShieldAlertIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

function PhoneCallIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function NavigationIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  );
}

function ActivityIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function CheckCircleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ClockIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export default function EmergencyPage() {
  return (
    <div className="relative min-h-screen bg-zinc-50 text-zinc-900 transition-colors duration-200 dark:bg-zinc-950 dark:text-zinc-100">
      {/* -------------------- Top Urgent Advisory Bar -------------------- */}
      <aside
        aria-label="Critical Emergency Hotline"
        className="sticky top-0 z-40 border-b border-red-500/20 bg-red-600 text-white shadow-md shadow-red-900/10 dark:border-red-600/30 dark:bg-red-700"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold tracking-tight">
            <span className="flex size-2.5 shrink-0 rounded-full bg-white shadow-sm ring-2 ring-white/50 animate-pulse" />
            <span className="font-bold uppercase tracking-wider text-red-100">Critical Emergency:</span>
            <span className="hidden md:inline">For immediate life-threatening trauma, stroke, or heart attack, call</span>
            <span className="inline md:hidden">Hotline:</span>
            <a
              href="tel:08009999111"
              className="inline-flex items-center gap-1 font-mono text-base font-extrabold text-white underline decoration-white/70 underline-offset-4 hover:decoration-white"
            >
              0800-999-9111
            </a>
            <span className="hidden sm:inline text-red-200">or 999</span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="tel:08009999111"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 text-xs font-bold text-red-700 shadow-sm transition hover:bg-red-50 active:scale-95"
            >
              <PhoneCallIcon className="size-3.5" />
              <span>Call 24/7 Hotline</span>
            </a>
          </div>
        </div>
      </aside>

      {/* -------------------- Hero Section -------------------- */}
      <section className="relative overflow-hidden border-b border-zinc-200 bg-white py-14 sm:py-20 lg:py-24 dark:border-zinc-800 dark:bg-zinc-900">
        {/* Subtle radial emergency glow accents */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 right-1/2 h-96 w-96 translate-x-1/2 rounded-full bg-red-500/10 blur-3xl dark:bg-red-500/5"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-10 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl dark:bg-amber-500/5"
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start gap-4">
            {/* Level-1 Trauma Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-red-500" />
              </span>
              <span>Designated Level-1 Trauma &amp; Comprehensive Stroke Center</span>
            </div>

            {/* High-Impact Headline */}
            <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl dark:text-zinc-50">
              Every Second Counts.{" "}
              <span className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 bg-clip-text text-transparent dark:from-red-400 dark:via-rose-400 dark:to-amber-400">
                When Critical Seconds Matter, We Lead.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-2 max-w-3xl text-lg text-zinc-600 sm:text-xl dark:text-zinc-300">
              Westbrook Medical Practice operates Scotland’s premier rapid-response emergency infrastructure. With an on-site all-weather trauma helipad, sub-38 minute door-to-balloon cardiac intervention, mobile stroke CT ambulances, and fellowship-trained trauma teams continuously on duty, we turn critical minutes into saved lives.
            </p>

            {/* Action Buttons */}
            <div className="mt-4 flex flex-wrap items-center gap-3 sm:gap-4">
              <a
                href="tel:08009999111"
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-red-600/25 transition-all hover:bg-red-700 hover:shadow-red-600/40 active:scale-[0.98]"
              >
                <PhoneCallIcon className="size-5" />
                <span>Emergency Hotline: 0800-999-9111</span>
              </a>

              <a
                href="#directions"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 py-3.5 text-base font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-700"
              >
                <NavigationIcon className="size-5 text-red-500 dark:text-red-400" />
                <span>Ambulance Bay &amp; GPS Directions</span>
              </a>

              <Link
                href="/book"
                className="inline-flex items-center gap-1.5 px-4 py-3.5 text-sm font-semibold text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <span>Non-emergency GP consultation?</span>
                <span className="text-red-600 underline dark:text-red-400">Book here &rarr;</span>
              </Link>
            </div>
          </div>

          {/* -------------------- Hero Stats Strip -------------------- */}
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Stat 1 */}
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 backdrop-blur-sm transition-all hover:border-red-300 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-red-900">
              <div className="flex items-center justify-between text-xs font-semibold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                <span>STEMI Intervention</span>
                <ActivityIcon className="size-4 text-red-500" />
              </div>
              <div className="mt-3 text-3xl font-extrabold tracking-tight text-red-600 sm:text-4xl dark:text-red-400">
                &lt;38 min
              </div>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Door-to-Balloon Average
              </p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Over 52 minutes faster than international 90-minute clinical guidelines. Dual catheterization teams on site.
              </p>
            </div>

            {/* Stat 2 */}
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 backdrop-blur-sm transition-all hover:border-amber-300 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-amber-900">
              <div className="flex items-center justify-between text-xs font-semibold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                <span>Rooftop Helipad</span>
                <HelipadIcon className="size-4 text-amber-500" />
              </div>
              <div className="mt-3 text-3xl font-extrabold tracking-tight text-amber-600 sm:text-4xl dark:text-amber-400">
                &lt;3 min
              </div>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Helipad-to-Bay Transit
              </p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Direct hydraulic trauma elevator connects landing pad to Level-1 shock resuscitation bays in under 180 seconds.
              </p>
            </div>

            {/* Stat 3 */}
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 backdrop-blur-sm transition-all hover:border-emerald-300 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-emerald-900">
              <div className="flex items-center justify-between text-xs font-semibold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                <span>Surgical Readiness</span>
                <ClockIcon className="size-4 text-emerald-500" />
              </div>
              <div className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-100">
                24/7/365
              </div>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                On-Site Trauma Surgeons
              </p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Board-certified attending trauma surgeons and interventionalists scrubbed on-site with zero home on-call delays.
              </p>
            </div>

            {/* Stat 4 */}
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 backdrop-blur-sm transition-all hover:border-rose-300 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-rose-900">
              <div className="flex items-center justify-between text-xs font-semibold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                <span>Clinical Outcomes</span>
                <CheckCircleIcon className="size-4 text-rose-500" />
              </div>
              <div className="mt-3 text-3xl font-extrabold tracking-tight text-rose-600 sm:text-4xl dark:text-rose-400">
                99.9%
              </div>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Critical Survival Index
              </p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Exceeding national tertiary benchmarks for severe multi-system trauma and neurovascular rescue.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- Live Emergency Department Status Indicator -------------------- */}
      <section id="status" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-100 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950 sm:p-8">
          <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-6 md:flex-row md:items-center dark:border-zinc-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex size-3">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Live Emergency Department Telemetry
                </span>
              </div>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Operational Status &amp; Real-Time Capacity
              </h2>
            </div>

            <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span>Full Capacity &amp; Open 24/7</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Live Metric 1 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Average Triage Wait
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">0 mins</span>
                <span className="text-xs font-semibold text-zinc-500">triage wait</span>
              </div>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                Immediate clinical intake and resuscitation bay placement for acute emergent cases.
              </p>
            </div>

            {/* Live Metric 2 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Active Resuscitation Bays
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">12 / 12</span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">100% Ready</span>
              </div>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                Fully prepped shock resuscitation bays with invasive hemodynamics and rapid blood warmers.
              </p>
            </div>

            {/* Live Metric 3 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Trauma Helipad Deck
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">Clear</span>
                <span className="text-xs font-semibold text-zinc-500">VFR &amp; IFR Ready</span>
              </div>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                All-weather de-icing active. Approach path illuminated for adverse weather landings.
              </p>
            </div>

            {/* Live Metric 4 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Diagnostic Cath &amp; CT
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">Standby</span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Zero Wait</span>
              </div>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                Dual 256-slice dual-source stat CT and biplane cath labs hot-standby for instant activation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- Core Emergency Capabilities & Specialized Units -------------------- */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
            <SirenIcon className="size-4" />
            <span>Unmatched Capabilities</span>
          </div>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-100">
            Specialized Critical Care &amp; Resuscitation Units
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
            Engineered from foundation to rooftop for zero bottlenecks. Each dedicated wing possesses its own sub-specialty team, rapid diagnostics, and immediate operative capacity.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {/* Unit 1: Rooftop All-Weather Trauma Helipad */}
          <div
            id="helipad"
            className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-amber-400 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-amber-500/50"
          >
            <div>
              <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                <HelipadIcon className="size-8" />
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold uppercase text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  Aviation Trauma
                </span>
                <span className="text-xs font-semibold text-zinc-500">24/7 Air Hub</span>
              </div>

              <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Rooftop All-Weather Trauma Helipad
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Engineered for maximum survivability when transporting poly-trauma patients across Scotland and offshore medical evacuation routes.
              </p>

              <ul className="mt-4 space-y-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span><strong>Direct Dedicated Trauma Elevator:</strong> Transits patients from rotor touchdown to Resuscitation Bay 1 in under 180 seconds.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span><strong>High-Altitude Night Vision Capability:</strong> Infrared approach beacons and FAA/CAA Category H3 rated for zero-visibility adverse conditions.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span><strong>Regional Air Ambulance Coordination:</strong> Direct encrypted radio dispatch link with Scottish Ambulance Service &amp; HM Coastguard.</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 border-t border-zinc-100 pt-4 text-xs font-semibold text-amber-700 dark:border-zinc-800 dark:text-amber-400">
              Heated deck &middot; Dual-engine helicopter rated (up to 12 metric tonnes)
            </div>
          </div>

          {/* Unit 2: Acute Neurovascular Stroke Fast-Track */}
          <div
            id="stroke"
            className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-red-400 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-red-500/50"
          >
            <div>
              <div className="flex size-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                <BrainIcon className="size-8" />
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold uppercase text-red-800 dark:bg-red-950/60 dark:text-red-300">
                  Comprehensive Stroke Center
                </span>
                <span className="text-xs font-semibold text-zinc-500">&lt;20 min Interventions</span>
              </div>

              <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Acute Neurovascular Stroke Fast-Track
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Every minute saves 1.9 million brain cells. Our mobile and intra-hospital stroke protocols eliminate every non-clinical delay.
              </p>

              <ul className="mt-4 space-y-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
                  <span><strong>Mobile Stroke Ambulance with On-Board CT:</strong> Immediate brain imaging and telemedicine consult before reaching hospital doors.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
                  <span><strong>Automated tPA &amp; Thrombectomy within 20 mins:</strong> Door-to-needle thrombolytic therapy and emergent endovascular clot retrieval.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
                  <span><strong>Biplane Neuro-Intervention Suite:</strong> High-resolution 3D vascular imaging with round-the-clock endovascular neurosurgeons.</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 border-t border-zinc-100 pt-4 text-xs font-semibold text-red-700 dark:border-zinc-800 dark:text-red-400">
              World Stroke Organization Diamond Award &middot; 24/7 Neuro-ICU step-up
            </div>
          </div>

          {/* Unit 3: Rapid Cardiac Catheterization & STEMI Response */}
          <div
            id="cardiac"
            className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-rose-400 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-rose-500/50"
          >
            <div>
              <div className="flex size-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                <HeartPulseIcon className="size-8" />
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold uppercase text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                  STEMI Critical Care
                </span>
                <span className="text-xs font-semibold text-zinc-500">&lt;38 min Balloon Time</span>
              </div>

              <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Rapid Cardiac Catheterization &amp; STEMI Response
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Rapid revascularization of acute coronary occlusions. Immediate access directly from the field bypasses ordinary triage queues.
              </p>

              <ul className="mt-4 space-y-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span><strong>Dual Hybrid Catheterization Labs Always Staffed:</strong> Two state-of-the-art interventional suites manned 24 hours a day, 365 days a year.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span><strong>Intra-Aortic Balloon Pump &amp; ECMO Standby:</strong> Immediate hemodynamic support and veno-arterial ECMO cannulation readiness.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span><strong>Pre-Hospital 12-Lead ECG Telemetry:</strong> Wireless transmission from moving ambulances directly to on-call interventional cardiologists.</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 border-t border-zinc-100 pt-4 text-xs font-semibold text-rose-700 dark:border-zinc-800 dark:text-rose-400">
              BCIS Accredited STEMI Center &middot; Sub-38 minute door-to-balloon speed
            </div>
          </div>

          {/* Unit 4: Dedicated Pediatric Emergency Wing */}
          <div
            id="pediatric"
            className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-500/50"
          >
            <div>
              <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                <PediatricIcon className="size-8" />
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold uppercase text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Pediatric Emergency
                </span>
                <span className="text-xs font-semibold text-zinc-500">Dedicated Wing</span>
              </div>

              <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Dedicated Pediatric Emergency Wing
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Children require specialized physiology, equipment, and compassion. Our pediatric wing is entirely isolated from adult trauma chaos.
              </p>

              <ul className="mt-4 space-y-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span><strong>Child-Friendly Sensory Environment:</strong> Sound-dampened suites, natural lighting, and distraction therapies to ease acute distress.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span><strong>Fellowship-Trained Specialists:</strong> Pediatric emergency physicians, pediatric trauma surgeons, and certified child-life liaisons.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span><strong>Separate Pediatric Resuscitation Bays:</strong> Color-coded Broselow dosing systems, micro-bore vascular access, and infant warmers.</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 border-t border-zinc-100 pt-4 text-xs font-semibold text-emerald-700 dark:border-zinc-800 dark:text-emerald-400">
              Direct connection to 24/7 Pediatric Intensive Care Unit (PICU)
            </div>
          </div>

          {/* Unit 5: Mass Casualty & Decontamination Facility */}
          <div
            id="mass-casualty"
            className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-purple-400 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-purple-500/50 md:col-span-2 lg:col-span-2"
          >
            <div>
              <div className="flex size-14 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
                <ShieldAlertIcon className="size-8" />
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold uppercase text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                  Regional Disaster Defense
                </span>
                <span className="text-xs font-semibold text-zinc-500">Mass Casualty Unit</span>
              </div>

              <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Mass Casualty &amp; Decontamination Facility
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Equipped to manage complex hazardous incidents, biological threats, and multi-vehicle highway collisions with instantaneous facility isolation.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <div className="font-bold text-zinc-900 dark:text-zinc-100">Negative-Pressure Bays</div>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    Dedicated isolation bays with high-efficiency HEPA exhaust to contain airborne contaminants and pathogens.
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <div className="font-bold text-zinc-900 dark:text-zinc-100">CBRN Decontamination</div>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    High-volume chemical, biological, and radiological decontamination shower suites with effluent containment.
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <div className="font-bold text-zinc-900 dark:text-zinc-100">Disaster Command Center</div>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    Subterranean emergency incident room with satellite backbones connected to national civil contingency desks.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-zinc-100 pt-4 text-xs font-semibold text-purple-700 dark:border-zinc-800 dark:text-purple-400">
              Surge capability for up to 100 simultaneous admissions &middot; Self-contained auxiliary generator arrays
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- Rapid Trauma Pathway / Protocol Timeline -------------------- */}
      <section className="border-y border-zinc-200 bg-zinc-100/60 py-16 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
              Clinical Velocity
            </span>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              The Golden Hour Protocol: Every Millisecond Reclaimed
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Standard emergency departments lose critical time at handover and triage. At Westbrook, our Level-1 clinical pathway mobilizes surgery before patient wheels touch the bay.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400">PHASE 01 &middot; T-MINUS 15 MIN</span>
              <h4 className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">In-Flight / En-Route Telemetry</h4>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Ambulance and air crews stream biometric data, ultrasound imaging, and ECGs directly to trauma surgeons on site.
              </p>
            </div>

            <div className="relative rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">PHASE 02 &middot; MINUTE 00:00</span>
              <h4 className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">Zero-Wait Bay Arrival</h4>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Direct ambulance dock or rooftop express lift delivery directly into pre-warmed shock trauma bays. No reception delay.
              </p>
            </div>

            <div className="relative rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">PHASE 03 &middot; MINUTE 00:06</span>
              <h4 className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">Immediate Stat Diagnostics</h4>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Instant total-body trauma CT scan within 10 paces of the bay, continuous blood gas analysis, and mass-transfusion blood activation.
              </p>
            </div>

            <div className="relative rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">PHASE 04 &middot; MINUTE 00:18</span>
              <h4 className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">Operative Intervention</h4>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Trauma laparotomy, endovascular stenting, or craniotomy underway in adjacent hybrid operating theaters with scrubbed specialists.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- Immediate Emergency Contact & Directions -------------------- */}
      <section id="directions" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Card 1: Immediate Emergency Contacts */}
          <div
            id="contact"
            className="flex flex-col justify-between rounded-3xl border border-red-200 bg-gradient-to-br from-red-50 to-white p-6 shadow-md dark:border-red-900/40 dark:from-zinc-900 dark:to-zinc-950 sm:p-8 lg:col-span-6"
          >
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                <SirenIcon className="size-4" />
                <span>Immediate Critical Dispatch</span>
              </div>

              <h3 className="mt-4 text-2xl font-extrabold text-zinc-900 sm:text-3xl dark:text-zinc-100">
                Emergency Hotline &amp; Dispatch Line
              </h3>

              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Connected directly to Westbrook Trauma Command and the Scottish Ambulance Service emergency triage system.
              </p>

              <div className="mt-6 rounded-2xl border border-red-200 bg-white p-5 shadow-sm dark:border-red-900/50 dark:bg-zinc-900">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Direct Trauma Hotline (Toll-Free 24/7)
                </span>
                <div className="mt-1">
                  <a
                    href="tel:08009999111"
                    className="group inline-flex items-center gap-3 text-2xl font-black text-red-600 hover:text-red-700 sm:text-4xl dark:text-red-400 dark:hover:text-red-300"
                  >
                    <PhoneCallIcon className="size-7 sm:size-9" />
                    <span>0800-999-9111</span>
                  </a>
                </div>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Instant clinical operator pick-up. No automated phone menus.
                </p>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <div>
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">National Emergency Services</div>
                    <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">Call 999 (Ambulance, Fire, Police)</div>
                  </div>
                  <a
                    href="tel:999"
                    className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Call 999
                  </a>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <div>
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Ambulance Air &amp; Ground Dispatch Port</div>
                    <div className="font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-200">VHF Channel 156.800 &middot; Encrypted Uplink</div>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    Online
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-red-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              Trauma medical direction monitored by Senior Trauma Consultants &middot; Westbrook Emergency Command Center
            </div>
          </div>

          {/* Card 2: Rapid Route GPS Directions & Ambulance Access */}
          <div className="flex flex-col justify-between rounded-3xl border border-zinc-200 bg-white p-6 shadow-md dark:border-zinc-800 dark:bg-zinc-900 sm:p-8 lg:col-span-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                <NavigationIcon className="size-4" />
                <span>Rapid Route &amp; Transit Coordinates</span>
              </div>

              <h3 className="mt-4 text-2xl font-extrabold text-zinc-900 sm:text-3xl dark:text-zinc-100">
                Dedicated Emergency &amp; Ambulance Bay Access
              </h3>

              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Emergency access is physically separated from outpatient and clinic parking to ensure unobstructed ambulance entry and private patient drop-off.
              </p>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <div className="text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400">
                    Dedicated Ambulance &amp; Trauma Entrance
                  </div>
                  <div className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-100">
                    East Gate Blue-Light Trauma Ramp
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    {practice.name}, 14 Westbrook Place, Edinburgh EH8 9RL
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">GPS Coordinates</span>
                    <p className="mt-0.5 font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      55.9486&deg; N, 3.1999&deg; W
                    </p>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Vehicle Bay Clearance</span>
                    <p className="mt-0.5 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      4.2m High Clearance &middot; Heated Bay
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                  <span className="font-bold">Patient &amp; Family Drop-Off:</span> Drive into East Gate and follow red illuminated road markings directly under the covered Emergency Drop Canopy. Staff will assist immediately with wheelchairs and gurneys.
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="https://maps.google.com/?q=14+Westbrook+Place,+Edinburgh+EH8+9RL"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <NavigationIcon className="size-4" />
                <span>Open in Google Maps</span>
              </a>

              <a
                href={`tel:${practice.phoneHref.replace("tel:", "")}`}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                <span>Clinic Desk: {practice.phoneDisplay}</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- Non-Emergency Outpatient Consultation CTA -------------------- */}
      <section id="doctors" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 p-8 text-white shadow-xl dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900 sm:p-12">
          {/* Subtle accent glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-0 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl"
          />

          <div className="relative z-10 max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-500/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
              Non-Emergency Consultations
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
              Not a life-threatening emergency? Book your general practice visit online in seconds.
            </h2>
            <p className="mt-3 text-base text-zinc-300 sm:text-lg">
              For routine appointments, chronic disease reviews, medical certificates, and non-emergent inquiries, skip the phone queue and choose your preferred GP at Westbrook Medical Practice.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/book"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-bold text-zinc-900 shadow-lg transition hover:bg-zinc-100 active:scale-95"
              >
                <span>Book Outpatient Appointment</span>
                <span aria-hidden="true">&rarr;</span>
              </Link>

              <Link
                href="/#doctors"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-5 py-3.5 text-base font-semibold text-zinc-200 backdrop-blur-sm transition hover:border-zinc-500 hover:bg-zinc-700 active:scale-95"
              >
                <span>View GP &amp; Specialist Directory</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- Accreditations & Certifications Footer Strip -------------------- */}
      <section className="border-t border-zinc-200 bg-white py-10 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Certified Clinical Designations &middot; Regulatory Accreditations
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            <span className="flex items-center gap-2">
              <CheckCircleIcon className="size-4 text-emerald-500" />
              Scottish Trauma Network Level-1 Verified
            </span>
            <span className="flex items-center gap-2">
              <CheckCircleIcon className="size-4 text-emerald-500" />
              World Stroke Organization Diamond Center
            </span>
            <span className="flex items-center gap-2">
              <CheckCircleIcon className="size-4 text-emerald-500" />
              BCIS Certified Interventional STEMI Lab
            </span>
            <span className="flex items-center gap-2">
              <CheckCircleIcon className="size-4 text-emerald-500" />
              CAA Category H3 All-Weather Helipad
            </span>
            <span className="flex items-center gap-2">
              <CheckCircleIcon className="size-4 text-emerald-500" />
              Royal College of Emergency Medicine Member
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
