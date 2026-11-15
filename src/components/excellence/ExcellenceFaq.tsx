"use client";

import { useState, useId } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  ChevronDownIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";

interface FAQItem {
  id: string;
  category: "Robotic Technology" | "Recovery & ERAS" | "Sterile Protocols" | "Referrals & Booking";
  question: string;
  answer: string;
  highlight?: string;
}

const FAQS: FAQItem[] = [
  {
    id: "booking-direct",
    category: "Referrals & Booking",
    question: "Can patients schedule specialized surgical consultations directly without an NHS waiting list?",
    answer:
      "Yes. Westbrook Medical Practice operates a streamlined direct-access pathway. While we accept formal referrals from NHS general practitioners and international specialists, patients and families can directly schedule a comprehensive consultation with our surgical chairs via our online booking system or via our clinical navigators. Initial surgical evaluations and multidisciplinary case reviews are scheduled within 48 to 72 hours.",
    highlight: "Direct booking available online with appointments within 48-72 hours.",
  },
  {
    id: "davinci-advantages",
    category: "Robotic Technology",
    question: "What specific clinical advantages does the da Vinci Xi dual-console platform deliver over conventional laparoscopy?",
    answer:
      "The da Vinci Xi system transcends the mechanical limitations of straight laparoscopic instruments. Its robotic arms provide 7 degrees of freedom with 540 degrees of continuous rotation, mirroring and exceeding the human wrist with complete tremor abolition. High-definition 3D binocular optics magnify surgical fields 10x, enabling sub-millimeter dissection around delicate microscopic nerve bundles, reducing intraoperative blood loss by over 90%, and lowering tissue trauma.",
    highlight: "Sub-millimeter 0.1mm micro-dissection with 94% lower blood loss.",
  },
  {
    id: "recovery-eras",
    category: "Recovery & ERAS",
    question: "How does Westbrook achieve 40% faster recovery times and same-day discharge milestones?",
    answer:
      "Our accelerated recovery pathways stem from protocolized Enhanced Recovery After Surgery (ERAS) multimodal pathways. By utilizing keyhole robotic and muscle-splitting incisions, long-acting intraoperative cryoneurolysis and regional sensory blocks (eliminating high-dose systemic opioids), and early kinematic mobilization, our patients stand and ambulate within 4 to 6 hours post-operation. Over 88% of elective joint reconstructions and robotic pelvic cases are safely discharged on the day of surgery or the following morning.",
    highlight: "Ambulatory walking milestones achieved within 4 hours; 88% discharged same-day or next-morning.",
  },
  {
    id: "infection-rate",
    category: "Sterile Protocols",
    question: "How has Westbrook maintained a 0% hospital-acquired infection rate in sterile surgical suites?",
    answer:
      "Our operating theatres operate as Class 100 positive-pressure laminar airflow sterile cleanrooms. Air is HEPA-filtered with 50 air volume exchanges per hour, creating a continuous unidirectional curtain of ultra-pure air descending directly over the surgical field to prevent airborne contaminants. Coupled with RFID-tracked sterile micro-instrument trays, antimicrobial titanium surfaces, and rigorous surgical barrier antisepsis, we have recorded zero surgical-site infections across all clean elective suites.",
    highlight: "Class 100 laminar flow cleanrooms with 50 HEPA air exchanges per hour.",
  },
  {
    id: "second-opinions",
    category: "Referrals & Booking",
    question: "How does the Westbrook Surgical Review Board handle second opinions for complex or high-risk cases?",
    answer:
      "For patients diagnosed elsewhere with complex structural heart disease, advanced neuro-spinal conditions, deep infiltrating endometriosis, or revision joint failures, our cross-institute surgical review boards provide expedited second opinions. Our chairs review existing cross-sectional imaging (CT/MRI), histological reports, and clinical history, producing a comprehensive written multidisciplinary recommendation and conducting virtual or in-person consults within 3 business days.",
    highlight: "48-to-72 hour comprehensive case review by multi-specialty surgical chairs.",
  },
  {
    id: "insurance-coverage",
    category: "Referrals & Booking",
    question: "Which private medical insurers and payment structures are accepted for specialized procedures?",
    answer:
      "Westbrook is an accredited Center of Excellence partnered with all major UK private medical insurers—including Bupa, AXA Health, Aviva, Vitality, WPA, and Cigna—as well as premier international health carriers. For self-funding patients, we provide all-inclusive, fixed-price surgical care packages with zero hidden hospital facility, anesthesia, or implant surcharges.",
    highlight: "Fully recognized by Bupa, AXA, Aviva, Vitality, and transparent self-pay packages.",
  },
];

