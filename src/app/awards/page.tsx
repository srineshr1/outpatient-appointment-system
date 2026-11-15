import type { Metadata } from "next";
import Link from "next/link";
import type { SVGProps } from "react";
import { practice } from "@/lib/data";

export const metadata: Metadata = {
  title: "Accreditations, Global Honors & Doctor Awards · Westbrook Medical Practice",
  description:
    "JCI Gold Seal accredited, recognized among the top global healthcare institutions for clinical quality, safety, and medical leadership.",
  openGraph: {
    title: "Accreditations, Global Honors & Doctor Awards · Westbrook Medical Practice",
    description:
      "JCI Gold Seal accredited, recognized among the top global healthcare institutions for clinical quality, safety, and medical leadership.",
  },
};

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function AwardMedalIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

function ShieldCheckIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function StarIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
      {...props}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function CertificateIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect width="18" height="14" x="3" y="3" rx="2" />
      <path d="m9 7 3 3 5-5" />
      <path d="M7 17v4l4-2 4 2v-4" />
    </svg>
  );
}

function DownloadIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function CheckCircleIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ArrowUpRightIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

function QuoteIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M10 11H6a3 3 0 0 1 3-3V6a5 5 0 0 0-5 5v7h6v-7zm10 0h-4a3 3 0 0 1 3-3V6a5 5 0 0 0-5 5v7h6v-7z" />
    </svg>
  );
}

const STATS = [
  {
    number: "#1",
    label: "Ranked Regional Medical Facility",
    period: "2024–2026",
    description: "Evaluated as top-tier for overall clinical outcomes, diagnostic speed, and patient satisfaction.",
    highlight: "Gold Rank",
  },
  {
    number: "100%",
    label: "Accreditation Compliance Score",
    period: "Quadrennial Review",
    description: "Zero non-conformities across 1,200 stringent standards set by Joint Commission International.",
    highlight: "Zero Defects",
  },
  {
    number: "48",
    label: "International Society Fellowships",
    period: "Multi-Disciplinary",
    description: "Board certifications and fellowships spanning Royal Colleges, FACS, FACC, and FAAN.",
    highlight: "Elite Faculty",
  },
  {
    number: "0.00%",
    label: "Preventable Surgical Complications",
    period: "5-Year Audit",
    description: "Flawless surgical safety protocol record across more than 14,000 outpatient interventions.",
    highlight: "Zero Harm",
  },
];

const ACCREDITATIONS = [
  {
    id: "jci",
    title: "Joint Commission International (JCI) Gold Seal",
    subtitle: "The World Standard in Healthcare Quality & Patient Safety",
    badge: "Triple JCI Gold Seal of Approval",
    badgeColor: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    validity: "2024–2027 Re-Accredited",
    description:
      "Evaluated across 1,200 rigorous safety standards with zero non-conformities. The JCI Gold Seal is the undisputed international gold benchmark acknowledging institutions that demonstrate uncompromising dedication to clinical safety, continuous quality improvement, medication safety, and patient rights.",
    highlights: [
      "Zero findings or non-conformities across 1,200 individual inspection standards",
      "Comprehensive validation of sterile surgical theaters and antimicrobial controls",
      "Global benchmark for rapid medication reconciliation and incident prevention",
    ],
  },
  {
    id: "magnet",
    title: "Magnet Recognition® for Nursing Excellence",
    subtitle: "American Nurses Credentialing Center (ANCC)",
    badge: "Top 2% Worldwide",
    badgeColor: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
    iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    validity: "2023–2027 Designated",
    description:
      "Awarded to only the top 2% of hospitals worldwide. Magnet designation is the highest international honor for professional nursing practice, leadership in patient outcomes, and transformative clinical care delivery.",
    highlights: [
      "1:1 dedicated patient-to-nurse specialist ratios in critical and post-operative suites",
      "94% of nursing faculty hold advanced Master's or Doctoral clinical degrees",
      "Consistently recognized in the 99th percentile for compassionate inpatient experience",
    ],
  },
  {
    id: "cap-iso",
    title: "CAP & ISO 15189 Laboratory Certification",
    subtitle: "College of American Pathologists & ISO Diagnostic Precision",
    badge: "Tier-1 High Complexity",
    badgeColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    validity: "2025–2028 Certified",
    description:
      "Dual accreditation from the College of American Pathologists (CAP) and ISO 15189 for medical laboratories. Validates the highest echelon of accuracy, precision, and diagnostic speed for molecular, genomic, and pathology testing.",
    highlights: [
      "Average STAT lab turnaround under 18 minutes for urgent diagnostic markers",
      "Next-generation molecular sequencing with 99.999% analytical specificity",
      "100% blind proficiency testing compliance verified across consecutive audits",
    ],
  },
  {
    id: "esc",
    title: "European Society of Cardiology Center of Excellence",
    subtitle: "ESC Accredited Lead Ambulatory Cardiology Center",
    badge: "Continental Center of Excellence",
    badgeColor: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
    iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    validity: "2024–2027 Re-Certified",
    description:
      "Recognized by the European Society of Cardiology for cutting-edge cardiovascular risk stratification, early detection of coronary artery disease, non-invasive cardiac imaging, and multidisciplinary cardiometabolic prevention.",
    highlights: [
      "Sub-15 minute door-to-ECG and specialist biomarker assessment",
      "Advanced 3D echocardiography and CT coronary angiography protocols",
      "Pioneering integrated lipidology and metabolic disease management pathways",
    ],
  },
];

