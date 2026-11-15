import type { Metadata } from "next";
import Link from "next/link";
import { DoctorPortrait } from "@/components/doctors/DoctorPortrait";
import { Calendar, Check, ChevronRight, Clock, Lock, Phone, Pin } from "@/components/icons";
import { practice } from "@/lib/data";
import { getDoctors } from "@/lib/repository";

export const metadata: Metadata = {
  title: "Luxury Patient Care, Suites & Concierge Experience · Westbrook Medical Practice",
  description:
    "Unrivaled comfort with 5-star private recovery suites, Michelin-trained culinary nutrition, 24/7 dedicated concierge, and bespoke healing amenities.",
  openGraph: {
    title: "Luxury Patient Care, Suites & Concierge Experience · Westbrook Medical Practice",
    description:
      "Unrivaled comfort with 5-star private recovery suites, Michelin-trained culinary nutrition, 24/7 dedicated concierge, and bespoke healing amenities.",
    type: "website",
  },
};

function StarIcon({ className = "size-4 text-amber-500 fill-amber-500" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function SparklesIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
      <path d="M5 3v4M3 5h4M19 17v4M17 19h4" />
    </svg>
  );
}

function ShieldCheckIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function UtensilsIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 2v20M21 2v6a3 3 0 0 1-3 3h0M3 2v7c0 1.66 1.34 3 3 3h0a3 3 0 0 0 3-3V2M6 12v10" />
    </svg>
  );
}

function LotusFlowerIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 22c-4-3-8-8-8-13a8 8 0 0 1 16 0c0 5-4 10-8 13Z" />
      <path d="M12 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M12 14c-2.5 0-4.5 1-6 3M12 14c2.5 0 4.5 1 6 3" />
    </svg>
  );
}

function BedIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9" />
      <circle cx="8" cy="11.5" r="1.5" />
    </svg>
  );
}

function SoundIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function SliderIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="4" x2="20" y1="21" y2="21" />
      <line x1="4" x2="20" y1="14" y2="14" />
      <line x1="4" x2="20" y1="7" y2="7" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="14" r="2" />
      <circle cx="14" cy="21" r="2" />
    </svg>
  );
}

function GlobeIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" x2="22" y1="12" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export default async function PatientCarePage() {
  const doctors = await getDoctors();

  return (
    <div className="relative isolate min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 antialiased selection:bg-amber-500/20 selection:text-amber-800 dark:selection:text-amber-200">
      {/* Decorative ambient background glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
      >
        <div
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-amber-400/20 via-sky-500/10 to-amber-200/25 dark:from-amber-600/15 dark:via-cyan-600/10 dark:to-amber-300/10 opacity-70 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
        />
      </div>

      {/* =========================================================================
          HERO SECTION
          ========================================================================= */}
      <section className="relative px-5 pt-12 pb-16 sm:px-8 sm:pt-20 lg:pt-24 lg:pb-20">
        <div className="mx-auto max-w-5xl text-center">
          {/* Badge: Five-Star Hospitality Certified */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-amber-300/60 dark:border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-400/15 to-amber-500/10 px-4 py-1.5 shadow-sm backdrop-blur">
            <div className="flex items-center gap-0.5 text-amber-500" aria-label="5 out of 5 stars">
              <StarIcon className="size-3.5 fill-amber-500 text-amber-500" />
              <StarIcon className="size-3.5 fill-amber-500 text-amber-500" />
              <StarIcon className="size-3.5 fill-amber-500 text-amber-500" />
              <StarIcon className="size-3.5 fill-amber-500 text-amber-500" />
              <StarIcon className="size-3.5 fill-amber-500 text-amber-500" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Five-Star Hospitality Certified
            </span>
            <span className="hidden sm:inline-block size-1 rounded-full bg-amber-400" />
            <span className="hidden sm:inline-block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {practice.name} Inpatient Pavilion
            </span>
          </div>

          {/* High-impact Headline */}
          <h1 className="mt-8 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 leading-[1.08]">
            Healing Redefined Through{" "}
            <span className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 dark:from-amber-300 dark:via-amber-400 dark:to-yellow-200 bg-clip-text text-transparent">
              Uncompromising Luxury
            </span>{" "}
            &amp; Compassion
          </h1>

          {/* Narrative Subhead */}
          <p className="mt-6 text-lg sm:text-xl text-zinc-600 dark:text-zinc-300 max-w-3xl mx-auto font-normal leading-relaxed">
            Welcome to the gold standard of private clinical care. At Westbrook, world-renowned medical specialists
            converge with bespoke five-star hospitality — offering private architectural recovery suites,
            Michelin-trained nutrition, 24/7 dedicated nursing, and private international concierge liaison.
          </p>

          {/* CTAs */}
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/book"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold px-8 py-4 shadow-lg shadow-amber-600/25 hover:shadow-xl hover:shadow-amber-600/35 transition-all text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
            >
              <Calendar size={18} />
              <span>Reserve a private suite consultation</span>
            </Link>
            <Link
              href="#doctors"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium px-8 py-4 shadow-sm hover:shadow transition-all text-base"
            >
              <SparklesIcon className="size-4 text-amber-500" />
              <span>Schedule a pre-admission walkthrough</span>
            </Link>
          </div>

          {/* Direct Concierge Line */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            <Phone size={14} className="text-amber-500" />
            <span>Dedicated VIP Suite Concierge:</span>
            <a
              href={practice.phoneHref}
              className="font-semibold text-zinc-800 dark:text-zinc-200 hover:text-amber-600 dark:hover:text-amber-400 underline underline-offset-4"
            >
              {practice.phoneDisplay}
            </a>
            <span className="hidden sm:inline">· 24/7 Discrete Medical Triage</span>
          </div>

          {/* Stats Strip */}
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 text-left">
            <div className="relative rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm hover:border-amber-500/40 transition-colors">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">
                  1:1
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Ratio
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                1:1 dedicated nursing ratio in VIP suites
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-normal">
                Continuous, undivided clinical surveillance and bedside attention around the clock.
              </p>
            </div>

            <div className="relative rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm hover:border-amber-500/40 transition-colors">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">
                  18
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Tongues
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                18 international languages spoken
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-normal">
                Fluent medical translators and cultural liaisons catering to global patrons.
              </p>
            </div>

            <div className="relative rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm hover:border-amber-500/40 transition-colors">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">
                  99.8%
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Score
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                99.8% patient satisfaction rating
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-normal">
                Independently audited patient experience score across comfort, dignity, and care.
              </p>
            </div>

            <div className="relative rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm hover:border-amber-500/40 transition-colors">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">
                  100%
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Quiet
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                100% private suites with acoustic isolation
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-normal">
                Triple-glazed acoustic engineering, negative airflow, and HEPA-H14 air purity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          LUXURY AMENITIES & LIVING SPACES
          ========================================================================= */}
      <section className="relative px-5 py-16 sm:px-8 sm:py-24 bg-white/60 dark:bg-zinc-900/40 border-y border-zinc-200/80 dark:border-zinc-800/80">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              The Gold Standard of Private Convalescence
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              Luxury Amenities &amp; Living Spaces
            </h2>
            <p className="mt-4 text-base sm:text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Every curve, fabric, lighting spectrum, and architectural interface within our private recovery wing is
              engineered to accelerate patient recuperation in serene luxury.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Feature 1: The Presidential & Royal Recovery Suites */}
            <div className="group relative rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 sm:p-10 shadow-sm hover:shadow-xl hover:border-amber-400/50 transition-all duration-300">
              <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-6">
                <BedIcon className="size-6" />
              </div>
              <span className="block text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Private Inpatient Residence
              </span>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                The Presidential &amp; Royal Recovery Suites
              </h3>
              <p className="mt-3 text-zinc-600 dark:text-zinc-300 leading-relaxed text-sm sm:text-base">
                Conceived in collaboration with luxury interior masters and clinical recovery ergonomists, each suite
                redefines the recovery environment into an expansive private sanctuary.
              </p>

              <ul className="mt-6 space-y-3.5 text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-full p-1 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Check size={14} />
                  </span>
                  <div>
                    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Panoramic skyline views:</strong>{" "}
                    Floor-to-ceiling sound-attenuated glass framing unobstructed vistas of Edinburgh Castle and private
                    botanical healing gardens.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-full p-1 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Check size={14} />
                  </span>
                  <div>
                    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Custom ergonomic circadian lighting:</strong>{" "}
                    Medical-grade spectral illumination that transitions smoothly from morning blue-shifted stimulation
                    to evening melatonin-promoting amber wavelengths.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-full p-1 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Check size={14} />
                  </span>
                  <div>
                    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Private marble baths:</strong>{" "}
                    Imported Italian Calacatta marble en-suites featuring zero-barrier rain showers, chromotherapy
                    soaking tubs, radiant floor heating, and heated towel warmers.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-full p-1 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Check size={14} />
                  </span>
                  <div>
                    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Companion guest quarters:</strong>{" "}
                    Adjoining private salon featuring king-size sleeper accommodations, executive workstation, and
                    private dressing chamber for visiting family.
                  </div>
                </li>
              </ul>
            </div>

            {/* Feature 2: 24/7 Dedicated Concierge & Liaison */}
            <div className="group relative rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 sm:p-10 shadow-sm hover:shadow-xl hover:border-amber-400/50 transition-all duration-300">
              <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-6">
                <GlobeIcon className="size-6" />
              </div>
              <span className="block text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                White-Glove International Protocol
              </span>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                24/7 Dedicated Concierge &amp; International Medical Travelers Liaison
              </h3>
              <p className="mt-3 text-zinc-600 dark:text-zinc-300 leading-relaxed text-sm sm:text-base">
                For international guests and high-profile patrons, our bespoke concierge staff manages every logistical
                detail from touchdown to full discharge with flawless precision.
              </p>

              <ul className="mt-6 space-y-3.5 text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-full p-1 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Check size={14} />
                  </span>
                  <div>
                    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Private airport chauffeur transfers:</strong>{" "}
                    Tarmac-side or VIP terminal greeting with executive Mercedes-Maybach and Range Rover hybrid transport,
                    including physician or paramedic escort on request.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-full p-1 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Check size={14} />
                  </span>
                  <div>
                    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Embassy paperwork &amp; diplomatic liaison:</strong>{" "}
                    Rapid medical visa extension processing, consular attestation, medical translation, and direct embassy
                    reimbursement clearing.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-full p-1 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Check size={14} />
                  </span>
                  <div>
                    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Expedited admission:</strong>{" "}
                    Zero waiting rooms. Immediate, discrete check-in conducted directly inside your private suite with the
                    attending physician present.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-full p-1 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Check size={14} />
                  </span>
                  <div>
                    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Personalized itineraries:</strong>{" "}
                    Curated cultural and leisure arrangements for accompanying family, private shopping appointments, and
                    secure city travel.
                  </div>
                </li>
              </ul>
            </div>

            {/* Feature 3: Michelin-Trained Gourmet Culinary Medicine */}
            <div className="group relative rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 sm:p-10 shadow-sm hover:shadow-xl hover:border-amber-400/50 transition-all duration-300">
              <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-6">
                <UtensilsIcon className="size-6" />
              </div>
              <span className="block text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Nutritional Excellence
              </span>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Michelin-Trained Gourmet Culinary Medicine
              </h3>
              <p className="mt-3 text-zinc-600 dark:text-zinc-300 leading-relaxed text-sm sm:text-base">
                We believe nutrition is one of the most powerful restorative modalities. Our culinary masters turn
                stringent clinical requirements into unforgettable dining experiences.
              </p>

              <ul className="mt-6 space-y-3.5 text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-full p-1 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Check size={14} />
                  </span>
                  <div>
                    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Farm-to-table organic menus:</strong>{" "}
                    Sourced from certified organic Scottish highland estates, curated collaboratively by clinical
                    dietitians and executive chefs formerly of Michelin-starred dining rooms.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-full p-1 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Check size={14} />
                  </span>
                  <div>
                    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Customized clinical diets:</strong>{" "}
                    Precision tailoring for surgical recovery, anti-inflammatory, macrobiotic, ketogenic, halal, kosher,
                    and low-sodium parameters without sacrificing epicurean pleasure.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-full p-1 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Check size={14} />
                  </span>
                  <div>
                    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">24/7 room service:</strong>{" "}
                    On-demand fine dining and restorative culinary broths delivered in silver-service presentation on
                    bone porcelain with crystal stemware.
                  </div>
                </li>
              </ul>
            </div>

            {/* Feature 4: Holistic Healing & Wellness Pavilion */}
            <div className="group relative rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 sm:p-10 shadow-sm hover:shadow-xl hover:border-amber-400/50 transition-all duration-300">
              <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-6">
                <LotusFlowerIcon className="size-6" />
              </div>
              <span className="block text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Integrative Restoration
              </span>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Holistic Healing &amp; Wellness Pavilion
              </h3>
              <p className="mt-3 text-zinc-600 dark:text-zinc-300 leading-relaxed text-sm sm:text-base">
                Modern surgical mastery joined harmoniously with restorative therapeutic arts to lower systemic cortisol
                and promote rapid deep-tissue cellular rejuvenation.
              </p>

              <ul className="mt-6 space-y-3.5 text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-full p-1 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Check size={14} />
                  </span>
                  <div>
                    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Indoor botanical hydrotherapy sensory gardens:</strong>{" "}
                    Enclosed conservatory oasis filled with oxygenating micro-climates, gentle cascading water walls,
                    and negative-ion air purification.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-full p-1 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Check size={14} />
                  </span>
                  <div>
                    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Restorative acupuncture:</strong>{" "}
                    Board-certified medical acupuncture practitioners providing gentle neuro-modulatory treatments for
                    pain alleviation, digestive comfort, and serenity.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-full p-1 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Check size={14} />
                  </span>
                  <div>
                    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Sound bath recovery suites:</strong>{" "}
                    Vibrational crystal and Tibetan acoustic therapy rooms aiding parasympathetic nervous system
                    activation and uninterrupted REM sleep.
                  </div>
                </li>
              </ul>
            </div>

            {/* Feature 5: High-Security & Discretion Protocol (Full Width) */}
            <div className="lg:col-span-2 group relative rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 sm:p-10 shadow-sm hover:shadow-xl hover:border-amber-400/50 transition-all duration-300">
              <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-6">
                <ShieldCheckIcon className="size-6" />
              </div>
              <span className="block text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Guaranteed Discretion
              </span>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                High-Security &amp; Discretion Protocol
              </h3>
              <p className="mt-3 text-zinc-600 dark:text-zinc-300 leading-relaxed text-sm sm:text-base max-w-4xl">
                Serving heads of state, international executives, and private individuals with absolute confidentiality.
                Westbrook operates an uncompromising security architecture designed to shield your privacy completely.
              </p>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-6">
                  <div className="flex items-center gap-2.5 font-bold text-zinc-900 dark:text-zinc-100 text-base mb-2">
                    <Lock size={18} className="text-amber-500" />
                    <span>Private Underground Elevator</span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Subterranean discrete arrival bay with biometric access cards directly transporting patients from
                    chauffeur vehicles to private recovery suite floors without public exposure.
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-6">
                  <div className="flex items-center gap-2.5 font-bold text-zinc-900 dark:text-zinc-100 text-base mb-2">
                    <ShieldCheckIcon className="size-5 text-amber-500" />
                    <span>Encrypted Communication</span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Military-grade 256-bit encrypted telemetry, secure telemedicine channels, and closed internal video
                    links shielding patient health data and physician consultations.
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-6">
                  <div className="flex items-center gap-2.5 font-bold text-zinc-900 dark:text-zinc-100 text-base mb-2">
                    <SparklesIcon className="size-5 text-amber-500" />
                    <span>Nondisclosure Standards</span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    All attending clinical and hospitality personnel operate under strict legally binding NDAs. Pseudonymized
                    electronic health charting and isolated wing access available upon request.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          VIRTUAL TOUR & EXPERIENCE GALLERY CARDS
          ========================================================================= */}
      <section className="relative px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Curated Craftsmanship &amp; Finishes
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              Virtual Tour &amp; Experience Gallery
            </h2>
            <p className="mt-4 text-base sm:text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Experience the bespoke appointments, artisanal materials, and responsive environmental technology that
              make a Westbrook suite unlike any hospital in the United Kingdom.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1: Egyptian Cotton Linens */}
            <div className="flex flex-col justify-between rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm hover:border-amber-400/60 transition-all">
              <div>
                <div className="inline-flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-5">
                  <SparklesIcon className="size-5" />
                </div>
                <span className="text-xs font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400">
                  Sensory Comfort
                </span>
                <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Egyptian Cotton Linens
                </h3>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Bespoke 1,000-thread-count long-staple Giza Egyptian cotton bedding, hand-finished with antimicrobial
                  silver threads and hypoallergenic goose down pillows. Sanitized using eco-friendly thermal steam.
                </p>
              </div>
              <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span>Thread Count: 1,000 TC</span>
                <span className="text-amber-600 dark:text-amber-400">Antiallergenic</span>
              </div>
            </div>

            {/* Card 2: Bang & Olufsen Acoustic Systems */}
            <div className="flex flex-col justify-between rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm hover:border-amber-400/60 transition-all">
              <div>
                <div className="inline-flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-5">
                  <SoundIcon className="size-5" />
                </div>
                <span className="text-xs font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400">
                  Acoustic Architecture
                </span>
                <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Bang &amp; Olufsen Acoustic Systems
                </h3>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Precision-calibrated architectural sound systems with active ambient sound dampening, restorative
                  sound frequency libraries, and discrete directional private Bluetooth streaming.
                </p>
              </div>
              <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span>Active Noise Cancellation</span>
                <span className="text-amber-600 dark:text-amber-400">Spatial Audio</span>
              </div>
            </div>

            {/* Card 3: Interactive Touch-Panel Bedside Control */}
            <div className="flex flex-col justify-between rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm hover:border-amber-400/60 transition-all">
              <div>
                <div className="inline-flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-5">
                  <SliderIcon className="size-5" />
                </div>
                <span className="text-xs font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400">
                  Intuitive Mastery
                </span>
                <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Interactive Touch-Panel Bedside Environmental Control
                </h3>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Fingertip control of the entire room atmosphere: motorized sheer and blackout drapes, calibrated
                  ambient temperature (within 0.5°C), circadian light presets, and immediate 1-touch nurse paging.
                </p>
              </div>
              <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span>Crestron Touch Screen</span>
                <span className="text-amber-600 dark:text-amber-400">Instant Nurse Link</span>
              </div>
            </div>

            {/* Card 4: Continuous Biometric Radar Sensors */}
            <div className="flex flex-col justify-between rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm hover:border-amber-400/60 transition-all">
              <div>
                <div className="inline-flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-5">
                  <Clock className="size-5" />
                </div>
                <span className="text-xs font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400">
                  Invisible Surveillance
                </span>
                <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Contactless Biometric Sleep Telemetry
                </h3>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Non-invasive radar sensors embedded below the mattress monitor respiratory rhythms and micro-movements
                  without electrodes or cables, preserving deep healing sleep while alerting nurses instantly.
                </p>
              </div>
              <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span>Zero Cables / Contactless</span>
                <span className="text-amber-600 dark:text-amber-400">24/7 Monitored</span>
              </div>
            </div>

            {/* Card 5: Botanical Hydration Dispensary */}
            <div className="flex flex-col justify-between rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm hover:border-amber-400/60 transition-all">
              <div>
                <div className="inline-flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-5">
                  <LotusFlowerIcon className="size-5" />
                </div>
                <span className="text-xs font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400">
                  Cellular Hydration
                </span>
                <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  En-Suite Botanical Wellness Bar
                </h3>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Complimentary private mini-bar stocked with cold-pressed organic anti-inflammatory juices,
                  mountain spring waters, and physician-formulated herbal adaptogen teas.
                </p>
              </div>
              <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span>Organic Farm Sourced</span>
                <span className="text-amber-600 dark:text-amber-400">Restocked Daily</span>
              </div>
            </div>

            {/* Card 6: Companion Executive Lounge */}
            <div className="flex flex-col justify-between rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm hover:border-amber-400/60 transition-all">
              <div>
                <div className="inline-flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-5">
                  <Lock className="size-5" />
                </div>
                <span className="text-xs font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400">
                  Business Continuity
                </span>
                <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Private Salon &amp; Boardroom Suite
                </h3>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Adjoining private salon featuring dining seating for 6 guests, encrypted fiber-optic connectivity,
                  4K video-conferencing display, and full private butler service for your team or family.
                </p>
              </div>
              <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span>Encrypted Wi-Fi 7</span>
                <span className="text-amber-600 dark:text-amber-400">Dedicated Butler</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          THE WESTBROOK DISTINCTION MATRIX
          ========================================================================= */}
      <section className="relative px-5 py-16 sm:px-8 sm:py-24 bg-white/60 dark:bg-zinc-900/40 border-y border-zinc-200/80 dark:border-zinc-800/80">
        <div className="mx-auto max-w-5xl">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Side-by-Side Comparison
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              The Westbrook Distinction
            </h2>
            <p className="mt-3 text-zinc-600 dark:text-zinc-400 text-sm sm:text-base">
              Why prominent international figures and families travel across continents to convalesce at Westbrook.
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800">
              <div className="p-6 md:p-8 bg-zinc-50/50 dark:bg-zinc-950/40">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Dimension</p>
                <p className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-100">Nursing &amp; Care Ratio</p>
              </div>
              <div className="p-6 md:p-8">
                <span className="inline-block px-2.5 py-0.5 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 mb-2">
                  Standard Private Hospital
                </span>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  1:4 or 1:6 shared nurse-to-patient ratio; delayed call-bell response times during peak shifts.
                </p>
              </div>
              <div className="p-6 md:p-8 bg-amber-500/5 dark:bg-amber-400/5">
                <span className="inline-block px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300 mb-2">
                  Westbrook Inpatient Suites
                </span>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  1:1 Dedicated private nurse assigned to your suite 24 hours a day with zero interruptions.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800 border-t border-zinc-200 dark:border-zinc-800">
              <div className="p-6 md:p-8 bg-zinc-50/50 dark:bg-zinc-950/40">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Dimension</p>
                <p className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-100">Culinary &amp; Nutrition</p>
              </div>
              <div className="p-6 md:p-8">
                <span className="inline-block px-2.5 py-0.5 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 mb-2">
                  Standard Private Hospital
                </span>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Mass catering trays scheduled at rigid times; limited dietary personalization.
                </p>
              </div>
              <div className="p-6 md:p-8 bg-amber-500/5 dark:bg-amber-400/5">
                <span className="inline-block px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300 mb-2">
                  Westbrook Inpatient Suites
                </span>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Michelin-trained executive chefs, 100% organic custom menus, round-the-clock silver-service room service.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800 border-t border-zinc-200 dark:border-zinc-800">
              <div className="p-6 md:p-8 bg-zinc-50/50 dark:bg-zinc-950/40">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Dimension</p>
                <p className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-100">Privacy &amp; Security</p>
              </div>
              <div className="p-6 md:p-8">
                <span className="inline-block px-2.5 py-0.5 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 mb-2">
                  Standard Private Hospital
                </span>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Public reception lobby, communal elevators, shared hallway circulation.
                </p>
              </div>
              <div className="p-6 md:p-8 bg-amber-500/5 dark:bg-amber-400/5">
                <span className="inline-block px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300 mb-2">
                  Westbrook Inpatient Suites
                </span>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Direct subterranean private elevator, strict NDAs, pseudonym check-in, cloaked wings.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800 border-t border-zinc-200 dark:border-zinc-800">
              <div className="p-6 md:p-8 bg-zinc-50/50 dark:bg-zinc-950/40">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Dimension</p>
                <p className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-100">Acoustic Isolation</p>
              </div>
              <div className="p-6 md:p-8">
                <span className="inline-block px-2.5 py-0.5 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 mb-2">
                  Standard Private Hospital
                </span>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Frequent corridor disturbances, cart wheels, alarm chatter disrupting REM sleep cycles.
                </p>
              </div>
              <div className="p-6 md:p-8 bg-amber-500/5 dark:bg-amber-400/5">
                <span className="inline-block px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300 mb-2">
                  Westbrook Inpatient Suites
                </span>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  100% private suites with architectural sound isolation, triple-glazed walls, and silent alarms.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          TESTIMONIALS FROM DIGNITARIES & INTERNATIONAL PATIENTS
          ========================================================================= */}
      <section className="relative px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Testimonials of Distinction
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              Praised by Prominent Dignitaries &amp; Global Patrons
            </h2>
            <p className="mt-4 text-base sm:text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Real accounts from international leaders, executives, and patients who chose Westbrook for our unrivaled
              synergy of clinical precision and five-star hospitality.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div className="flex flex-col justify-between rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm hover:shadow-lg transition-all">
              <div>
                <div className="flex items-center gap-1 text-amber-500 mb-6" aria-label="5 stars">
                  <StarIcon className="size-4 fill-amber-500 text-amber-500" />
                  <StarIcon className="size-4 fill-amber-500 text-amber-500" />
                  <StarIcon className="size-4 fill-amber-500 text-amber-500" />
                  <StarIcon className="size-4 fill-amber-500 text-amber-500" />
                  <StarIcon className="size-4 fill-amber-500 text-amber-500" />
                </div>
                <blockquote className="text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed italic">
                  &ldquo;Westbrook gave me world-class surgical care wrapped in the elegance of a 5-star Mayfair hotel.
                  The 1:1 nursing team and private dining were unparalleled. From tarmac chauffeur arrival to discrete
                  discharge, the experience was magnificent.&rdquo;
                </blockquote>
              </div>
              <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <p className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  H.E. Ambassador K. Al-Mansoor
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Senior Diplomatic Envoy · International Mission
                </p>
                <span className="mt-2.5 inline-block text-[11px] font-semibold tracking-wider uppercase text-amber-600 dark:text-amber-400">
                  Presidential Suite · 14-Day Recovery
                </span>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="flex flex-col justify-between rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm hover:shadow-lg transition-all">
              <div>
                <div className="flex items-center gap-1 text-amber-500 mb-6" aria-label="5 stars">
                  <StarIcon className="size-4 fill-amber-500 text-amber-500" />
                  <StarIcon className="size-4 fill-amber-500 text-amber-500" />
                  <StarIcon className="size-4 fill-amber-500 text-amber-500" />
                  <StarIcon className="size-4 fill-amber-500 text-amber-500" />
                  <StarIcon className="size-4 fill-amber-500 text-amber-500" />
                </div>
                <blockquote className="text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed italic">
                  &ldquo;The acoustic isolation and circadian lighting allowed me to sleep nine hours uninterrupted the
                  night after my procedure. An absolute medical sanctuary. The Michelin chef even created a bespoke
                  macrobiotic recovery soup tailored to my exact blood panel.&rdquo;
                </blockquote>
              </div>
              <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <p className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  Elena Vance
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Tech Venture Founder &amp; Global Patient (Zürich)
                </p>
                <span className="mt-2.5 inline-block text-[11px] font-semibold tracking-wider uppercase text-amber-600 dark:text-amber-400">
                  Royal Suite · Orthopaedic Care
                </span>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="flex flex-col justify-between rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm hover:shadow-lg transition-all">
              <div>
                <div className="flex items-center gap-1 text-amber-500 mb-6" aria-label="5 stars">
                  <StarIcon className="size-4 fill-amber-500 text-amber-500" />
                  <StarIcon className="size-4 fill-amber-500 text-amber-500" />
                  <StarIcon className="size-4 fill-amber-500 text-amber-500" />
                  <StarIcon className="size-4 fill-amber-500 text-amber-500" />
                  <StarIcon className="size-4 fill-amber-500 text-amber-500" />
                </div>
                <blockquote className="text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed italic">
                  &ldquo;From the moment the private chauffeur met us at Edinburgh airport to our discreet departure,
                  Westbrook treated our family with dignity, discretion, and royal precision. The companion suite let my
                  spouse stay by my side in comfort.&rdquo;
                </blockquote>
              </div>
              <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <p className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  Lord Julian Montgomery
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Scottish Philanthropist &amp; Civic Leader
                </p>
                <span className="mt-2.5 inline-block text-[11px] font-semibold tracking-wider uppercase text-amber-600 dark:text-amber-400">
                  Presidential Suite · Cardiac Restoration
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          ATTENDING PHYSICIANS & SUITE CONSULTANTS SECTION (#doctors)
          ========================================================================= */}
      <section id="doctors" className="relative px-5 py-16 sm:px-8 sm:py-24 bg-white/60 dark:bg-zinc-900/40 border-t border-zinc-200/80 dark:border-zinc-800/80 scroll-mt-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Distinguished Medical Faculty
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              Senior Attending Physicians &amp; Suite Specialists
            </h2>
            <p className="mt-4 text-base sm:text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Every private suite patient is personally overseen by our senior attending physicians.
              Select a specialist to book your private suite consultation or pre-admission evaluation.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doctors.map((doctor) => (
              <div
                key={doctor.id}
                className="group flex flex-col justify-between rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm hover:shadow-lg hover:border-amber-400/50 transition-all"
              >
                <div>
                  <div className="flex items-center gap-4">
                    <DoctorPortrait doctor={doctor} size={64} shape="rounded" />
                    <div>
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {doctor.name}
                      </h3>
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mt-0.5">
                        {doctor.qualification}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {doctor.interest}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-3">
                    {doctor.bio}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {doctor.languages.map((lang) => (
                      <span
                        key={lang}
                        className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-300"
                      >
                        {lang}
                      </span>
                    ))}
                    <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                      {doctor.years}y experience
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{doctor.room}</span> · {doctor.days}
                  </div>
                  <Link
                    href={`/book?doctor=${doctor.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 hover:bg-amber-600 dark:hover:bg-amber-400 text-white dark:text-zinc-950 px-4 py-2 text-xs font-semibold shadow-sm hover:shadow transition-colors"
                  >
                    <span>Consult</span>
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          GRAND CTA SECTION
          ========================================================================= */}
      <section className="relative px-5 py-20 sm:px-8 sm:py-28 overflow-hidden">
        <div className="mx-auto max-w-5xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 text-white p-8 sm:p-14 lg:p-16 border border-zinc-800 shadow-2xl">
            {/* Ambient luxury glow overlay */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-amber-500/15 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-32 -left-32 size-96 rounded-full bg-sky-500/10 blur-3xl"
            />

            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-300 mb-6">
                <SparklesIcon className="size-3.5 text-amber-300" />
                <span>Bespoke Private Inpatient Care</span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                Experience Healthcare at the Pinnacle of Luxury &amp; Privacy
              </h2>

              <p className="mt-5 text-base sm:text-lg text-zinc-300 leading-relaxed font-normal">
                Whether organizing an elective procedure, intensive post-surgical rehabilitation, or international
                medical travel for your family, our VIP Concierge Liaison is available 24 hours a day to craft your stay.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <Link
                  href="/book"
                  className="inline-flex items-center justify-center gap-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold px-8 py-4 shadow-lg shadow-amber-400/20 hover:shadow-xl transition-all text-base"
                >
                  <Calendar size={18} />
                  <span>Reserve a private suite consultation</span>
                </Link>
                <Link
                  href="#doctors"
                  className="inline-flex items-center justify-center gap-2.5 rounded-full border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-100 font-medium px-8 py-4 transition-all text-base"
                >
                  <SparklesIcon className="size-4 text-amber-400" />
                  <span>Schedule a pre-admission walkthrough</span>
                </Link>
              </div>

              <div className="mt-10 pt-8 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs sm:text-sm text-zinc-400">
                <div className="flex items-center gap-3">
                  <Phone size={18} className="text-amber-400 shrink-0" />
                  <div>
                    <span className="block text-zinc-200 font-semibold">24/7 International Liaison Desk</span>
                    <a href={practice.phoneHref} className="text-amber-300 hover:underline">
                      {practice.phoneDisplay}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Pin size={18} className="text-amber-400 shrink-0" />
                  <div>
                    <span className="block text-zinc-200 font-semibold">Discrete Location</span>
                    <span>{practice.address}</span>
                  </div>
                </div>
              </div>

              <p className="mt-6 text-xs text-zinc-500 leading-relaxed">
                All inquiries are treated under ironclad medical confidentiality. Discrete subterranean vehicular entry
                and private consultations under signed nondisclosure agreements available upon request.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