const CATEGORIES = ["All", "Robotic Technology", "Recovery & ERAS", "Sterile Protocols", "Referrals & Booking"] as const;

export function ExcellenceFaq() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(["booking-direct", "davinci-advantages"]));
  const baseId = useId();

  const toggleItem = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredFaqs = FAQS.filter((item) => {
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      query === "" ||
      item.question.toLowerCase().includes(query) ||
      item.answer.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full">
      {/* Category Pills & Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between pb-6">
        {/* Pills */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                selectedCategory === cat
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
            <HugeiconsIcon icon={Search01Icon} size={16} />
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search surgical questions..."
            aria-label="Search surgical FAQ questions"
            className="w-full rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-2 pl-9 pr-4 text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </div>

      {/* FAQ Accordion List */}
      <div className="space-y-3">
        {filteredFaqs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No clinical questions matching &ldquo;{searchQuery}&rdquo;. Try another term or contact our clinical team.
          </div>
        ) : (
          filteredFaqs.map((faq, index) => {
            const isOpen = openIds.has(faq.id);
            const questionId = `${baseId}-q-${faq.id}`;
            const answerId = `${baseId}-a-${faq.id}`;

            return (
              <div
                key={faq.id}
                className={`rounded-2xl border transition-all duration-200 ${
                  isOpen
                    ? "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900/90 shadow-sm"
                    : "border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-white dark:hover:bg-zinc-900/70"
                }`}
              >
                <h3>
                  <button
                    type="button"
                    id={questionId}
                    aria-expanded={isOpen}
                    aria-controls={answerId}
                    onClick={() => toggleItem(faq.id)}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-2xl"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-zinc-200/60 dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        Q{index + 1}
                      </span>
                      <span className="text-sm md:text-base font-bold text-zinc-900 dark:text-zinc-100">
                        {faq.question}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 rounded-full p-1.5 text-zinc-500 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-zinc-900 dark:text-zinc-100" : ""
                      }`}
                    >
                      <HugeiconsIcon icon={ChevronDownIcon} size={18} />
                    </span>
                  </button>
                </h3>

                {isOpen && (
                  <section
                    id={answerId}
                    aria-labelledby={questionId}
                    className="px-5 pb-5 pt-1 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed border-t border-zinc-100 dark:border-zinc-800/60 mt-1"
                  >
                    <p className="mt-2 text-zinc-700 dark:text-zinc-300">{faq.answer}</p>
                    {faq.highlight && (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 px-3.5 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        <HugeiconsIcon icon={SparklesIcon} size={13} className="text-accent" />
                        <span>{faq.highlight}</span>
                      </div>
                    )}
                  </section>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Need more guidance link */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-4 text-xs">
        <span className="text-zinc-600 dark:text-zinc-400 font-medium">
          Have an unaddressed surgical or specialty question?
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/book"
            className="font-bold text-zinc-900 dark:text-zinc-100 hover:text-accent dark:hover:text-cyan-300 underline underline-offset-4"
          >
            Ask During Consultation
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <a
            href="tel:+441314960280"
            className="font-bold text-accent dark:text-cyan-400 hover:underline underline-offset-4"
          >
            Call Desk: 0131 496 0280
          </a>
        </div>
      </div>
    </div>
  );
}