const PHYSICIANS = [
  {
    name: "Dr. Marcus Vance",
    qualifications: "MD, PhD, FACS, FRCS",
    role: "Chair of Minimally Invasive & Robotic Surgery",
    honor: "Recipient of the International Lifetime Achievement Award in Minimally Invasive Surgery",
    awardBody: "World Association of Laparoscopic and Endoscopic Surgeons (WALES)",
    bio: "Internationally renowned for pioneering single-incision robotic procedures, Dr. Vance has conducted more than 6,500 interventions with a surgical complication rate well below 0.05%. His micro-laparoscopic protocols are now utilized in leading academic surgical centers across 34 countries.",
    specialties: ["Robotic Laparoscopy", "Gastrointestinal Oncology", "Surgical Innovation"],
    fellowships: ["Fellow of the American College of Surgeons (FACS)", "Fellow of the Royal College of Surgeons (FRCS)"],
    avatarInitials: "MV",
    avatarBg: "from-amber-600 to-yellow-600 text-white",
  },
  {
    name: "Dr. Elena Rostova",
    qualifications: "MD, PhD, FAAN",
    role: "Director of Neurovascular Medicine & Neuro-Diagnostics",
    honor: "Pioneer in AI-Guided Neurovascular Intervention & Lasker Clinical Research Fellow",
    awardBody: "Lasker Foundation & European Stroke Organization",
    bio: "A world authority on neurovascular perfusion imaging, Dr. Rostova led the clinical development of real-time hemodynamic AI modeling that decreased acute ischemic stroke diagnostic latency by 68%. Her research has appeared in The Lancet Neurology and The New England Journal of Medicine.",
    specialties: ["AI Neuro-Diagnostics", "Cerebral Perfusion", "Preventive Neurology"],
    fellowships: ["Lasker Clinical Research Fellow", "Fellow of the American Academy of Neurology (FAAN)"],
    avatarInitials: "ER",
    avatarBg: "from-sky-600 to-blue-700 text-white",
  },
  {
    name: "Dr. Alistair Reid",
    qualifications: "MBChB, MD, FRCP (Edin)",
    role: "Chief of Cardiovascular Medicine & Cardio-Metabolic Health",
    honor: "Royal College of Physicians Distinguished Service Medal",
    awardBody: "Royal College of Physicians (Edinburgh & London)",
    bio: "Decorated with the Royal College of Physicians Distinguished Service Medal for his landmark work over 25 years establishing comprehensive metabolic risk prevention standards. Dr. Reid has advised international panels on diabetes remission and hypertensive vascular remodeling.",
    specialties: ["Complex Hypertension", "Diabetic Cardiopathy", "Metabolic Longevity"],
    fellowships: ["Fellow of the Royal College of Physicians (FRCP)", "Scottish Society of Physicians Past President"],
    avatarInitials: "AR",
    avatarBg: "from-emerald-600 to-teal-700 text-white",
  },
  {
    name: "Dr. Sunita Cho",
    qualifications: "MD, MPH, FACC",
    role: "Senior Specialist in Preventive Cardiology & Longevity Medicine",
    honor: "Global Health Leadership Award for Preventive Cardiology",
    awardBody: "World Health Organization & International Cardiology Council",
    bio: "Recipient of the Global Health Leadership Award for spearheading public-private primary prevention programs that demonstrated a 42% decrease in secondary cardiac events. Dr. Cho holds an MPH from Harvard University and serves on the WHO Global Advisory Council for Chronic Disease.",
    specialties: ["Primary Coronary Prevention", "Women's Cardiovascular Health", "Lipidology"],
    fellowships: ["Fellow of the American College of Cardiology (FACC)", "Harvard T.H. Chan Fellow"],
    avatarInitials: "SC",
    avatarBg: "from-purple-600 to-indigo-700 text-white",
  },
];

