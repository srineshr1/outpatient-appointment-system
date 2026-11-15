"use client";

import { useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  RoboticIcon,
  HeartPulseIcon,
  Bone01Icon,
  AiBrain01Icon,
  Baby01Icon,
  CheckmarkCircle02Icon,
  ArrowRight01Icon,
  SparklesIcon,
  Activity01Icon,
  CpuIcon,
  Award01Icon,
} from "@hugeicons/core-free-icons";

export interface Institute {
  id: string;
  name: string;
  tagline: string;
  badge: string;
  icon: typeof RoboticIcon;
  accentColor: string;
  borderColor: string;
  bgGlow: string;
  overview: string;
  keyProcedures: {
    title: string;
    description: string;
  }[];
  technologies: {
    name: string;
    detail: string;
  }[];
  telemetry: {
    metric: string;
    label: string;
  }[];
  director: {
    name: string;
    role: string;
    fellowship: string;
  };
}

const INSTITUTES: Institute[] = [
  {
    id: "davinci",
    name: "da Vinci Xi Robotic & Micro-Surgical Suite",
    tagline: "Sub-millimeter precision robotics eliminating human tremor across multi-quadrant surgeries",
    badge: "Center of Robotic Mastery",
    icon: RoboticIcon,
    accentColor: "text-sky-600 dark:text-sky-400",
    borderColor: "border-sky-500/30",
    bgGlow: "from-sky-500/10 to-transparent",
    overview:
      "Westbrook houses Scotland’s highest-volume dual-console da Vinci Xi robotic theatre suite. With 10x 3DHD binocular magnification and patented EndoWrist instruments boasting 7 degrees of freedom, our surgeons execute micro-vascular anastomoses and oncological dissections with sub-millimeter precision that conventional laparoscopic methods cannot match.",
    keyProcedures: [
      {
        title: "Sub-Millimeter Robotic Precision",
        description:
          "Tremor-filtered motion scaling allows surgical manipulations at the 0.1mm threshold, sparing microscopic neurovascular bundles.",
      },
      {
        title: "Sutureless Coronary Bypass",
        description:
          "Robotically-assisted beating-heart coronary revascularization via tiny intercostal ports without requiring sternotomy.",
      },
      {
        title: "Single-Port Robotic Prostatectomy",
        description:
          "Nerve-sparing radical oncological resection through a single hidden incision, ensuring rapid urinary continence and functional preservation.",
      },
      {
        title: "Transoral Robotic Surgery (TORS)",
        description:
          "Scarless access to base-of-tongue and oropharyngeal lesions with zero facial osteotomy or tracheostomy requirements.",
      },
    ],
    technologies: [
      { name: "Dual-Console da Vinci Xi Workstation", detail: "Real-time master-slave proctoring & collaborative dual-surgeon control" },
      { name: "Firefly™ ICG Fluorescence", detail: "Near-infrared real-time intraoperative micro-vascular tissue perfusion assessment" },
      { name: "EndoWrist Micro-Forceps", detail: "7 degrees of freedom with 540-degree wrist articulation" },
    ],
    telemetry: [
      { metric: "0.1 mm", label: "Mechanical Articulation Accuracy" },
      { metric: "99.7%", label: "Negative Surgical Margin Rate" },
      { metric: "1.1 Days", label: "Median Post-Op Length of Stay" },
      { metric: "94%", label: "Reduction in Intraoperative Blood Loss" },
    ],
    director: {
      name: "Prof. Alistair Montgomery",
      role: "Lead Robotic Surgical Director",
      fellowship: "Johns Hopkins Hospital & Oxford",
    },
  },
  {
    id: "cardio",
    name: "Cardiovascular & Thoracic Institute",
    tagline: "Pioneering structural heart solutions, beating-heart revascularization, and hybrid arrhythmia ablation",
    badge: "Structural Heart Center of Excellence",
    icon: HeartPulseIcon,
    accentColor: "text-rose-600 dark:text-rose-400",
    borderColor: "border-rose-500/30",
    bgGlow: "from-rose-500/10 to-transparent",
    overview:
      "Our Cardiovascular & Thoracic Institute operates at the vanguard of minimally invasive cardiovascular intervention. Pairing world-class structural heart operators with hybrid operating theatres, we replace valves, ablate refractory arrhythmias, and bypass occluded vessels while drastically reducing patient physiologic strain.",
    keyProcedures: [
      {
        title: "Transcatheter Aortic Valve Replacement (TAVR)",
        description:
          "Percutaneous aortic valve deployment performed under conscious sedation, allowing high-risk patients to ambulate the next morning.",
      },
      {
        title: "Zero-Contrast PCI",
        description:
          "Complex coronary stenting guided entirely by intravascular ultrasound (IVUS) and ultra-low radiation, sparing kidney function in renal patients.",
      },
      {
        title: "Hybrid Ablation for Atrial Fibrillation",
        description:
          "Coordinated thoracoscopic epicardial and catheter-based endocardial radiofrequency ablation achieving long-term rhythm cure.",
      },
      {
        title: "Minimally Invasive Direct Coronary Bypass (MIDCAB)",
        description:
          "Small 4cm lateral mini-thoracotomy bypass on a beating heart with zero cardiopulmonary bypass pump downtime.",
      },
    ],
    technologies: [
      { name: "Philips Azurion Biplane Hybrid OR", detail: "Ultra-low dose live 3D vascular reconstruction" },
      { name: "4D Transesophageal Echocardiography", detail: "Sub-millisecond structural valve imaging" },
      { name: "Impella Micro-Axial Blood Pump", detail: "Active hemodynamic left-ventricular unloading support" },
    ],
    telemetry: [
      { metric: "99.8%", label: "30-Day Survival Rate" },
      { metric: "0.4%", label: "Cerebrovascular Event Rate" },
      { metric: "92%", label: "Discharged Home Within 48 Hours" },
      { metric: "Zero", label: "Sternotomy Invasiveness in TAVR" },
    ],
    director: {
      name: "Prof. Alistair Montgomery",
      role: "Chief of Cardiothoracic Surgery",
      fellowship: "Johns Hopkins & Edinburgh Royal Infirmary",
    },
  },
  {
    id: "ortho",
    name: "Orthopedic & Joint Reconstruction Institute",
    tagline: "Custom 3D-printed titanium osteointegration and MAKO robotic-arm precision kinematics",
    badge: "Pioneer in Joint Bio-Kinematics",
    icon: Bone01Icon,
    accentColor: "text-amber-600 dark:text-amber-400",
    borderColor: "border-amber-500/30",
    bgGlow: "from-amber-500/10 to-transparent",
    overview:
      "Transforming musculoskeletal surgery into an exact science. Using high-resolution pre-operative computed tomography, we fabricate patient-matched 3D-printed titanium implants with trabecular pore geometries identical to human bone. Utilizing MAKO robotic haptic boundary navigation, our surgeons preserve healthy bone stock and achieve same-day walking milestones.",
    keyProcedures: [
      {
        title: "Custom 3D-Printed Titanium Implants",
        description:
          "Patient-specific laser-sintered titanium components engineered to match individual anatomical pelvic and femoral geometry.",
      },
      {
        title: "MAKO Robotic Knee & Hip Replacement",
        description:
          "Dynamic real-time ligament tensioning with robotic haptic boundaries guaranteeing implant alignment within 0.5° and 0.5mm.",
      },
      {
        title: "Muscle-Sparing Anterior Hip Arthroplasty",
        description:
          "Natural tissue-plane dissection sparing major gluteal muscle detachments for immediate joint stability and zero movement restrictions.",
      },
      {
        title: "Same-Day Ambulatory Discharge Protocol",
        description:
          "Multi-modal regional sensory nerve blocks and accelerated mobilization enabling patients to comfortably walk within 4 hours.",
      },
    ],
    technologies: [
      { name: "MAKO SmartRobotics™ Platform", detail: "Haptic-guided bone resection with 3D CT virtual boundary protection" },
      { name: "Additive Titanium Trabecular Sintering", detail: "Biomimetic 80% porosity for rapid cellular bone ingrowth" },
      { name: "Targeted Cryo-Neurolysis", detail: "Prolonged localized sensory nerve freezing for opioid-free post-op analgesia" },
    ],
    telemetry: [
      { metric: "98.7%", label: "10-Year Implant Longevity Rate" },
      { metric: "4.2 Hours", label: "Average Time to Unassisted Walking" },
      { metric: "88%", label: "Same-Day Ambulatory Discharges" },
      { metric: "0.2%", label: "Post-Operative Dislocation Rate" },
    ],
    director: {
      name: "Dr. Marcus Thorne",
      role: "Chair of Orthopedic Surgery",
      fellowship: "Mayo Clinic & Royal National Orthopaedic",
    },
  },
  {
    id: "neuro",
    name: "Neuro-Spine & Advanced Cerebrovascular Center",
    tagline: "Endoscopic skull base corridors, microdiscectomy, and continuous neuro-pathway monitoring",
    badge: "Apex Neuro-Surgical Facility",
    icon: AiBrain01Icon,
    accentColor: "text-purple-600 dark:text-purple-400",
    borderColor: "border-purple-500/30",
    bgGlow: "from-purple-500/10 to-transparent",
    overview:
      "Westbrook’s Neuro-Spine & Cerebrovascular Center operates in regions where a tenth of a millimeter dictates life-altering outcomes. Our faculty leads international clinical benchmarks in endoscopic transnasal skull base excision, intraoperative continuous neuro-monitoring (IONM), and tubular microscopic spine decompressions.",
    keyProcedures: [
      {
        title: "Endoscopic Skull Base Surgery",
        description:
          "Expanded endonasal access corridors to pituitary tumors, chordomas, and meningiomas with zero external skin incisions or brain retraction.",
      },
      {
        title: "Intraoperative Neuromonitoring (IONM)",
        description:
          "Simultaneous motor-evoked potential (MEP), SSEP, and cranial nerve electromyography mapping to safeguard all neural signals continuously.",
      },
      {
        title: "Minimally Invasive Microdiscectomy",
        description:
          "Muscle-splitting micro-tubular retractor systems for disc herniations and spinal stenosis, performed on an outpatient basis.",
      },
      {
        title: "Aneurysm Coiling & Flow Diversion",
        description:
          "Endovascular microcatheter aneurysm reconstruction through radial or femoral access without opening the cranium.",
      },
    ],
    technologies: [
      { name: "Zeiss Kinevo 900 Visualization System", detail: "Robotic assisted 4K 3D digital zoom with built-in microvascular flow fluorescence" },
      { name: "StealthStation™ S8 Optical Navigation", detail: "Electromagnetic registration with 0.2mm neural spatial verification" },
      { name: "Continuous Multi-Modality IONM", detail: "Real-time automated neural integrity telemetry alert system" },
    ],
    telemetry: [
      { metric: "0%", label: "Permanent Neural Deficit Across 1,400+ Spine Cases" },
      { metric: "96.4%", label: "Skull Base Complete Gross-Total Resection" },
      { metric: "< 24 Hrs", label: "Average Lumbar Decompression Stay" },
      { metric: "85%", label: "Reduction in Paraspinal Muscle Disruption" },
    ],
    director: {
      name: "Dr. Sophia Vance",
      role: "Director of Cerebrovascular & Skull Base Surgery",
      fellowship: "Harvard Medical School & Oxford",
    },
  },
  {
    id: "womens",
    name: "Women's & Maternal Health Institute",
    tagline: "High-risk fetal-maternal therapy, complex fetoscopy, and robotic gynecological oncology",
    badge: "Maternal-Fetal Innovation Hub",
    icon: Baby01Icon,
    accentColor: "text-emerald-600 dark:text-emerald-400",
    borderColor: "border-emerald-500/30",
    bgGlow: "from-emerald-500/10 to-transparent",
    overview:
      "Dedicated to the most complex maternal, fetal, and gynecological challenges. From pioneering in-utero fetoscopic laser ablation for twin-to-twin transfusion syndrome to nerve-sparing robotic resection of deep infiltrating endometriosis, our institute provides tender, compassionate, world-leading surgical care.",
    keyProcedures: [
      {
        title: "High-Risk Fetal-Maternal Medicine",
        description:
          "In-utero fetoscopic laser ablation, tracheal occlusion (FETO), and fetal cardiac interventions performed in our specialized fetal suite.",
      },
      {
        title: "Robotic Gynecological Oncology",
        description:
          "Sentinel lymph-node navigation with indocyanine green (ICG) fluorescence and fertility-preserving ultra-precise tumor resections.",
      },
      {
        title: "Nerve-Sparing Deep Endometriosis Excision",
        description:
          "Multi-specialty excision of complex stage IV bowel and bladder infiltrating endometriosis, preserving autonomic bladder and bowel function.",
      },
      {
        title: "Single-Port Robotic Myomectomy",
        description:
          "Uterine fibroid removal through a single hidden trans-umbilical scar, fully preserving uterine architecture for future pregnancy.",
      },
    ],
    technologies: [
      { name: "1.3mm Micro-Fetoscope Instrumentation", detail: "High-resolution miniature optics for delicate amniotic cavity navigation" },
      { name: "ICG Sentinel Lymph Node Tracing", detail: "Microscopic lymphovascular channel mapping preventing lymphedema" },
      { name: "Co-Located Level IV Neonatal ICU", detail: "Instant zero-transit specialized intensive care for high-risk deliveries" },
    ],
    telemetry: [
      { metric: "100%", label: "Autonomic Nerve Preservation Rate in DIE Excision" },
      { metric: "93.8%", label: "Successful Full-Term In-Utero Intervention Delivery" },
      { metric: "95%", label: "Same-Day Discharge for Robotic Gyn Surgery" },
      { metric: "< 35 mL", label: "Average Blood Loss in Complex Myomectomy" },
    ],
    director: {
      name: "Dr. Elena Rostova",
      role: "Head of Maternal-Fetal & Robotic Gyn Surgery",
      fellowship: "Johns Hopkins Fetal Therapy Center & Karolinska",
    },
  },
];

