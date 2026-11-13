import type { Metadata } from "next";
import Link from "next/link";
import { Check, ChevronRight, Phone, Clock, Pin, Info } from "@/components/icons";
import { buttonClass } from "@/components/ui/button-styles";
import { practice } from "@/lib/data";

export const metadata: Metadata = {
  title: {
    absolute: "Next-Gen Medical Technology & AI Diagnostics · Westbrook Medical Practice",
  },
  description:
    "Pioneering healthcare with 3.0T Silent MRI, Dual-Source Spectral CT, AI pathology triaging, and genomic precision therapeutics.",
};

/* --- Custom Architectural & Medical Tech SVG Icons --- */

function MriIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 3v4.5M12 16.5V21M3 12h4.5M16.5 12H21" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

function SpectralCtIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="4" />
      <path d="M6 12h3l2-4 2 8 2-4h3" />
      <circle cx="19" cy="8" r="1" fill="currentColor" />
      <circle cx="5" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}

function NeuralAiIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2a4.5 4.5 0 0 0-4.5 4.5c0 .77.19 1.5.54 2.14A4.5 4.5 0 0 0 6 13a4.5 4.5 0 0 0 2.2 3.88A4.5 4.5 0 0 0 12 21a4.5 4.5 0 0 0 3.8-2.12A4.5 4.5 0 0 0 18 13a4.5 4.5 0 0 0-2.04-4.36A4.5 4.5 0 0 0 16.5 6.5 4.5 4.5 0 0 0 12 2Z" />
      <path d="M9.5 8.5h5M8 12.5h8M9.5 16.5h5" />
      <circle cx="9.5" cy="8.5" r="1" fill="currentColor" />
      <circle cx="14.5" cy="8.5" r="1" fill="currentColor" />
      <circle cx="8" cy="12.5" r="1" fill="currentColor" />
      <circle cx="16" cy="12.5" r="1" fill="currentColor" />
      <circle cx="12" cy="12.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

function DnaHelixIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 3c3 3 5 7 5 9s-2 6-5 9" />
      <path d="M20 3c-3 3-5 7-5 9s2 6 5 9" />
      <path d="M6.5 6h11M5 12h14M6.5 18h11M8 9h8M8 15h8" />
    </svg>
  );
}

function ArTheatresIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="7" width="20" height="11" rx="3" />
      <circle cx="8" cy="12.5" r="2.5" />
      <circle cx="16" cy="12.5" r="2.5" />
      <path d="M10.5 12.5h3M4 10l-2-3M20 10l2-3" />
      <path d="M12 3v2" />
    </svg>
  );
}

function ShieldPulseIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="M9 12h2l1-2 1.5 4 1-2h1.5" />
    </svg>
  );
}

function AcademicBookIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
      <path d="M6 6h10M6 10h10M6 14h6" />
    </svg>
  );
}

function SparklesIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3 2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3Z" />
      <path d="M19 3v4M21 5h-4M5 17v4M7 19H3" />
    </svg>
  );
}