const CLINICAL_BENCHMARKS = [
  {
    metric: "Central-Line-Associated Bloodstream Infections (CLABSI)",
    ourScore: "0.00 / 1,000 days",
    ourProgress: 100,
    nationalAvg: "1.18 / 1,000 days",
    status: "5-Year Streak of Zero Infections",
    detail: "Unbroken 60-month streak without a single central-line or intravenous bloodstream infection.",
  },
  {
    metric: "30-Day Unplanned Readmission Rate",
    ourScore: "1.8%",
    ourProgress: 94,
    nationalAvg: "8.2% National Baseline",
    status: "78% Below National Baseline",
    detail: "Proactive discharge planning, 48-hour follow-up consultations, and rapid outpatient support.",
  },
  {
    metric: "WHO Surgical Safety Checklist Adherence",
    ourScore: "100.0%",
    ourProgress: 100,
    nationalAvg: "91.4% Benchmark",
    status: "100% Full Compliance",
    detail: "Universal multi-stage time-out and digital sign-in/sign-out verification on every procedure.",
  },
  {
    metric: "Point-of-Care Medication Reconciliation Accuracy",
    ourScore: "99.98%",
    ourProgress: 99.9,
    nationalAvg: "92.3% Benchmark",
    status: "Flawless Medication Safety",
    detail: "Triple pharmacist review and automated barcode cross-verification eliminate prescribing errors.",
  },
  {
    metric: "Door-to-Specialist Diagnostic Consultation",
    ourScore: "14 Minutes",
    ourProgress: 92,
    nationalAvg: "74 Minutes Average",
    status: "81% Faster Response",
    detail: "Immediate triage and direct bedside specialist access eliminate unnecessary waiting room delays.",
  },
  {
    metric: "Verified Patient Satisfaction & Trust Index",
    ourScore: "99.4%",
    ourProgress: 99.4,
    nationalAvg: "84.1% Benchmark",
    status: "Top 0.5% in the UK",
    detail: "Independent survey of 12,000+ patients rating communication, clinical empathy, and clinical outcomes.",
  },
];

const PRESS_CITATIONS = [
  {
    source: "The Lancet Healthcare Review",
    date: "Annual Excellence Issue",
    quote:
      "Westbrook Medical Practice stands as an international beacon for outpatient quality. Their multidisciplinary clinical protocols combine academic rigor with profound patient-centered empathy.",
    badge: "Global Clinical Highlight",
  },
  {
    source: "Joint Commission International Inspection Report",
    date: "Comprehensive Triennial Audit",
    quote:
      "Westbrook represents the absolute gold standard in ambulatory clinical governance. The institution's safety culture, staff vigilance, and zero-defect record set a worldwide precedent.",
    badge: "Lead Surveyor Commendation",
  },
  {
    source: "British Medical Journal (BMJ) Quality Digest",
    date: "Clinical Governance Spotlight",
    quote:
      "The clinical outcomes achieved at Westbrook—particularly their 5-year zero infection streak and low readmission metrics—demonstrate what modern healthcare systems should strive for.",
    badge: "Best Practice Case Study",
  },
  {
    source: "Financial Times Health & Life Sciences",
    date: "Special Report on European Medical Centers",
    quote:
      "By pairing decorated physician scholars with agile, rapid-access outpatient delivery, Westbrook has reimagined clinical excellence for patients across the UK and internationally.",
    badge: "European Top Tier",
  },
];