export function ExcellenceTabs() {
  const [activeTab, setActiveTab] = useState(0);
  const activeInstitute = INSTITUTES[activeTab] ?? INSTITUTES[0]!;

  return (
    <div className="w-full">
      {/* Tab Selectors */}
      <div
        role="tablist"
        aria-label="Centers of Clinical Excellence"
        className="flex gap-2.5 overflow-x-auto pb-4 pt-2 no-scrollbar md:grid md:grid-cols-5 md:gap-3"
      >
        {INSTITUTES.map((inst, index) => {
          const isSelected = activeTab === index;
          return (
            <button
              key={inst.id}
              type="button"
              role="tab"
              id={`tab-${inst.id}`}
              aria-label={inst.name}
              aria-selected={isSelected}
              aria-controls={`panel-${inst.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setActiveTab(index)}
              className={`group flex min-w-[240px] md:min-w-0 flex-col items-start gap-2.5 rounded-2xl border p-4 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isSelected
                  ? "bg-white dark:bg-zinc-900 border-zinc-900 dark:border-white shadow-md shadow-zinc-900/5 dark:shadow-white/5"
                  : "bg-zinc-50/80 dark:bg-zinc-900/50 border-zinc-200/80 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-850 hover:border-zinc-300 dark:hover:border-zinc-700"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={`inline-flex items-center justify-center rounded-xl p-2.5 transition-colors ${
                    isSelected
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-sm"
                      : "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 group-hover:bg-zinc-300/80 dark:group-hover:bg-zinc-700"
                  }`}
                >
                  <HugeiconsIcon icon={inst.icon} size={20} />
                </span>
                <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-600 dark:text-zinc-400">
                  0{index + 1}
                </span>
              </div>
              <div>
                <h3 className={`text-sm font-bold leading-snug line-clamp-2 ${isSelected ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-300"}`}>
                  {inst.name}
                </h3>
                <p className="mt-1 text-[11.5px] font-medium text-zinc-600 dark:text-zinc-400 line-clamp-1">
                  {inst.badge}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Tab Panel */}
      <div
        role="tabpanel"
        id={`panel-${activeInstitute.id}`}
        aria-labelledby={`tab-${activeInstitute.id}`}
        className="mt-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-6 md:p-10 shadow-xl backdrop-blur-sm relative overflow-hidden"
      >
        {/* Subtle Ambient Radial Highlight */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-gradient-to-br ${activeInstitute.bgGlow} blur-3xl opacity-60`}
        />

        {/* Panel Header */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-start md:justify-between gap-6 pb-8 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100/80 dark:bg-zinc-800/80 px-3 py-1 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              <HugeiconsIcon icon={SparklesIcon} size={13} className={activeInstitute.accentColor} />
              <span>{activeInstitute.badge}</span>
            </div>
            <h3 className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              {activeInstitute.name}
            </h3>
            <p className="mt-2 text-base font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {activeInstitute.tagline}
            </p>
          </div>

          {/* Director & Credential Badge */}
          <div className="shrink-0 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-4 min-w-[260px]">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
                <HugeiconsIcon icon={Award01Icon} size={18} />
              </span>
              <div>
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Clinical Leadership</p>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{activeInstitute.director.name}</p>
              </div>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-zinc-200/60 dark:border-zinc-800/80 text-xs text-zinc-600 dark:text-zinc-400">
              <p className="font-semibold text-zinc-700 dark:text-zinc-300">{activeInstitute.director.role}</p>
              <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">Fellowship: {activeInstitute.director.fellowship}</p>
            </div>
          </div>
        </div>

        {/* Narrative Overview */}
        <div className="relative z-10 mt-8">
          <p className="text-base md:text-lg text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {activeInstitute.overview}
          </p>
        </div>

        {/* Specialized Procedures Grid */}
        <div className="relative z-10 mt-8">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            Pioneering Procedures & Interventions
          </h4>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {activeInstitute.keyProcedures.map((proc, i) => (
              <div
                key={i}
                className="group rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 p-5 transition-all hover:bg-white dark:hover:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />
                  </span>
                  <div>
                    <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-accent transition-colors">
                      {proc.title}
                    </h5>
                    <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {proc.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Technology & Telemetry Cards */}
        <div className="relative z-10 mt-8 grid gap-6 lg:grid-cols-12">
          {/* Hardware & Systems */}
          <div className="lg:col-span-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 p-6">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={CpuIcon} size={18} className="text-zinc-700 dark:text-zinc-300" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Surgical Instrumentation & Platforms
              </h4>
            </div>
            <ul className="mt-4 space-y-3">
              {activeInstitute.technologies.map((tech, i) => (
                <li key={i} className="flex flex-col text-xs">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{tech.name}</span>
                  <span className="text-zinc-600 dark:text-zinc-400 mt-0.5">{tech.detail}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Telemetry Strip */}
          <div className="lg:col-span-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={Activity01Icon} size={18} className="text-zinc-700 dark:text-zinc-300" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Clinical Performance Telemetry
                </h4>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                {activeInstitute.telemetry.map((item, i) => (
                  <div key={i} className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-3.5">
                    <p className="text-xl font-extrabold text-zinc-900 dark:text-white tabular-nums tracking-tight">
                      {item.metric}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 leading-tight">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTAs */}
            <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-zinc-200/60 dark:border-zinc-800/80">
              <Link
                href="/book"
                className="inline-flex items-center gap-2 rounded-full bg-zinc-900 dark:bg-zinc-100 px-5 py-2.5 text-xs font-bold text-white dark:text-zinc-900 transition-all hover:bg-zinc-800 dark:hover:bg-white/90 shadow-sm"
              >
                <span>Book Institute Consultation</span>
                <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
              </Link>
              <Link
                href="#doctors"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <span>View Faculty Credentials</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