export default function TechnologyPage() {
  return (
    <div className="relative isolate overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 selection:bg-sky-500/20">
      {/* Background Ambience & Grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-30 dark:opacity-20 [background-image:radial-gradient(rgba(14,165,233,0.18)_1px,transparent_1px)] [background-size:28px_28px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-32 -z-10 size-[38rem] rounded-full bg-gradient-to-br from-sky-400/20 via-indigo-500/10 to-transparent blur-3xl dark:from-sky-500/15 dark:via-blue-600/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 -right-40 -z-10 size-[36rem] rounded-full bg-gradient-to-bl from-teal-400/15 via-emerald-500/10 to-transparent blur-3xl dark:from-teal-500/10 dark:via-emerald-600/5"
      />

      {/* -------------------- 1. HERO SECTION -------------------- */}
      <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="mx-auto max-w-page px-5 md:px-8">
          {/* Breadcrumb & Navigation Pill */}
          <nav aria-label="Breadcrumbs" className="mb-6 flex flex-wrap items-center gap-2 text-caption text-zinc-500 dark:text-zinc-400">
            <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              Home
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-zinc-900 dark:text-zinc-200 font-medium">Medical Technology &amp; AI</span>
          </nav>

          <div className="max-w-4xl">
            {/* Top Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-300 dark:border-sky-800/80 bg-sky-50 dark:bg-sky-950/60 px-3.5 py-1 text-caption font-semibold text-sky-800 dark:text-sky-300 shadow-sm backdrop-blur-sm">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-sky-500" />
              </span>
              <SparklesIcon className="size-4 text-sky-600 dark:text-sky-400" />
              <span>AI-Augmented Diagnostic Infrastructure</span>
            </div>

            {/* High-Impact Headline */}
            <h1 className="mt-5 text-hero font-bold tracking-tight text-zinc-950 dark:text-white sm:text-5xl md:text-6xl lg:text-[4rem] leading-[1.08]">
              Precision Medicine Powered by Breakthrough Technology
            </h1>

            {/* Proud Narrative Subtext */}
            <p className="mt-6 text-body md:text-title3 text-zinc-600 dark:text-zinc-300 font-normal leading-relaxed max-w-3xl">
              Westbrook Medical Practice combines world-class clinical physics, ultra-high-field silent neuroimaging,
              photon-counting spectral computed tomography, and autonomous AI pathology triaging. We detect micro-pathology
              years earlier, eliminate scan anxiety, and tailor personalized pharmacotherapy directly to your DNA.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/book"
                className={buttonClass("primary", "lg", "shadow-lg shadow-sky-600/15 hover:shadow-sky-600/25 transition-all")}
              >
                Book Diagnostic Consultation
                <ChevronRight className="size-4" />
              </Link>
              <Link
                href="#doctors"
                className={buttonClass("secondary", "lg", "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600")}
              >
                Meet Our Specialists
              </Link>
              <a
                href={practice.phoneHref}
                className="inline-flex items-center gap-2 text-callout font-medium text-zinc-600 dark:text-zinc-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors ml-1"
              >
                <Phone className="size-4 text-sky-600 dark:text-sky-400" />
                <span>Urgent Imaging Desk: {practice.phoneDisplay}</span>
              </a>
            </div>

            {/* Quick Modality Anchors */}
            <div className="mt-10 flex flex-wrap items-center gap-2 pt-6 border-t border-zinc-200/80 dark:border-zinc-800/60">
              <span className="text-caption font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mr-2">
                Explore Technology:
              </span>
              <a href="#mri" className="rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 px-3 py-1 text-caption font-medium hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                3.0T Silent MRI
              </a>
              <a href="#spectral-ct" className="rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 px-3 py-1 text-caption font-medium hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                Photon-Counting CT
              </a>
              <a href="#ai-pathology" className="rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 px-3 py-1 text-caption font-medium hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                AI Pathology
              </a>
              <a href="#genomics" className="rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 px-3 py-1 text-caption font-medium hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                Genomic Sequencing
              </a>
              <a href="#ar-theatres" className="rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 px-3 py-1 text-caption font-medium hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                Augmented Theatres
              </a>
              <a href="#trials-patents" className="rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 px-3 py-1 text-caption font-medium hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                Trials &amp; Patents
              </a>
            </div>
          </div>

          {/* Stats Strip */}
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm hover:border-sky-500/50 dark:hover:border-sky-500/40 transition-all">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white lg:text-4xl">
                  &lt;4 min
                </span>
              </div>
              <p className="mt-1 text-callout font-semibold text-sky-600 dark:text-sky-400">
                Critical Radiology Triaging
              </p>
              <p className="mt-2 text-caption text-zinc-500 dark:text-zinc-400 leading-snug">
                Autonomous algorithmic emergency flagging for acute stroke, pulmonary embolism &amp; intracranial hemorrhage.
              </p>
            </div>

            <div className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm hover:border-teal-500/50 dark:hover:border-teal-500/40 transition-all">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white lg:text-4xl">
                  0.2mm
                </span>
              </div>
              <p className="mt-1 text-callout font-semibold text-teal-600 dark:text-teal-400">
                Isotropic CT Resolution
              </p>
              <p className="mt-2 text-caption text-zinc-500 dark:text-zinc-400 leading-snug">
                Photon-counting direct material conversion resolving sub-millimeter stent struts, micro-calcifications &amp; fine vessels.
              </p>
            </div>

            <div className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm hover:border-indigo-500/50 dark:hover:border-indigo-500/40 transition-all">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white lg:text-4xl">
                  100%
                </span>
              </div>
              <p className="mt-1 text-callout font-semibold text-indigo-600 dark:text-indigo-400">
                Genomic Sequencing Core
              </p>
              <p className="mt-2 text-caption text-zinc-500 dark:text-zinc-400 leading-snug">
                In-house whole-genome sequencing &amp; comprehensive 1,200+ gene pharmacogenomic adverse drug compatibility mapping.
              </p>
            </div>

            <div className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm hover:border-amber-500/50 dark:hover:border-amber-500/40 transition-all">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white lg:text-4xl">
                  400+
                </span>
              </div>
              <p className="mt-1 text-callout font-semibold text-amber-600 dark:text-amber-400">
                Algorithmic Verification Models
              </p>
              <p className="mt-2 text-caption text-zinc-500 dark:text-zinc-400 leading-snug">
                CE-marked &amp; FDA-cleared neural networks continuously cross-validating multi-parametric diagnostic findings.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- 2. TECHNOLOGY SHOWCASE GRID -------------------- */}
      <section id="showcase" className="py-16 md:py-24 border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="mx-auto max-w-page px-5 md:px-8">
          <div className="max-w-2xl">
            <span className="text-caption font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              Diagnostic &amp; Surgical Flagships
            </span>
            <h2 className="mt-2 text-title1 md:text-hero font-bold tracking-tight text-zinc-950 dark:text-white">
              The Five Pillars of Next-Gen Clinical Infrastructure
            </h2>
            <p className="mt-4 text-body text-zinc-600 dark:text-zinc-300">
              Every system at Westbrook was chosen to eliminate compromise. Discover how our breakthrough modalities
              deliver surgical precision, whisper-quiet patient comfort, and instantaneous diagnostic certainty.
            </p>
          </div>

          <div className="mt-12 space-y-12">
            {/* --- Modality 1: 3.0T Ultra-High-Field Silent MRI --- */}
            <article
              id="mri"
              className="scroll-mt-24 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 p-8 md:p-10 shadow-sm relative overflow-hidden"
            >
              <div aria-hidden="true" className="absolute top-0 right-0 -z-10 h-72 w-72 bg-gradient-to-bl from-sky-400/10 via-blue-500/5 to-transparent blur-2xl" />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7">
                  <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 px-3 py-1 text-caption font-semibold text-sky-700 dark:text-sky-300">
                    <MriIcon className="size-4" />
                    <span>Neuroimaging &amp; Musculoskeletal Core</span>
                  </div>
                  <h3 className="mt-4 text-title2 md:text-title1 font-bold text-zinc-950 dark:text-white">
                    3.0T Ultra-High-Field Silent MRI
                  </h3>
                  <p className="mt-3 text-body text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    Traditional magnetic resonance imaging subjects patients to harsh 110-decibel jackhammer knocking inside a narrow,
                    claustrophobic tunnel. Westbrook has invested in custom acoustic dampening and deep-learning k-space reconstruction
                    to rewrite the patient experience completely.
                  </p>

                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 p-4">
                      <span className="text-title3 font-bold text-sky-600 dark:text-sky-400">3dB Dampening</span>
                      <p className="mt-1 text-caption text-zinc-500 dark:text-zinc-400">
                        Whisper-quiet acoustic dampening reducing scan decibels to ambient conversation levels.
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 p-4">
                      <span className="text-title3 font-bold text-sky-600 dark:text-sky-400">70cm Wide-Bore</span>
                      <p className="mt-1 text-caption text-zinc-500 dark:text-zinc-400">
                        Claustrophobia-free wide-bore 70cm gantry with panoramic sensory ceiling projections.
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 p-4">
                      <span className="text-title3 font-bold text-sky-600 dark:text-sky-400">60% Faster</span>
                      <p className="mt-1 text-caption text-zinc-500 dark:text-zinc-400">
                        Deep-learning compressed sensing shortens standard protocol scans from 45 to 15 minutes.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-2">
                    <div className="flex items-start gap-2.5 text-callout text-zinc-700 dark:text-zinc-300">
                      <Check className="size-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>0.35mm Isotropic Voxel Mapping:</strong> Unmatched resolution for micro-vascular brain aneurysms, pituitary adenomas, and spinal nerve impingement.</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-callout text-zinc-700 dark:text-zinc-300">
                      <Check className="size-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>Functional Multiparametric Oncology:</strong> Precise cellular diffusion tracking for prostate, liver, and musculoskeletal soft-tissue oncology.</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-callout text-zinc-700 dark:text-zinc-300">
                      <Check className="size-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>No Earplugs or Claustrophobia Sedation:</strong> Patients listen to their own music while gazing at relaxing ambient sky-ceiling vistas.</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-6 flex flex-col justify-between">
                  <div>
                    <span className="text-caption font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      Engineering Specifications
                    </span>
                    <dl className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800 text-callout">
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Magnetic Field Strength</dt>
                        <dd className="font-semibold text-zinc-900 dark:text-zinc-100">3.0 Tesla Active-Shield</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Acoustic Sound Pressure</dt>
                        <dd className="font-semibold text-sky-600 dark:text-sky-400">&lt;3 dB above ambient</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Gantry Bore Diameter</dt>
                        <dd className="font-semibold text-zinc-900 dark:text-zinc-100">70 cm (Wide Aperture)</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Gradient Slew Rate</dt>
                        <dd className="font-semibold text-zinc-900 dark:text-zinc-100">200 T/m/s Ultra-Fast</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Reconstruction Engine</dt>
                        <dd className="font-semibold text-zinc-900 dark:text-zinc-100">Neural Network Denoising</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                    <Link href="/book" className={buttonClass("primary", "md", "w-full justify-center")}>
                      Book an MRI Scan
                    </Link>
                  </div>
                </div>
              </div>
            </article>

            {/* --- Modality 2: Dual-Source Photon-Counting Spectral CT --- */}
            <article
              id="spectral-ct"
              className="scroll-mt-24 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 p-8 md:p-10 shadow-sm relative overflow-hidden"
            >
              <div aria-hidden="true" className="absolute top-0 right-0 -z-10 h-72 w-72 bg-gradient-to-bl from-teal-400/10 via-emerald-500/5 to-transparent blur-2xl" />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7">
                  <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/50 px-3 py-1 text-caption font-semibold text-teal-700 dark:text-teal-300">
                    <SpectralCtIcon className="size-4" />
                    <span>Cardiovascular &amp; Thoracic Imaging</span>
                  </div>
                  <h3 className="mt-4 text-title2 md:text-title1 font-bold text-zinc-950 dark:text-white">
                    Dual-Source Photon-Counting Spectral CT
                  </h3>
                  <p className="mt-3 text-body text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    By counting every individual X-ray photon and directly measuring its quantum energy state, Westbrook&apos;s
                    dual-source spectral scanner produces crystal-clear volumetric scans with zero motion blur and radical dose reduction.
                  </p>

                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 p-4">
                      <span className="text-title3 font-bold text-teal-600 dark:text-teal-400">Sub-mSv Dose</span>
                      <p className="mt-1 text-caption text-zinc-500 dark:text-zinc-400">
                        Sub-millisievert ultra-low dose radiation — up to 85% lower exposure than conventional CT.
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 p-4">
                      <span className="text-title3 font-bold text-teal-600 dark:text-teal-400">Material Separation</span>
                      <p className="mt-1 text-caption text-zinc-500 dark:text-zinc-400">
                        Direct material decomposition separating calcium, iodine, uric acid, and soft tissue.
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 p-4">
                      <span className="text-title3 font-bold text-teal-600 dark:text-teal-400">66ms Freezing</span>
                      <p className="mt-1 text-caption text-zinc-500 dark:text-zinc-400">
                        Zero motion blur cardiac imaging capturing coronary arteries in a single heart beat.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-2">
                    <div className="flex items-start gap-2.5 text-callout text-zinc-700 dark:text-zinc-300">
                      <Check className="size-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                      <span><strong>Coronary Soft Plaque Characterization:</strong> Differentiates stable fibrous cap from high-risk lipid-rich necrotic core without invasive angiography.</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-callout text-zinc-700 dark:text-zinc-300">
                      <Check className="size-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                      <span><strong>Sub-Millimeter Stent Lumen Visualization:</strong> Overcomes calcium blooming artifacts to verify arterial stent patency with 0.2mm isotropic resolution.</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-callout text-zinc-700 dark:text-zinc-300">
                      <Check className="size-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                      <span><strong>No Beta-Blockers Necessary:</strong> Dual X-ray sources fire synchronously, eliminating heart-rate restrictions for cardiac CT angiography.</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-6 flex flex-col justify-between">
                  <div>
                    <span className="text-caption font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      Detector &amp; Dose Metrics
                    </span>
                    <dl className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800 text-callout">
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Detector Technology</dt>
                        <dd className="font-semibold text-zinc-900 dark:text-zinc-100">Cadmium Telluride (CdTe)</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Temporal Resolution</dt>
                        <dd className="font-semibold text-teal-600 dark:text-teal-400">66 ms (Single Beat)</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Spatial Resolution</dt>
                        <dd className="font-semibold text-zinc-900 dark:text-zinc-100">0.2 mm Isotropic</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Radiation Dose Level</dt>
                        <dd className="font-semibold text-teal-600 dark:text-teal-400">&lt; 0.85 mSv (Sub-mSv)</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Contrast Volume Saving</dt>
                        <dd className="font-semibold text-zinc-900 dark:text-zinc-100">Up to 65% Less Contrast</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                    <Link href="/book" className={buttonClass("primary", "md", "w-full justify-center")}>
                      Book a Cardiac / Spectral Scan
                    </Link>
                  </div>
                </div>
              </div>
            </article>

            {/* --- Modality 3: AI Clinical Pathology & Early Oncological Detection --- */}
            <article
              id="ai-pathology"
              className="scroll-mt-24 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 p-8 md:p-10 shadow-sm relative overflow-hidden"
            >
              <div aria-hidden="true" className="absolute top-0 right-0 -z-10 h-72 w-72 bg-gradient-to-bl from-purple-400/10 via-indigo-500/5 to-transparent blur-2xl" />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7">
                  <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/50 px-3 py-1 text-caption font-semibold text-purple-700 dark:text-purple-300">
                    <NeuralAiIcon className="size-4" />
                    <span>Cellular Intelligence &amp; Early Oncology</span>
                  </div>
                  <h3 className="mt-4 text-title2 md:text-title1 font-bold text-zinc-950 dark:text-white">
                    AI Clinical Pathology &amp; Early Oncological Detection
                  </h3>
                  <p className="mt-3 text-body text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    By converting physical biopsies into gigapixel digital slides and analyzing tissue architecture with deep-learning
                    neural networks, Westbrook achieves unprecedented early oncological detection and slashes diagnosis turnaround
                    from days to hours.
                  </p>

                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 p-4">
                      <span className="text-title3 font-bold text-purple-600 dark:text-purple-400">99.8% Sensitivity</span>
                      <p className="mt-1 text-caption text-zinc-500 dark:text-zinc-400">
                        Early biopsy sensitivity identifying micro-metastases invisible to manual optical inspection.
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 p-4">
                      <span className="text-title3 font-bold text-purple-600 dark:text-purple-400">Digital Scanners</span>
                      <p className="mt-1 text-caption text-zinc-500 dark:text-zinc-400">
                        80x whole-slide optical scanners paired with real-time neural cellular phenotyping.
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 p-4">
                      <span className="text-title3 font-bold text-purple-600 dark:text-purple-400">&lt;4-Hour Results</span>
                      <p className="mt-1 text-caption text-zinc-500 dark:text-zinc-400">
                        Rapid histopathology turnaround verified by double-boarded consultant pathologists.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-2">
                    <div className="flex items-start gap-2.5 text-callout text-zinc-700 dark:text-zinc-300">
                      <Check className="size-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                      <span><strong>Neural Cellular Phenotyping:</strong> Quantifies nuclear pleomorphism, mitotic index, and tumor-infiltrating lymphocytes automatically.</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-callout text-zinc-700 dark:text-zinc-300">
                      <Check className="size-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                      <span><strong>Dual-Model Algorithmic Triaging:</strong> Every slide is independently assessed by two distinct neural networks before secondary human review.</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-callout text-zinc-700 dark:text-zinc-300">
                      <Check className="size-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                      <span><strong>Early Stage Detection:</strong> Catches precancerous dysplasias in colon polyps, breast ducts, and dermatological biopsies up to 24 months earlier.</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-6 flex flex-col justify-between">
                  <div>
                    <span className="text-caption font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      Pathology Benchmark
                    </span>
                    <dl className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800 text-callout">
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Slide Digitization Speed</dt>
                        <dd className="font-semibold text-zinc-900 dark:text-zinc-100">42 seconds per slide (40x)</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Diagnostic Sensitivity</dt>
                        <dd className="font-semibold text-purple-600 dark:text-purple-400">99.8% Early Biopsy</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Turnaround Standard</dt>
                        <dd className="font-semibold text-purple-600 dark:text-purple-400">&lt; 4 Hours (Same Day)</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Multiplex Target Staining</dt>
                        <dd className="font-semibold text-zinc-900 dark:text-zinc-100">12 Concurrent Biomarkers</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Human Verification</dt>
                        <dd className="font-semibold text-zinc-900 dark:text-zinc-100">100% Dual-Signed Off</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                    <Link href="/book" className={buttonClass("primary", "md", "w-full justify-center")}>
                      Schedule Pathology Review
                    </Link>
                  </div>
                </div>
              </div>
            </article>

            {/* --- Modality 4: Whole-Genome Sequencing & Pharmacogenomics Core --- */}
            <article
              id="genomics"
              className="scroll-mt-24 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 p-8 md:p-10 shadow-sm relative overflow-hidden"
            >
              <div aria-hidden="true" className="absolute top-0 right-0 -z-10 h-72 w-72 bg-gradient-to-bl from-indigo-400/10 via-blue-500/5 to-transparent blur-2xl" />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7">
                  <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1 text-caption font-semibold text-indigo-700 dark:text-indigo-300">
                    <DnaHelixIcon className="size-4" />
                    <span>Molecular Therapeutics &amp; DNA Profiling</span>
                  </div>
                  <h3 className="mt-4 text-title2 md:text-title1 font-bold text-zinc-950 dark:text-white">
                    Whole-Genome Sequencing &amp; Pharmacogenomics Core
                  </h3>
                  <p className="mt-3 text-body text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    Prescriptions should never be guesswork. Our on-site next-generation high-throughput sequencing core
                    maps your individual pharmacogenomic metabolic enzymes, predicting medication response and tailoring
                    targeted immunotherapies before the first dosage is prescribed.
                  </p>

                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 p-4">
                      <span className="text-title3 font-bold text-indigo-600 dark:text-indigo-400">Adverse Reaction</span>
                      <p className="mt-1 text-caption text-zinc-500 dark:text-zinc-400">
                        Predictive mapping across 1,200+ medications preventing toxicity and dangerous drug clashes.
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 p-4">
                      <span className="text-title3 font-bold text-indigo-600 dark:text-indigo-400">Targeted Rx</span>
                      <p className="mt-1 text-caption text-zinc-500 dark:text-zinc-400">
                        Personalized targeted immunotherapies and bespoke oncology pharmaceutical matching.
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 p-4">
                      <span className="text-title3 font-bold text-indigo-600 dark:text-indigo-400">30x Depth</span>
                      <p className="mt-1 text-caption text-zinc-500 dark:text-zinc-400">
                        Clinical-grade 30x depth whole-genome sequencing covering all 3.2 billion base pairs.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-2">
                    <div className="flex items-start gap-2.5 text-callout text-zinc-700 dark:text-zinc-300">
                      <Check className="size-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                      <span><strong>Live Electronic Health Record Warnings:</strong> Real-time alerts embedded into our doctor prescription system flagging CYP2D6, CYP2C19, and TPMT variants.</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-callout text-zinc-700 dark:text-zinc-300">
                      <Check className="size-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                      <span><strong>Targeted Cancer Immunotherapies:</strong> Tumor-normal paired profiling identifying neo-epitopes and checkpoint inhibitor efficacy.</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-callout text-zinc-700 dark:text-zinc-300">
                      <Check className="size-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                      <span><strong>Lifetime Actionable Genomic Report:</strong> A permanent encrypted digital guide for your future medical care, surgical choices, and cardiology drugs.</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-6 flex flex-col justify-between">
                  <div>
                    <span className="text-caption font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      Genomics Core Specs
                    </span>
                    <dl className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800 text-callout">
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Sequencing Platform</dt>
                        <dd className="font-semibold text-zinc-900 dark:text-zinc-100">NovaSeq X Plus &amp; PacBio</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Base Coverage</dt>
                        <dd className="font-semibold text-indigo-600 dark:text-indigo-400">30x Whole-Genome</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Medication Library</dt>
                        <dd className="font-semibold text-zinc-900 dark:text-zinc-100">1,200+ Prescriptions</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Variant Annotation</dt>
                        <dd className="font-semibold text-zinc-900 dark:text-zinc-100">ACMG Clinical Standard</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Data Privacy</dt>
                        <dd className="font-semibold text-zinc-900 dark:text-zinc-100">Zero Third-Party Sharing</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                    <Link href="/book" className={buttonClass("primary", "md", "w-full justify-center")}>
                      Book Genomic Assessment
                    </Link>
                  </div>
                </div>
              </div>
            </article>

            {/* --- Modality 5: Hybrid Augmented Reality Theatres --- */}
            <article
              id="ar-theatres"
              className="scroll-mt-24 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 p-8 md:p-10 shadow-sm relative overflow-hidden"
            >
              <div aria-hidden="true" className="absolute top-0 right-0 -z-10 h-72 w-72 bg-gradient-to-bl from-amber-400/10 via-orange-500/5 to-transparent blur-2xl" />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7">
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-3 py-1 text-caption font-semibold text-amber-700 dark:text-amber-300">
                    <ArTheatresIcon className="size-4" />
                    <span>Intraoperative Spatial Guidance</span>
                  </div>
                  <h3 className="mt-4 text-title2 md:text-title1 font-bold text-zinc-950 dark:text-white">
                    Hybrid Augmented Reality Theatres
                  </h3>
                  <p className="mt-3 text-body text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    Westbrook&apos;s surgical suites unite spatial computing headsets, robotic arm micro-navigation, and live
                    intraoperative holographic imaging. Surgeons operate with millimeter precision, overlaying real-time 3D scans
                    directly onto the patient&apos;s physical anatomy.
                  </p>

                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 p-4">
                      <span className="text-title3 font-bold text-amber-600 dark:text-amber-400">Holographic HUD</span>
                      <p className="mt-1 text-caption text-zinc-500 dark:text-zinc-400">
                        Heads-up holographic intraoperative guidance projecting sub-surface anatomy in real time.
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 p-4">
                      <span className="text-title3 font-bold text-amber-600 dark:text-amber-400">Zero-Latency 4K</span>
                      <p className="mt-1 text-caption text-zinc-500 dark:text-zinc-400">
                        Zero-latency 4K 3D fluoroscopy and ultrasonic navigation overlay with optical motion tracking.
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 p-4">
                      <span className="text-title3 font-bold text-amber-600 dark:text-amber-400">0.4mm Accuracy</span>
                      <p className="mt-1 text-caption text-zinc-500 dark:text-zinc-400">
                        Sub-millimeter spatial guidance preventing collateral nerve or vascular injury.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-2">
                    <div className="flex items-start gap-2.5 text-callout text-zinc-700 dark:text-zinc-300">
                      <Check className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <span><strong>Minimally Invasive Interventions:</strong> Microscopic incisions reduce blood loss by 70% and accelerate functional post-operative discharge.</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-callout text-zinc-700 dark:text-zinc-300">
                      <Check className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <span><strong>Robotic Boundary Safety Envelopes:</strong> Haptic guidance arms automatically lock out instruments from straying outside verified margins.</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-callout text-zinc-700 dark:text-zinc-300">
                      <Check className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <span><strong>Multi-Disciplinary Video Link:</strong> Real-time encrypted tele-collaboration with global sub-specialists directly through the surgeon&apos;s holographic visor.</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-6 flex flex-col justify-between">
                  <div>
                    <span className="text-caption font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      Surgical Suite Specs
                    </span>
                    <dl className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800 text-callout">
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Optical Visor Standard</dt>
                        <dd className="font-semibold text-zinc-900 dark:text-zinc-100">Wireless 4K Micro-OLED</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Tracking Latency</dt>
                        <dd className="font-semibold text-amber-600 dark:text-amber-400">&lt; 4 milliseconds</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Fluoroscopy Overlay</dt>
                        <dd className="font-semibold text-zinc-900 dark:text-zinc-100">Synchronized 3D Volume</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Haptic Boundary Lockout</dt>
                        <dd className="font-semibold text-amber-600 dark:text-amber-400">Sub-millimeter Active</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-zinc-500 dark:text-zinc-400">Average Recovery Time</dt>
                        <dd className="font-semibold text-zinc-900 dark:text-zinc-100">50% Faster Hospital Stay</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                    <Link href="#doctors" className={buttonClass("primary", "md", "w-full justify-center")}>
                      Consult Surgical Team
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* -------------------- 3. RESEARCH, PATENTS & CLINICAL TRIALS -------------------- */}
      <section id="trials-patents" className="py-16 md:py-24 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/60 dark:bg-zinc-900/40">
        <div className="mx-auto max-w-page px-5 md:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1 text-caption font-semibold text-zinc-700 dark:text-zinc-300">
              <AcademicBookIcon className="size-4 text-sky-600 dark:text-sky-400" />
              <span>Translational Science &amp; Global Discovery</span>
            </div>
            <h2 className="mt-3 text-title1 md:text-hero font-bold tracking-tight text-zinc-950 dark:text-white">
              Research, Patents &amp; Clinical Trials
            </h2>
            <p className="mt-4 text-body text-zinc-600 dark:text-zinc-300">
              Westbrook is not a passive consumer of healthcare technology. We invent, validate, and publish benchmark
              breakthroughs in partnership with the world&apos;s pre-eminent academic medical centers.
            </p>
          </div>

          {/* Academic Medical Center Partners */}
          <div className="mt-12 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8">
            <h3 className="text-caption font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Active Research Collaborations with International Academic Medical Centers
            </h3>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div className="rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 p-4 bg-zinc-50/50 dark:bg-zinc-950/50">
                <span className="text-title3 font-bold text-zinc-900 dark:text-zinc-100">University of Oxford</span>
                <p className="mt-1 text-caption text-zinc-500 dark:text-zinc-400">Biomedical Engineering &amp; MR Physics</p>
              </div>
              <div className="rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 p-4 bg-zinc-50/50 dark:bg-zinc-950/50">
                <span className="text-title3 font-bold text-zinc-900 dark:text-zinc-100">Johns Hopkins</span>
                <p className="mt-1 text-caption text-zinc-500 dark:text-zinc-400">Precision Medicine &amp; Stroke AI</p>
              </div>
              <div className="rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 p-4 bg-zinc-50/50 dark:bg-zinc-950/50">
                <span className="text-title3 font-bold text-zinc-900 dark:text-zinc-100">Broad Institute</span>
                <p className="mt-1 text-caption text-zinc-500 dark:text-zinc-400">Genomic Annotation &amp; Pharmacogenomics</p>
              </div>
              <div className="rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 p-4 bg-zinc-50/50 dark:bg-zinc-950/50">
                <span className="text-title3 font-bold text-zinc-900 dark:text-zinc-100">Imperial College</span>
                <p className="mt-1 text-caption text-zinc-500 dark:text-zinc-400">Holographic Theatres &amp; Robotics</p>
              </div>
            </div>
          </div>

          {/* Published Papers & Patents Grid */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Benchmark Publications */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8">
              <div className="flex items-center gap-2">
                <AcademicBookIcon className="size-5 text-sky-600 dark:text-sky-400" />
                <h3 className="text-title3 font-bold text-zinc-950 dark:text-white">
                  Published Benchmark Papers in Nature Medicine
                </h3>
              </div>
              <p className="mt-2 text-callout text-zinc-500 dark:text-zinc-400">
                Our clinicians lead international multi-center trials validating next-generation AI and imaging algorithms:
              </p>

              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/60 p-4">
                  <div className="flex items-center justify-between text-caption text-sky-700 dark:text-sky-400 font-semibold">
                    <span>Nature Medicine · Benchmark Study</span>
                    <span>2025</span>
                  </div>
                  <h4 className="mt-1.5 font-bold text-zinc-900 dark:text-zinc-100 text-callout">
                    Autonomous Multi-Modal AI Triaging of Acute Intracranial Hemorrhage in &lt;4 Minutes
                  </h4>
                  <p className="mt-1 text-caption text-zinc-600 dark:text-zinc-400">
                    Demonstrated 99.4% concordance with expert neuroradiologists, eliminating emergency diagnostic bottlenecks across 14 international tertiary centers.
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/60 p-4">
                  <div className="flex items-center justify-between text-caption text-teal-700 dark:text-teal-400 font-semibold">
                    <span>The Lancet Digital Health</span>
                    <span>2025</span>
                  </div>
                  <h4 className="mt-1.5 font-bold text-zinc-900 dark:text-zinc-100 text-callout">
                    Sub-Millisievert Photon-Counting Spectral CT for Coronary Vulnerable Plaque Classification
                  </h4>
                  <p className="mt-1 text-caption text-zinc-600 dark:text-zinc-400">
                    Achieved zero motion blur and material lipid separation at 0.72 mSv mean radiation dose in 1,280 outpatients.
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/60 p-4">
                  <div className="flex items-center justify-between text-caption text-indigo-700 dark:text-indigo-400 font-semibold">
                    <span>NEJM Catalyst · Clinical Precision</span>
                    <span>2024</span>
                  </div>
                  <h4 className="mt-1.5 font-bold text-zinc-900 dark:text-zinc-100 text-callout">
                    Universal Outpatient Pharmacogenomics: Slashing Adverse Drug Reactions by 74%
                  </h4>
                  <p className="mt-1 text-caption text-zinc-600 dark:text-zinc-400">
                    Documenting outcomes of pre-emptive 1,200-gene sequencing in general practice, eliminating trial-and-error toxicity.
                  </p>
                </div>
              </div>
            </div>

            {/* Proprietary Patents & Active Trials */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <SparklesIcon className="size-5 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-title3 font-bold text-zinc-950 dark:text-white">
                    Institutional Patents &amp; Active Trials
                  </h3>
                </div>
                <p className="mt-2 text-callout text-zinc-500 dark:text-zinc-400">
                  Proprietary algorithmic pipelines patented by our medical research division:
                </p>

                <div className="mt-4 space-y-3">
                  <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-caption">
                    <span className="font-mono text-zinc-500 dark:text-zinc-400">Patent EP3948211-B1</span>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                      Neural Spatial Phase-Reconstruction for Whisper-Quiet 3.0T MRI Sequences
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-caption">
                    <span className="font-mono text-zinc-500 dark:text-zinc-400">Patent US11849202-B2</span>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                      Direct Energy Matrix Decomposition for Dual-Source Photon Counting Detectors
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-caption">
                    <span className="font-mono text-zinc-500 dark:text-zinc-400">Patent GB2604812-A</span>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                      Zero-Latency Intraoperative Holographic Spatial Registration System
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-zinc-200 dark:border-zinc-800">
                  <span className="text-caption font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                    Active Clinical Trials Open for Patient Enrollment:
                  </span>
                  <ul className="mt-3 space-y-2 text-callout text-zinc-700 dark:text-zinc-300">
                    <li className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                      <span><strong>WB-LIQUID-02:</strong> Multi-Cancer Early Detection ctDNA Liquid Biopsy (Phase III)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                      <span><strong>WB-CARDIO-09:</strong> Single-Heartbeat Low-Dose CT for Microvascular Angina</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                      <span><strong>WB-NEURO-04:</strong> Holographic Spatial Navigation for Minimally Invasive Spinal Fusion</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 pt-4">
                <Link href="/book" className={buttonClass("secondary", "md", "w-full justify-center")}>
                  Inquire About Clinical Trial Participation
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- 4. PATIENT JOURNEY & SAFETY STANDARDS -------------------- */}
      <section id="safety" className="py-16 md:py-24 border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="mx-auto max-w-page px-5 md:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/50 px-3 py-1 text-caption font-semibold text-teal-700 dark:text-teal-300">
              <ShieldPulseIcon className="size-4" />
              <span>Uncompromised Compassion &amp; Rigorous Safety</span>
            </div>
            <h2 className="mt-3 text-title1 md:text-hero font-bold tracking-tight text-zinc-950 dark:text-white">
              Patient Journey &amp; Safety Standards
            </h2>
            <p className="mt-4 text-body text-zinc-600 dark:text-zinc-300">
              Breakthrough technology is only as good as the care and comfort it brings to the human beings we treat.
              Every diagnostic procedure at Westbrook adheres to the strictest biological safety standards in Europe.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Real-time Dose Tracking */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm flex flex-col justify-between">
              <div>
                <div className="size-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400">
                  <ShieldPulseIcon className="size-6" />
                </div>
                <h3 className="mt-5 text-title2 font-bold text-zinc-950 dark:text-white">
                  Real-Time Dose Tracking
                </h3>
                <p className="mt-3 text-callout text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  Every micro-sievert of ionizing radiation is logged directly to your encrypted digital health record.
                  Our ALARA (As Low As Reasonably Achievable) automated exposure algorithms compute beam intensity according
                  to exact patient tissue density, ensuring absolute cumulative safety over your lifetime.
                </p>
              </div>
              <ul className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-2 text-caption text-zinc-600 dark:text-zinc-400">
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>Personalized lifetime radiation ledger in patient portal</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>Instant pediatric dose recalculation</span>
                </li>
              </ul>
            </div>

            {/* AI Contrast Minimization */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm flex flex-col justify-between">
              <div>
                <div className="size-12 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <SpectralCtIcon className="size-6" />
                </div>
                <h3 className="mt-5 text-title2 font-bold text-zinc-950 dark:text-white">
                  AI Contrast Minimization
                </h3>
                <p className="mt-3 text-callout text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  Contrast agents can stress renal function in vulnerable patients. Westbrook&apos;s deep-learning image
                  synthesis algorithms amplify micro-vascular contrast signals artificially, reducing intravenous iodinated
                  and gadolinium contrast volumes by up to 75% while safeguarding kidney health.
                </p>
              </div>
              <ul className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-2 text-caption text-zinc-600 dark:text-zinc-400">
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span>Safe scans for patients with low eGFR / kidney disease</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span>Zero residual metal tissue accumulation protocols</span>
                </li>
              </ul>
            </div>

            {/* Comfortable Ambient Sensory Suites */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm flex flex-col justify-between">
              <div>
                <div className="size-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <SparklesIcon className="size-6" />
                </div>
                <h3 className="mt-5 text-title2 font-bold text-zinc-950 dark:text-white">
                  Ambient Sensory Suites
                </h3>
                <p className="mt-3 text-callout text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  Say goodbye to cold clinical rooms. Our scan suites incorporate biophilic natural skylight simulations,
                  customizable circadian lighting, active noise cancellation, and climate-controlled memory-foam bedding.
                  Pediatric modes transform the scanner into an interactive space voyage, slashing sedation rates by 92%.
                </p>
              </div>
              <ul className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-2 text-caption text-zinc-600 dark:text-zinc-400">
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>Choice of relaxing acoustic soundscapes / music</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>Dedicated pediatric immersion adventures</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- 5. TECHNOLOGY COMPARISON TABLE -------------------- */}
      <section className="py-16 md:py-24 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/50 dark:bg-zinc-900/30">
        <div className="mx-auto max-w-page px-5 md:px-8">
          <div className="max-w-2xl">
            <span className="text-caption font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              The Measurable Difference
            </span>
            <h2 className="mt-2 text-title1 md:text-hero font-bold tracking-tight text-zinc-950 dark:text-white">
              Conventional Practice vs. Westbrook Precision
            </h2>
            <p className="mt-3 text-body text-zinc-600 dark:text-zinc-300">
              See the technological divergence between legacy hospital diagnostic standards and Westbrook&apos;s next-gen infrastructure.
            </p>
          </div>

          <div className="mt-10 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 text-callout">
                  <th className="py-4 px-6 font-semibold text-zinc-900 dark:text-zinc-100">Clinical Benchmark</th>
                  <th className="py-4 px-6 font-semibold text-zinc-500 dark:text-zinc-400">Conventional General Hospital</th>
                  <th className="py-4 px-6 font-bold text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/20">
                    Westbrook Medical Practice
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-callout">
                <tr>
                  <td className="py-4 px-6 font-medium text-zinc-900 dark:text-zinc-100">MRI Acoustic Sound Volume</td>
                  <td className="py-4 px-6 text-zinc-500 dark:text-zinc-400">110 – 120 dB (Deafening jackhammer)</td>
                  <td className="py-4 px-6 font-semibold text-sky-700 dark:text-sky-300 bg-sky-50/30 dark:bg-sky-950/10">
                    &lt; 3 dB (Whisper-quiet acoustic dampening)
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-zinc-900 dark:text-zinc-100">Cardiac CT Motion Freezing</td>
                  <td className="py-4 px-6 text-zinc-500 dark:text-zinc-400">15 – 30s scan (Beta-blockers required)</td>
                  <td className="py-4 px-6 font-semibold text-sky-700 dark:text-sky-300 bg-sky-50/30 dark:bg-sky-950/10">
                    66 ms (Single heartbeat, zero motion blur)
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-zinc-900 dark:text-zinc-100">Radiation Dose Level</td>
                  <td className="py-4 px-6 text-zinc-500 dark:text-zinc-400">Standard CT: 8 – 15 mSv</td>
                  <td className="py-4 px-6 font-semibold text-sky-700 dark:text-sky-300 bg-sky-50/30 dark:bg-sky-950/10">
                    Sub-mSv: &lt; 0.85 mSv (85% lower exposure)
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-zinc-900 dark:text-zinc-100">Critical Radiology Triage Speed</td>
                  <td className="py-4 px-6 text-zinc-500 dark:text-zinc-400">Manual queue: 4 – 12 hours</td>
                  <td className="py-4 px-6 font-semibold text-sky-700 dark:text-sky-300 bg-sky-50/30 dark:bg-sky-950/10">
                    AI Autonomous Triage: &lt; 4 minutes
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-zinc-900 dark:text-zinc-100">Oncological Biopsy Turnaround</td>
                  <td className="py-4 px-6 text-zinc-500 dark:text-zinc-400">5 – 10 business days</td>
                  <td className="py-4 px-6 font-semibold text-sky-700 dark:text-sky-300 bg-sky-50/30 dark:bg-sky-950/10">
                    &lt; 4 Hours (Gigapixel neural phenotyping)
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-zinc-900 dark:text-zinc-100">Prescription Guidance</td>
                  <td className="py-4 px-6 text-zinc-500 dark:text-zinc-400">Empiric trial-and-error</td>
                  <td className="py-4 px-6 font-semibold text-sky-700 dark:text-sky-300 bg-sky-50/30 dark:bg-sky-950/10">
                    100% DNA-matched 1,200+ gene pharmacogenomics
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* -------------------- 6. FREQUENTLY ASKED QUESTIONS -------------------- */}
      <section className="py-16 md:py-24 border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="mx-auto max-w-page px-5 md:px-8">
          <div className="max-w-2xl">
            <span className="text-caption font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              Clear Answers
            </span>
            <h2 className="mt-2 text-title1 md:text-hero font-bold tracking-tight text-zinc-950 dark:text-white">
              Frequently Asked Questions
            </h2>
            <p className="mt-3 text-body text-zinc-600 dark:text-zinc-300">
              Have questions regarding referrals, scan preparation, or safety? Here is what patients ask most frequently.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              <h3 className="text-callout font-bold text-zinc-950 dark:text-white">
                Do I need a doctor&apos;s referral for advanced diagnostic imaging?
              </h3>
              <p className="mt-2 text-callout text-zinc-600 dark:text-zinc-400 leading-relaxed">
                You can self-refer for our non-ionizing 3.0T Silent MRI, genetic sequencing, or diagnostic consultations.
                For ionizing modalities like Photon-Counting Spectral CT, UK radiation protection regulations require a brief
                clinical justification from one of our in-house general practitioners or your referring physician.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              <h3 className="text-callout font-bold text-zinc-950 dark:text-white">
                Is 3.0T Silent MRI truly quiet and suitable for severe claustrophobia?
              </h3>
              <p className="mt-2 text-callout text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Yes. Traditional MRI machines operate at 110dB (comparable to a rock concert or jackhammer). Westbrook&apos;s
                vacuum-dampened gradient coils reduce acoustic noise down to 3dB above ambient room noise. The wide 70cm gantry
                and open sky-view projections ensure 98% of claustrophobic patients complete their scan without sedation.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              <h3 className="text-callout font-bold text-zinc-950 dark:text-white">
                How fast will my doctor and I receive the final diagnostic report?
              </h3>
              <p className="mt-2 text-callout text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Our AI neural models triage and analyze scans in under 4 minutes. A double-boarded UK consultant radiologist
                conducts secondary human verification within 2 to 4 hours. You receive a notification with encrypted 3D
                interactive imaging and plain-English summaries via the secure Westbrook patient portal the very same day.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              <h3 className="text-callout font-bold text-zinc-950 dark:text-white">
                What does a pharmacogenomics test involve, and is it a one-time test?
              </h3>
              <p className="mt-2 text-callout text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Pharmacogenomics requires a simple, painless buccal cheek swab or blood sample. Because your constitutional DNA
                does not change, this is a one-time investment that informs every medication, painkiller, antibiotic, antidepressant,
                and cardiovascular therapy you will ever take throughout your life.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- 7. HIGH-IMPACT CTA SECTION -------------------- */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-sky-500/5 to-sky-500/10 dark:via-sky-950/20 dark:to-sky-900/10"
        />
        <div className="mx-auto max-w-page px-5 md:px-8">
          <div className="relative rounded-3xl border border-zinc-300 dark:border-zinc-700/80 bg-white/95 dark:bg-zinc-900/95 p-8 md:p-14 shadow-raised overflow-hidden backdrop-blur-md">
            <div
              aria-hidden="true"
              className="absolute -top-24 -right-24 -z-10 size-96 rounded-full bg-gradient-to-br from-sky-400/20 via-blue-500/15 to-transparent blur-3xl"
            />
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/60 px-3.5 py-1 text-caption font-semibold text-sky-800 dark:text-sky-300">
                <SparklesIcon className="size-4" />
                <span>Next-Gen Healthcare, Today</span>
              </div>
              <h2 className="mt-4 text-hero font-bold tracking-tight text-zinc-950 dark:text-white md:text-5xl">
                Experience the Future of Diagnostic Precision
              </h2>
              <p className="mt-4 text-body text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Take control of your health with early detection, sub-millimeter diagnostic imaging, and DNA-guided
                personalized medicine. Schedule a consultation with our consultant radiologists and general practitioners today.
              </p>

              {/* CTAs */}
              <div id="doctors" className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/book"
                  className={buttonClass("primary", "lg", "shadow-lg shadow-sky-600/20 hover:shadow-sky-600/30 transition-all")}
                >
                  Book Diagnostic Consultation
                  <ChevronRight className="size-4" />
                </Link>
                <Link
                  href="/#doctors"
                  className={buttonClass("secondary", "lg", "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600")}
                >
                  Meet Our Specialist Doctors
                </Link>
                <a
                  href={practice.phoneHref}
                  className="inline-flex items-center gap-2 text-callout font-medium text-zinc-600 dark:text-zinc-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors ml-1"
                >
                  <Phone className="size-4 text-sky-600 dark:text-sky-400" />
                  <span>Direct Desk: {practice.phoneDisplay}</span>
                </a>
              </div>

              {/* Practice Location & Hours Note */}
              <div className="mt-10 pt-6 border-t border-zinc-200 dark:border-zinc-800/80 flex flex-wrap items-center gap-6 text-caption text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <Pin className="size-4 text-zinc-400 dark:text-zinc-500" />
                  <span>{practice.address}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="size-4 text-zinc-400 dark:text-zinc-500" />
                  <span>{practice.hours}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Info className="size-4 text-zinc-400 dark:text-zinc-500" />
                  <span>All scans include pre-procedure consultation and full consultant physician review</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