const REPORTS = [
  {
    title: "2025–2026 Annual Clinical Governance & Patient Safety Report",
    size: "4.8 MB PDF",
    version: "Vol. 18 / Certified",
    date: "Published October 2025",
    description:
      "Complete transparency report detailing surgical outcomes, infection control registries, diagnostic accuracy metrics, and clinical quality improvement actions.",
    tag: "Primary Governance",
  },
  {
    title: "JCI Triennial Comprehensive Survey & Compliance Audit",
    size: "8.2 MB PDF",
    version: "JCI-INT-2024-C3",
    date: "Surveyed November 2024",
    description:
      "The unredacted 140-page assessment report validating 1,200 international healthcare standards with zero cited non-conformities.",
    tag: "Accreditation",
  },
  {
    title: "Infection Control, Antimicrobial Stewardship & Hygiene Audit",
    size: "2.6 MB PDF",
    version: "Q3 2025 Cycle",
    date: "Updated Quarterly",
    description:
      "Laboratory-verified sterilization audits, HEPA air filtration validation logs, and rigorous antibiotic stewardship benchmarks.",
    tag: "Infection Control",
  },
  {
    title: "Faculty Clinical Trials & Peer-Reviewed Research Compendium",
    size: "6.1 MB PDF",
    version: "Academic Year 2024–2025",
    date: "Published July 2025",
    description:
      "Over 90 peer-reviewed investigations, randomized clinical trial registries, and neurovascular innovations authored by Westbrook physicians.",
    tag: "Research & Trials",
  },
];

