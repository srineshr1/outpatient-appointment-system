import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Award01Icon,
  Award02Icon,
  Shield01Icon,
  Shield02Icon,
  RoboticIcon,
  MicroscopeIcon,
  Hospital01Icon,
  Stethoscope02Icon,
  BadgeCheckIcon,
  Calendar03Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  SparklesIcon,
  Call02Icon,
  UserMultipleIcon,
  Activity01Icon,
  CpuIcon,
} from "@hugeicons/core-free-icons";
import { ExcellenceTabs } from "@/components/excellence/ExcellenceTabs";
import { ExcellenceFaq } from "@/components/excellence/ExcellenceFaq";

export const metadata: Metadata = {
  title: "Centers of Clinical Excellence & Specialized Surgery · Westbrook Medical Practice",
  description:
    "Pioneering surgical innovation, da Vinci Xi robotics, minimally invasive cardiac care, and world-class specialty institutes.",
};

export default function ExcellencePage() {
  return (
    <div className="relative isolate overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-screen">
      {/* ---------- Background Subtle Grids & Lighting ---------- */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-30 dark:opacity-20 [background-image:radial-gradient(rgba(14,165,233,0.18)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_15%,#000_20%,transparent_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[48rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.12)_0%,rgba(14,165,233,0.04)_45%,transparent_70%)] blur-3xl"
      />

      {/* =========================================================================
          SECTION 1: HERO SECTION
          High-impact headline, Top 1% badge, stats strip
          ========================================================================= */}
      <section className="relative px-5 pt-12 pb-16 md:px-8 md:pt-20 lg:pt-24">
        <div className="mx-auto max-w-6xl">
          {/* Top Badge */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-sky-500/25 bg-sky-50/80 dark:bg-sky-950/40 px-4 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 shadow-sm backdrop-blur-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-sky-500" />
              </span>
              <HugeiconsIcon icon={Award01Icon} size={15} />
              <span>Top 1% Global Surgical Outcomes</span>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <span className="text-zinc-500 dark:text-zinc-400">SRC Accredited Center of Excellence</span>
            </div>
          </div>

          {/* High-Impact Headline */}
          <div className="mt-8 text-center">
            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-zinc-950 dark:text-white leading-[1.08]">
              Surgical Precision. <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 dark:from-sky-400 dark:via-cyan-300 dark:to-blue-400 bg-clip-text text-transparent">
                Uncompromising Clinical Excellence.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-3xl text-base sm:text-lg md:text-xl text-zinc-600 dark:text-zinc-300 font-normal leading-relaxed">
              Pioneering the next era of specialized surgery in Edinburgh and across the United Kingdom.
              Westbrook unites dual-console da Vinci Xi robotics, ultra-sterile Class 100 laminar flow operating suites,
              and surgical faculty holding fellowships from Johns Hopkins, Oxford, Mayo Clinic, and Harvard.
            </p>

            {/* Hero CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link
                href="/book"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-full bg-zinc-900 dark:bg-zinc-100 px-7 py-3.5 text-sm font-bold text-white dark:text-zinc-950 shadow-lg shadow-zinc-900/10 dark:shadow-white/10 hover:bg-zinc-800 dark:hover:bg-white hover:scale-[1.01] active:scale-[0.98] transition-all"
              >
                <HugeiconsIcon icon={Calendar03Icon} size={18} />
                <span>Schedule Surgical Consultation</span>
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
              </Link>
              <Link
                href="#doctors"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/70 px-6 py-3.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200 backdrop-blur-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <HugeiconsIcon icon={UserMultipleIcon} size={18} />
                <span>Meet Our Surgical Faculty</span>
              </Link>
              <Link
                href="#centers"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-dashed border-zinc-300 dark:border-zinc-800 bg-transparent px-5 py-3.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                <HugeiconsIcon icon={SparklesIcon} size={16} className="text-sky-500" />
                <span>Explore 5 Institutes</span>
              </Link>
            </div>
          </div>

          {/* Stats Strip */}
          <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {/* Stat 1 */}
            <div className="relative group rounded-3xl border border-zinc-200/90 dark:border-zinc-800/90 bg-white/90 dark:bg-zinc-900/80 p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={22} />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                  Audited
                </span>
              </div>
              <p className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950 dark:text-white tabular-nums">
                99.4%
              </p>
              <h3 className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Procedural Success Rate
              </h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-snug">
                Across 15,000+ complex elective and acute surgical interventions.
              </p>
            </div>

            {/* Stat 2 */}
            <div className="relative group rounded-3xl border border-zinc-200/90 dark:border-zinc-800/90 bg-white/90 dark:bg-zinc-900/80 p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <HugeiconsIcon icon={RoboticIcon} size={22} />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full">
                  da Vinci Xi
                </span>
              </div>
              <p className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950 dark:text-white tabular-nums">
                12,000+
              </p>
              <h3 className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Robotic Procedures
              </h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-snug">
                Dual-console multi-quadrant surgeries with 0.1mm sub-millimeter precision.
              </p>
            </div>

            {/* Stat 3 */}
            <div className="relative group rounded-3xl border border-zinc-200/90 dark:border-zinc-800/90 bg-white/90 dark:bg-zinc-900/80 p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <HugeiconsIcon icon={Activity01Icon} size={22} />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                  ERAS Fast-Track
                </span>
              </div>
              <p className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950 dark:text-white tabular-nums">
                40%
              </p>
              <h3 className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Faster Recovery Times
              </h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-snug">
                Accelerated post-operative mobilization and opioid-sparing protocols.
              </p>
            </div>

            {/* Stat 4 */}
            <div className="relative group rounded-3xl border border-zinc-200/90 dark:border-zinc-800/90 bg-white/90 dark:bg-zinc-900/80 p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <HugeiconsIcon icon={Shield01Icon} size={22} />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                  Class 100 Suite
                </span>
              </div>
              <p className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950 dark:text-white tabular-nums">
                0%
              </p>
              <h3 className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Infection Rate
              </h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-snug">
                Positive-pressure HEPA laminar flow cleanrooms with 50 air changes/hour.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: CENTERS OF CLINICAL EXCELLENCE (INTERACTIVE TABS)
          da Vinci Xi, Cardio-Thoracic, Orthopedic, Neuro-Spine, Women's Health
          ========================================================================= */}
      <section id="centers" className="relative px-5 py-16 md:px-8 md:py-24 border-t border-zinc-200/80 dark:border-zinc-800/80">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 shadow-xs">
              <HugeiconsIcon icon={Hospital01Icon} size={14} />
              <span>Dedicated Surgical Institutes</span>
            </div>
            <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
              Five Centers of Clinical Excellence
            </h2>
            <p className="mt-3 text-base sm:text-lg text-zinc-600 dark:text-zinc-400">
              Select an institute below to explore breakthrough surgical procedures, robotics telemetry, and clinical leadership.
            </p>
          </div>

          <div className="mt-12">
            <ExcellenceTabs />
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: STERILE SUITE & THEATRE ARCHITECTURE
          The science behind the 0% hospital-acquired infection rate
          ========================================================================= */}
      <section className="relative px-5 py-16 md:px-8 md:py-20 bg-zinc-100/70 dark:bg-zinc-900/50 border-t border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-12 items-center">
            <div className="lg:col-span-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <HugeiconsIcon icon={Shield02Icon} size={14} />
                <span>Zero-Tolerance Infection Protocol</span>
              </div>
              <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950 dark:text-white leading-tight">
                Class 100 Laminar Flow Operating Theatres
              </h2>
              <p className="mt-3 text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
                A 0% infection rate is not an accident—it is an engineered standard. Westbrook’s surgical theatres employ
                continuous positive atmospheric pressure locks and unidirectional Class 100 laminar airflow curtains that sweep
                particulates away from the sterile surgical field 50 times every hour.
              </p>

              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={15} />
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">HEPA Ultra-Filtration Barrier</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Filters 99.999% of airborne particles down to 0.12 microns.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={15} />
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Intraoperative 3T MRI & Cone-Beam CT</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Immediate intra-theatre anatomical verification without patient transport.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={15} />
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Automated RFID Micro-Telemetry</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Continuous digital verification of autoclave sterility cycles and tray accountability.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Architecture Comparison Visual Cards */}
            <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
              <div className="rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
                <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <HugeiconsIcon icon={MicroscopeIcon} size={20} />
                </span>
                <h3 className="mt-4 text-base font-bold text-zinc-950 dark:text-white">
                  Intraoperative Diagnostics
                </h3>
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Real-time frozen-section pathology and molecular margins delivered to surgeons within 8 minutes,
                  guaranteeing complete oncological resection during the primary operation.
                </p>
                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                  99.7% Clear Margins on First Pass
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
                <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <HugeiconsIcon icon={CpuIcon} size={20} />
                </span>
                <h3 className="mt-4 text-base font-bold text-zinc-950 dark:text-white">
                  Hybrid Angio-Surgical Suites
                </h3>
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Seamlessly converts from high-definition biplane fluoroscopy to open microsurgery in seconds,
                  enabling combined endovascular and open surgical cures in a single session.
                </p>
                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                  Dual-Capability Cleanroom OR
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
                <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <HugeiconsIcon icon={Shield01Icon} size={20} />
                </span>
                <h3 className="mt-4 text-base font-bold text-zinc-950 dark:text-white">
                  Copper-Titanium Antimicrobial
                </h3>
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Operating theatre contact points utilize ion-releasing copper-infused surfaces that destroy 99.9% of bacteria
                  within 2 hours of exposure, preventing cross-contamination vectors.
                </p>
                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Continuous Contact Sterility
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
                <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <HugeiconsIcon icon={Activity01Icon} size={20} />
                </span>
                <h3 className="mt-4 text-base font-bold text-zinc-950 dark:text-white">
                  ERAS Dedicated Recovery Wing
                </h3>
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Post-anesthesia recovery is staffed 1:1 with critical care clinical nurses and physiotherapists who initiate
                  kinematic rehabilitation within hours of emergence.
                </p>
                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  1:1 Post-Surgical Specialized Care
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: SURGICAL TEAM & FACULTY CREDENTIAL SHOWCASE
          Fellowships from Johns Hopkins, Oxford, Mayo Clinic, Harvard.
          Over 250 peer-reviewed surgical techniques published in The Lancet and NEJM.
          ========================================================================= */}
      <section id="doctors" className="relative px-5 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3.5 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
              <HugeiconsIcon icon={Award02Icon} size={14} />
              <span>World-Leading Surgical Faculty</span>
            </div>
            <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
              Trained at the Apex of Global Medicine
            </h2>
            <p className="mt-3 text-base sm:text-lg text-zinc-600 dark:text-zinc-400">
              Our institute chairs and senior surgeons hold fellowships from the world’s most prestigious academies and have pioneered
              over 250 peer-reviewed surgical techniques published in <em className="font-semibold text-zinc-900 dark:text-zinc-200">The Lancet</em> and <em className="font-semibold text-zinc-900 dark:text-zinc-200">The New England Journal of Medicine (NEJM)</em>.
            </p>
          </div>

          {/* Institutional Fellowship Badges Strip */}
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3.5 text-center">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-4 shadow-2xs">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">Fellowship</p>
              <p className="mt-1 text-sm font-extrabold text-zinc-900 dark:text-white">Johns Hopkins Medicine</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Robotic & Cardiothoracic Surgery</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-4 shadow-2xs">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Fellowship</p>
              <p className="mt-1 text-sm font-extrabold text-zinc-900 dark:text-white">University of Oxford</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Cerebrovascular & Skull Base</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-4 shadow-2xs">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Fellowship</p>
              <p className="mt-1 text-sm font-extrabold text-zinc-900 dark:text-white">Mayo Clinic</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Adult Joint & Titanium Reconstruction</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-4 shadow-2xs">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Fellowship</p>
              <p className="mt-1 text-sm font-extrabold text-zinc-900 dark:text-white">Harvard Medical School</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Surgical Oncology & Fetal Medicine</p>
            </div>
          </div>

          {/* Research & Publications Highlight Banner */}
          <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-850 to-zinc-900 text-white p-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-cyan-300">
                <HugeiconsIcon icon={MicroscopeIcon} size={24} />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">250+ Peer-Reviewed Surgical Techniques</h3>
                <p className="text-xs text-zinc-300 mt-0.5">
                  Authored by Westbrook surgical faculty across <strong className="text-white">The Lancet</strong>, <strong className="text-white">NEJM</strong>, <strong className="text-white">Circulation</strong>, and <strong className="text-white">JBJS</strong>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold text-zinc-200">
                FRCS & FACS Board Certified
              </span>
              <span className="rounded-full bg-emerald-500/20 px-3.5 py-1 text-xs font-semibold text-emerald-300">
                100% Verified Faculty
              </span>
            </div>
          </div>

          {/* Faculty Profiles Grid */}
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {/* Faculty 1 */}
            <div className="group rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="size-14 rounded-2xl bg-sky-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                    AM
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-950 dark:text-white">
                      Prof. Alistair Montgomery
                    </h3>
                    <p className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                      MD, FRCS (C/Th), FACS
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Chief of Robotic & Thoracic Surgery
                    </p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                  <HugeiconsIcon icon={BadgeCheckIcon} size={14} className="text-emerald-500" />
                  <span>24 Yrs Experience</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2 text-xs text-zinc-600 dark:text-zinc-300">
                <p>
                  <strong className="text-zinc-900 dark:text-zinc-100">Fellowship Pedigree:</strong> Cardiothoracic Surgery Fellowship at Johns Hopkins Hospital; Senior Clinical Fellow, Oxford Radcliffe.
                </p>
                <p>
                  <strong className="text-zinc-900 dark:text-zinc-100">Scholarly Impact:</strong> 78 papers in <em className="text-zinc-800 dark:text-zinc-200">The Lancet</em> and <em className="text-zinc-800 dark:text-zinc-200">NEJM</em> on beating-heart robotic graft anastomosis and TAVR durability.
                </p>
                <p>
                  <strong className="text-zinc-900 dark:text-zinc-100">Specialty Focus:</strong> da Vinci Xi sutureless bypass, minimally invasive mitral valve repair, hybrid AF ablation.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-xs font-medium text-zinc-500">Suite 1 · Edinburgh</span>
                <Link
                  href="/book"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
                >
                  <span>Book Consultation</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={13} />
                </Link>
              </div>
            </div>

            {/* Faculty 2 */}
            <div className="group rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="size-14 rounded-2xl bg-purple-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                    SV
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-950 dark:text-white">
                      Dr. Sophia Vance
                    </h3>
                    <p className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                      MD, PhD, FRCS (SN), FAANS
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Director of Neurovascular & Skull Base Center
                    </p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                  <HugeiconsIcon icon={BadgeCheckIcon} size={14} className="text-emerald-500" />
                  <span>19 Yrs Experience</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2 text-xs text-zinc-600 dark:text-zinc-300">
                <p>
                  <strong className="text-zinc-900 dark:text-zinc-100">Fellowship Pedigree:</strong> Harvard Medical School (Brigham and Women’s Hospital) & Oxford Neurovascular Institute.
                </p>
                <p>
                  <strong className="text-zinc-900 dark:text-zinc-100">Scholarly Impact:</strong> 64 articles in <em className="text-zinc-800 dark:text-zinc-200">The Lancet Neurology</em> and <em className="text-zinc-800 dark:text-zinc-200">NEJM</em> detailing endoscopic transsphenoidal nerve-sparing corridors.
                </p>
                <p>
                  <strong className="text-zinc-900 dark:text-zinc-100">Specialty Focus:</strong> Skull base meningioma resection, awake functional brain mapping, tubular microdiscectomy.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-xs font-medium text-zinc-500">Suite 3 · Edinburgh</span>
                <Link
                  href="/book"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                >
                  <span>Book Consultation</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={13} />
                </Link>
              </div>
            </div>

            {/* Faculty 3 */}
            <div className="group rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="size-14 rounded-2xl bg-amber-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                    MT
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-950 dark:text-white">
                      Dr. Marcus Thorne
                    </h3>
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      MBBS, FRCS (Tr & Orth), FAAOS
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Chair of Orthopedic Reconstruction
                    </p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                  <HugeiconsIcon icon={BadgeCheckIcon} size={14} className="text-emerald-500" />
                  <span>22 Yrs Experience</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2 text-xs text-zinc-600 dark:text-zinc-300">
                <p>
                  <strong className="text-zinc-900 dark:text-zinc-100">Fellowship Pedigree:</strong> Adult Joint Reconstruction Fellowship, Mayo Clinic; Royal National Orthopaedic Hospital, Stanmore.
                </p>
                <p>
                  <strong className="text-zinc-900 dark:text-zinc-100">Scholarly Impact:</strong> 56 papers in <em className="text-zinc-800 dark:text-zinc-200">JBJS</em> and <em className="text-zinc-800 dark:text-zinc-200">The Lancet</em> on custom laser-sintered trabecular titanium kinematics.
                </p>
                <p>
                  <strong className="text-zinc-900 dark:text-zinc-100">Specialty Focus:</strong> MAKO robotic knee/hip replacement, same-day ambulatory joint discharge, revision hip cages.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-xs font-medium text-zinc-500">Suite 4 · Edinburgh</span>
                <Link
                  href="/book"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                >
                  <span>Book Consultation</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={13} />
                </Link>
              </div>
            </div>

            {/* Faculty 4 */}
            <div className="group rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="size-14 rounded-2xl bg-emerald-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                    ER
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-950 dark:text-white">
                      Dr. Elena Rostova
                    </h3>
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      MD, PhD, FRCOG, FACOG
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Director of Maternal-Fetal & Robotic Surgery
                    </p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                  <HugeiconsIcon icon={BadgeCheckIcon} size={14} className="text-emerald-500" />
                  <span>18 Yrs Experience</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2 text-xs text-zinc-600 dark:text-zinc-300">
                <p>
                  <strong className="text-zinc-900 dark:text-zinc-100">Fellowship Pedigree:</strong> Fetal Therapy Fellowship, Johns Hopkins Center for Fetal Therapy; Karolinska Institute Research Scholar.
                </p>
                <p>
                  <strong className="text-zinc-900 dark:text-zinc-100">Scholarly Impact:</strong> 52 clinical publications in <em className="text-zinc-800 dark:text-zinc-200">The Lancet</em> and <em className="text-zinc-800 dark:text-zinc-200">NEJM</em> on in-utero fetoscopic balloon occlusion.
                </p>
                <p>
                  <strong className="text-zinc-900 dark:text-zinc-100">Specialty Focus:</strong> High-risk fetal-maternal therapy, nerve-sparing deep endometriosis excision, single-port robotic myomectomy.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-xs font-medium text-zinc-500">Suite 2 · Edinburgh</span>
                <Link
                  href="/book"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                >
                  <span>Book Consultation</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={13} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: PATIENT SUCCESS STORIES & CASE HIGHLIGHTS
          Real complex cases successfully resolved, rapid rehabilitation milestones
          ========================================================================= */}
      <section className="relative px-5 py-16 md:px-8 md:py-24 bg-zinc-100/60 dark:bg-zinc-900/40 border-t border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 shadow-xs">
              <HugeiconsIcon icon={Activity01Icon} size={14} className="text-emerald-500" />
              <span>Documented Case Milestones</span>
            </div>
            <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
              Complex Cases. Unrivaled Recoveries.
            </h2>
            <p className="mt-3 text-base sm:text-lg text-zinc-600 dark:text-zinc-400">
              When complex anatomy meets sub-millimeter surgical robotics and enhanced recovery pathways, life-altering milestones are achieved.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {/* Case 1 */}
            <article className="rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 px-3 py-1 text-xs font-bold">
                  Cardiovascular & Thoracic
                </span>
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">64-Year-Old Triathlete</span>
              </div>
              <h3 className="mt-4 text-xl font-bold text-zinc-950 dark:text-white leading-snug">
                Robotic Double-Valve Repair Without Sternal Division
              </h3>
              <div className="mt-4 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                <p>
                  <strong className="text-zinc-900 dark:text-zinc-200">Clinical Presentation:</strong> Severe acute Barlow’s mitral regurgitation and tricuspid dilation with impending congestive heart failure.
                </p>
                <p>
                  <strong className="text-zinc-900 dark:text-zinc-200">Surgical Approach:</strong> Full robotic dual-valve reconstruction performed through four 8mm keyhole da Vinci Xi ports under high-definition 3D guidance, leaving the sternum completely intact.
                </p>
              </div>
              <div className="mt-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 p-4 border border-zinc-200/60 dark:border-zinc-700/60">
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={15} className="text-emerald-500" />
                  <span>Rehabilitation Milestone:</span>
                </p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  Ambulating in hallway 12 hours post-operation; discharged home on Day 3; resumed light cycling at 3 weeks and completed a 40km Olympic-course ride at Week 10.
                </p>
              </div>
            </article>

            {/* Case 2 */}
            <article className="rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-1 text-xs font-bold">
                  Orthopedic & Joint Reconstruction
                </span>
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">71-Year-Old Patient</span>
              </div>
              <h3 className="mt-4 text-xl font-bold text-zinc-950 dark:text-white leading-snug">
                3D-Printed Custom Titanium Acetabular Cage & Ambulatory Discharge
              </h3>
              <div className="mt-4 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                <p>
                  <strong className="text-zinc-900 dark:text-zinc-200">Clinical Presentation:</strong> Catastrophic Paprosky type 3B pelvic bone deficit following three failed conventional hip revisions abroad; non-weight bearing for 14 months.
                </p>
                <p>
                  <strong className="text-zinc-900 dark:text-zinc-200">Surgical Approach:</strong> Patient-matched laser-sintered trabecular titanium pelvic truss engineered from 0.5mm slice CT, implanted using MAKO robotic haptic boundary navigation and intraoperative cryoneurolysis.
                </p>
              </div>
              <div className="mt-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 p-4 border border-zinc-200/60 dark:border-zinc-700/60">
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={15} className="text-emerald-500" />
                  <span>Rehabilitation Milestone:</span>
                </p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  Stood and walked 40 meters unaided within 6 hours post-surgery; climbed four stairs comfortably on day 2; discharged home with zero intravenous opioid requirements.
                </p>
              </div>
            </article>

            {/* Case 3 */}
            <article className="rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 px-3 py-1 text-xs font-bold">
                  Neuro-Spine & Cerebrovascular
                </span>
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">42-Year-Old Architect</span>
              </div>
              <h3 className="mt-4 text-xl font-bold text-zinc-950 dark:text-white leading-snug">
                Endoscopic Skull Base Resection with 100% Visual Restoration
              </h3>
              <div className="mt-4 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                <p>
                  <strong className="text-zinc-900 dark:text-zinc-200">Clinical Presentation:</strong> Rapidly advancing bitemporal hemianopsia and impending blindness from a 3.7cm tuberculum sellae meningioma engulfing both optic nerves.
                </p>
                <p>
                  <strong className="text-zinc-900 dark:text-zinc-200">Surgical Approach:</strong> Expanded endonasal endoscopic corridor through natural nasal passages. Zero external scalp incision and zero frontal lobe brain retraction, guided by continuous multi-channel IONM.
                </p>
              </div>
              <div className="mt-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 p-4 border border-zinc-200/60 dark:border-zinc-700/60">
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={15} className="text-emerald-500" />
                  <span>Rehabilitation Milestone:</span>
                </p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  Gross-total oncological resection achieved. Full Humphrey 24-2 visual field restoration documented at 48 hours; patient returned to fine architectural drafting at 4 weeks.
                </p>
              </div>
            </article>

            {/* Case 4 */}
            <article className="rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-3 py-1 text-xs font-bold">
                  Women&apos;s & Maternal Health
                </span>
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">In-Utero Fetal Intervention</span>
              </div>
              <h3 className="mt-4 text-xl font-bold text-zinc-950 dark:text-white leading-snug">
                Fetoscopic Endoluminal Tracheal Occlusion (FETO) at 27 Weeks
              </h3>
              <div className="mt-4 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                <p>
                  <strong className="text-zinc-900 dark:text-zinc-200">Clinical Presentation:</strong> Severe isolated left congenital diaphragmatic hernia with liver herniation and an observed-to-expected lung head ratio (O/E LHR) of only 21%.
                </p>
                <p>
                  <strong className="text-zinc-900 dark:text-zinc-200">Surgical Approach:</strong> Ultra-thin 1.3mm curved fetoscopic micro-balloon tracheal occlusion performed under maternal local anesthesia, promoting accelerated fetal alveolar lung expansion.
                </p>
              </div>
              <div className="mt-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 p-4 border border-zinc-200/60 dark:border-zinc-700/60">
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={15} className="text-emerald-500" />
                  <span>Rehabilitation Milestone:</span>
                </p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  Fetal lung volume increased by 280% within 5 weeks; safe balloon retrieval at 34 weeks; infant born at 39 weeks crying lustily without ECMO standby required.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 6: INTERACTIVE SURGICAL FAQ
          ========================================================================= */}
      <section className="relative px-5 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 shadow-xs">
              <HugeiconsIcon icon={Stethoscope02Icon} size={14} className="text-sky-500" />
              <span>Surgical Inquiries & Guidance</span>
            </div>
            <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
              Frequently Asked Questions
            </h2>
            <p className="mt-3 text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
              Clear answers regarding direct booking, robotic capabilities, recovery protocols, and insurance accreditation.
            </p>
          </div>

          <div className="mt-10">
            <ExcellenceFaq />
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 7: CONSULTATION BOOKING CTA
          High-impact conversion card linking to /book and #doctors
          ========================================================================= */}
      <section className="relative px-5 pb-20 pt-8 md:px-8 md:pb-28">
        <div className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-3xl border border-zinc-300/80 dark:border-zinc-700 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white p-8 sm:p-12 md:p-16 shadow-2xl">
            {/* Ambient Glows */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-sky-500/20 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full bg-indigo-500/20 blur-3xl"
            />

            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3.5 py-1 text-xs font-semibold text-sky-300 backdrop-blur-sm">
                <HugeiconsIcon icon={SparklesIcon} size={14} />
                <span>Immediate Surgical Access · No NHS Waitlists</span>
              </div>

              <h2 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
                Experience World-Class Surgical Precision.
              </h2>

              <p className="mt-4 text-base sm:text-lg text-zinc-300 leading-relaxed font-normal">
                Whether you need a primary consultation, robotic second opinion, or expedited multidisciplinary case review,
                our surgical chairs and specialized navigators are ready to assist you.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4">
                <Link
                  href="/book"
                  className="inline-flex items-center justify-center gap-2.5 rounded-full bg-white px-8 py-4 text-sm font-extrabold text-zinc-950 shadow-lg shadow-white/10 hover:bg-zinc-100 hover:scale-[1.01] active:scale-[0.98] transition-all"
                >
                  <HugeiconsIcon icon={Calendar03Icon} size={18} />
                  <span>Book Surgical Consultation</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
                </Link>

                <Link
                  href="#doctors"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/80 px-6 py-4 text-sm font-semibold text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  <HugeiconsIcon icon={UserMultipleIcon} size={18} />
                  <span>Meet Our Surgical Faculty</span>
                </Link>

                <a
                  href="tel:+441314960280"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-700/60 bg-transparent px-5 py-4 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                >
                  <HugeiconsIcon icon={Call02Icon} size={16} className="text-sky-400" />
                  <span>Concierge Desk: 0131 496 0280</span>
                </a>
              </div>

              <div className="mt-8 pt-8 border-t border-zinc-800 flex flex-wrap items-center gap-6 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="text-emerald-400" />
                  <span>Direct Self-Referral Accepted</span>
                </div>
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="text-emerald-400" />
                  <span>Approved by Bupa, AXA, Aviva, Vitality</span>
                </div>
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="text-emerald-400" />
                  <span>14 Westbrook Place, Edinburgh</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