export default function AwardsPage() {
  return (
    <div className="relative min-h-screen bg-zinc-50 text-zinc-900 transition-colors duration-200 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Background radial atmosphere */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[48rem] overflow-hidden opacity-40 dark:opacity-20"
      >
        <div className="absolute -top-40 left-1/2 h-[42rem] w-[72rem] -translate-x-1/2 rounded-full bg-gradient-to-tr from-sky-300 via-amber-200 to-emerald-200 blur-3xl dark:from-sky-900 dark:via-amber-950 dark:to-emerald-950" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-16 lg:px-8">
        {/* =========================================================
            1. HERO SECTION
            ========================================================= */}
        <section aria-labelledby="hero-heading" className="relative text-center">
          {/* Top prestige badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/80 bg-amber-50/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-900 shadow-sm backdrop-blur-md dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
            <span className="flex items-center text-amber-500 dark:text-amber-400">
              <StarIcon size={14} />
              <StarIcon size={14} className="-ml-0.5" />
              <StarIcon size={14} className="-ml-0.5" />
            </span>
            <span>Triple JCI Gold Seal of Approval</span>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="font-bold text-amber-950 dark:text-amber-100">Evaluated Across 1,200 Standards</span>
          </div>

          <h1
            id="hero-heading"
            className="mt-6 text-balance text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-5xl md:text-6xl dark:text-white"
          >
            Global Recognition for{" "}
            <span className="bg-gradient-to-r from-sky-600 via-teal-600 to-amber-600 bg-clip-text text-transparent dark:from-sky-400 dark:via-teal-300 dark:to-amber-300">
              Clinical Excellence
            </span>{" "}
            & Patient Trust
          </h1>

          <p className="mx-auto mt-5 max-w-3xl text-pretty text-base text-zinc-600 sm:text-lg md:text-xl dark:text-zinc-300">
            {practice.name} is internationally accredited by the world&apos;s most stringent clinical oversight bodies.
            From groundbreaking minimally invasive surgical protocols to unprecedented patient safety records, our
            decorated faculty delivers unmatched outpatient healthcare in the heart of Edinburgh.
          </p>

          {/* Hero CTAs */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/book"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-950 px-7 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-zinc-800 hover:shadow-lg active:scale-95 sm:w-auto dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
            >
              <span>Book an Award-Winning Specialist</span>
              <ArrowUpRightIcon size={16} />
            </Link>

            <a
              href="#doctors"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-6 py-3.5 text-sm font-semibold text-zinc-900 shadow-sm transition-all hover:bg-zinc-100 hover:border-zinc-300 active:scale-95 sm:w-auto dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:border-zinc-700"
            >
              <AwardMedalIcon size={16} className="text-amber-500" />
              <span>Meet Honoured Faculty</span>
            </a>
          </div>

          {/* Trust strip info */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircleIcon size={14} className="text-emerald-500" />
              Direct Consultant Access
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircleIcon size={14} className="text-emerald-500" />
              Same-Day Rapid Consultations
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircleIcon size={14} className="text-emerald-500" />
              Full JCI Triennial Re-Accreditation
            </span>
          </div>

          {/* Stats strip */}
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 p-6 text-left shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-zinc-700"
              >
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">
                    {stat.number}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {stat.highlight}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{stat.label}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{stat.description}</p>
                <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                  <span>Audit Window:</span>
                  <span className="font-semibold text-zinc-600 dark:text-zinc-300">{stat.period}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* =========================================================
            2. PRESTIGIOUS ACCREDITATIONS & CERTIFICATIONS
            ========================================================= */}
        <section aria-labelledby="accreditations-heading" className="mt-20 scroll-mt-20 md:mt-28">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300">
              <ShieldCheckIcon size={14} />
              Global Safety Standards
            </span>
            <h2
              id="accreditations-heading"
              className="mt-3 text-2xl font-bold tracking-tight text-zinc-950 sm:text-4xl dark:text-white"
            >
              Prestigious Accreditations & Certifications
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-600 sm:text-base dark:text-zinc-400">
              Our clinical facility is audited by leading independent bodies across 1,200 rigorous safety indicators. We
              hold the industry&apos;s highest tier accreditations with zero non-conformities.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {ACCREDITATIONS.map((acc) => (
              <article
                key={acc.id}
                className="relative flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm transition-all duration-200 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${acc.badgeColor}`}
                    >
                      <StarIcon size={13} />
                      {acc.badge}
                    </span>
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Validity: <strong className="font-semibold text-zinc-700 dark:text-zinc-200">{acc.validity}</strong>
                    </span>
                  </div>

                  <h3 className="mt-4 text-xl font-bold tracking-tight text-zinc-950 dark:text-white">{acc.title}</h3>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                    {acc.subtitle}
                  </p>

                  <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{acc.description}</p>

                  <div className="mt-6 border-t border-zinc-100 pt-5 dark:border-zinc-800/80">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Key Audit Benchmarks Verified
                    </p>
                    <ul className="mt-3 space-y-2 text-xs text-zinc-600 dark:text-zinc-300">
                      {acc.highlights.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircleIcon size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <ShieldCheckIcon size={14} />
                    Active Accredited Status
                  </span>
                  <a
                    href="#reports"
                    className="inline-flex items-center gap-1 text-zinc-700 underline underline-offset-4 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
                  >
                    <span>View Inspection Audit</span>
                    <ArrowUpRightIcon size={12} />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* =========================================================
            3. WORLD-RENOWNED PHYSICIAN FACULTY & HONOURS
            ========================================================= */}
        <section id="doctors" aria-labelledby="physicians-heading" className="mt-20 scroll-mt-20 md:mt-28">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
              <AwardMedalIcon size={14} />
              International Faculty Distinctions
            </span>
            <h2
              id="physicians-heading"
              className="mt-3 text-2xl font-bold tracking-tight text-zinc-950 sm:text-4xl dark:text-white"
            >
              World-Renowned Physician Faculty & Honours
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-600 sm:text-base dark:text-zinc-400">
              Westbrook is home to internationally acclaimed clinicians, authors of seminal medical textbooks, and
              recipients of the highest medical society honors.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
            {PHYSICIANS.map((doc) => (
              <article
                key={doc.name}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <div>
                  {/* Doctor header */}
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${doc.avatarBg} text-lg font-bold shadow-sm`}
                      aria-hidden="true"
                    >
                      {doc.avatarInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-zinc-950 dark:text-white">{doc.name}</h3>
                        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          {doc.qualifications}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-sky-700 dark:text-sky-400">{doc.role}</p>
                    </div>
                  </div>

                  {/* Major Honor Badge */}
                  <div className="mt-5 rounded-xl border border-amber-200/80 bg-amber-50/70 p-4 dark:border-amber-500/20 dark:bg-amber-950/20">
                    <div className="flex items-start gap-2.5">
                      <AwardMedalIcon size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="text-xs font-bold text-amber-950 dark:text-amber-100">{doc.honor}</p>
                        <p className="mt-0.5 text-[11px] text-amber-800/90 dark:text-amber-300/80">
                          Conferred by {doc.awardBody}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{doc.bio}</p>

                  {/* Specializations & Fellowships */}
                  <div className="mt-5 space-y-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Fellowships & Appointments
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {doc.fellowships.map((f, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Clinical Focus
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {doc.specialties.map((s, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Consultation link */}
                <div className="mt-6 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <Link
                    href="/book"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                  >
                    <span>Request Specialist Consultation with {doc.name.split(" ")[0]} {doc.name.split(" ")[2] || doc.name.split(" ")[1]}</span>
                    <ArrowUpRightIcon size={14} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* =========================================================
            4. CLINICAL QUALITY BENCHMARKS & SAFETY MILESTONES
            ========================================================= */}
        <section aria-labelledby="benchmarks-heading" className="mt-20 scroll-mt-20 md:mt-28">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CertificateIcon size={14} />
              Empirical Safety Data
            </span>
            <h2
              id="benchmarks-heading"
              className="mt-3 text-2xl font-bold tracking-tight text-zinc-950 sm:text-4xl dark:text-white"
            >
              Clinical Quality Benchmarks & Safety Milestones
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-600 sm:text-base dark:text-zinc-400">
              Healthcare quality should be transparent and measurable. We hold our clinical team to empirical benchmarks
              that outshine national and European averages.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {CLINICAL_BENCHMARKS.map((b) => (
              <div
                key={b.metric}
                className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      {b.status}
                    </span>
                    <span className="text-[11px] font-medium text-zinc-400">Independent Audit</span>
                  </div>

                  <h3 className="mt-3 text-sm font-bold text-zinc-950 dark:text-white">{b.metric}</h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{b.detail}</p>
                </div>

                <div className="mt-6 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-[11px] font-medium text-zinc-400">Westbrook Metric</p>
                      <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{b.ourScore}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-medium text-zinc-400">Standard Baseline</p>
                      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{b.nationalAvg}</p>
                    </div>
                  </div>

                  {/* Progress visual bar */}
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                      style={{ width: `${b.ourProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Additional WHO and Quality Commitment Banner */}
          <div className="mt-8 rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-zinc-100 p-6 dark:border-zinc-800 dark:from-zinc-900/60 dark:to-zinc-900">
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheckIcon size={22} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
                    100% Adherence to WHO Safe Surgery Protocol
                  </h4>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Pre-operative briefing, patient identification verification, and post-procedural inventory checks on
                    every outpatient procedure without exception.
                  </p>
                </div>
              </div>
              <Link
                href="/book"
                className="shrink-0 rounded-full bg-zinc-900 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
              >
                Schedule Appointment
              </Link>
            </div>
          </div>
        </section>

        {/* =========================================================
            5. TESTIMONIALS & PRESS CITATIONS
            ========================================================= */}
        <section aria-labelledby="press-heading" className="mt-20 scroll-mt-20 md:mt-28">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-800 dark:border-purple-800/60 dark:bg-purple-950/40 dark:text-purple-300">
              <QuoteIcon size={13} />
              Critical Acclaim
            </span>
            <h2
              id="press-heading"
              className="mt-3 text-2xl font-bold tracking-tight text-zinc-950 sm:text-4xl dark:text-white"
            >
              Independent Endorsements & Press Citations
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-600 sm:text-base dark:text-zinc-400">
              Read how international health inspectors, academic medical journals, and leading healthcare analysts
              describe Westbrook&apos;s commitment to clinical governance.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
            {PRESS_CITATIONS.map((cite, i) => (
              <blockquote
                key={i}
                className="relative flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm transition-all hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                      {cite.badge}
                    </span>
                    <span className="text-xs text-zinc-400">{cite.date}</span>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed font-medium text-zinc-800 italic dark:text-zinc-200">
                    &ldquo;{cite.quote}&rdquo;
                  </p>
                </div>

                <footer className="mt-6 flex items-center gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    <CertificateIcon size={16} />
                  </div>
                  <div>
                    <cite className="not-italic text-xs font-bold text-zinc-950 dark:text-white">{cite.source}</cite>
                    <p className="text-[11px] text-zinc-500">Official Publication & Evaluation</p>
                  </div>
                </footer>
              </blockquote>
            ))}
          </div>
        </section>

        {/* =========================================================
            6. DOWNLOADABLE QUALITY REPORTS
            ========================================================= */}
        <section id="reports" aria-labelledby="reports-heading" className="mt-20 scroll-mt-20 md:mt-28">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              <DownloadIcon size={14} />
              Public Governance Documents
            </span>
            <h2
              id="reports-heading"
              className="mt-3 text-2xl font-bold tracking-tight text-zinc-950 sm:text-4xl dark:text-white"
            >
              Download Full Clinical Quality & Audit Reports
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-600 sm:text-base dark:text-zinc-400">
              As part of our JCI gold-seal accreditation, our complete governance reviews, infection registries, and
              accreditation audit reports are made available for public review.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
            {REPORTS.map((report) => (
              <div
                key={report.title}
                className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {report.tag}
                    </span>
                    <span className="text-xs text-zinc-400">{report.version}</span>
                  </div>

                  <h3 className="mt-3 text-base font-bold text-zinc-950 dark:text-white">{report.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{report.description}</p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <div className="text-xs text-zinc-500">
                    <span>{report.size}</span>
                    <span className="mx-2">•</span>
                    <span>{report.date}</span>
                  </div>

                  <a
                    href="#download"
                    download
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    title={`Download ${report.title}`}
                  >
                    <DownloadIcon size={13} />
                    <span>Download PDF</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* =========================================================
            7. CONVERSION / CALL TO ACTION (CTA)
            ========================================================= */}
        <section aria-labelledby="cta-heading" className="mt-20 scroll-mt-20 md:mt-28">
          <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-100 p-8 text-center shadow-lg sm:p-12 md:p-16 dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
            {/* Subtle glow effect behind CTA */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-sky-500/10 via-amber-500/5 to-transparent dark:from-sky-400/10"
            />

            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/50 dark:text-amber-300">
              <StarIcon size={14} className="text-amber-500" />
              Patient-First Excellence
            </span>

            <h2
              id="cta-heading"
              className="mt-4 text-balance text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl md:text-5xl dark:text-white"
            >
              Consult with Our Award-Winning Medical Faculty
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm text-zinc-600 sm:text-base md:text-lg dark:text-zinc-300">
              Whether you require a comprehensive health assessment, a second opinion on a complex condition, or rapid
              specialist intervention, Westbrook provides immediate access to world-recognized clinicians.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
              <Link
                href="/book"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-950 px-8 py-4 text-base font-semibold text-white shadow-md transition-all hover:bg-zinc-800 hover:shadow-lg active:scale-95 sm:w-auto dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
              >
                <span>Book a Consultation</span>
                <ArrowUpRightIcon size={18} />
              </Link>

              <a
                href="#doctors"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-7 py-4 text-base font-semibold text-zinc-900 shadow-sm transition-all hover:bg-zinc-100 hover:border-zinc-300 active:scale-95 sm:w-auto dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                <span>Explore Physician Credentials</span>
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-zinc-200/80 pt-6 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <span>📍 {practice.address}</span>
              <span>📞 {practice.phoneDisplay}</span>
              <span>⏰ Same-day appointments until {practice.sameDayClose}</span>
              <span>🔒 Encrypted patient records</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
