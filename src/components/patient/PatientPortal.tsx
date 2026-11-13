"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AppointmentRecord, PublicUser, RebookingOffer, RescheduleRecord } from "@/lib/clinic-types";
import type { MedicalReport, PatientSummaryData, PrescriptionItem } from "@/lib/patient-reports";
import { formatPhone, formatShortDate, formatWhen } from "@/lib/format";
import { findDoctor, practice, reasons } from "@/lib/data";
import { PRACTICE_TZ } from "@/lib/clock";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { Button } from "@/components/ui/Button";
import { buttonClass } from "@/components/ui/button-styles";
import { Notice } from "@/components/ui/Card";
import { VisitList } from "@/components/clinic/VisitList";
import { ReportModal } from "./ReportModal";
import { PrescriptionModal } from "./PrescriptionModal";
import {
  Calendar,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  Edit,
  Info,
  Phone,
  Pin,
  Plus,
  Search,
  UserCircle,
} from "@/components/icons";

interface Props {
  user: PublicUser & { expiresAt: string };
  visits: AppointmentRecord[];
  today: string;
  payments: Record<string, string>;
  moves: Record<string, RescheduleRecord[]>;
  openOffers: { visit: AppointmentRecord; offer: RebookingOffer; href: string }[];
  noticeSlot: React.ReactNode;
  medicalData: PatientSummaryData;
}

type TabKey = "appointments" | "reports" | "prescriptions" | "vitals";

export function PatientPortal({
  user,
  visits,
  today,
  payments,
  moves,
  openOffers,
  noticeSlot,
  medicalData,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("appointments");
  const [reportCategory, setReportCategory] = useState<string>("all");
  const [reportSearch, setReportSearch] = useState<string>("");
  const [selectedReport, setSelectedReport] = useState<MedicalReport | null>(null);
  const [selectedRx, setSelectedRx] = useState<PrescriptionItem | null>(null);
  const [refillNotice, setRefillNotice] = useState<string | null>(null);

  const patientId = `PT-${(user.id || "00000").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}`;

  // Upcoming vs past appointments count
  const upcomingVisits = visits.filter(
    (v) => v.date >= today && v.status !== "cancelled" && v.status !== "expired",
  );
  const nextVisit = upcomingVisits[0] ?? null;

  // Filtered reports
  const filteredReports = useMemo(() => {
    return medicalData.reports.filter((r) => {
      const matchCat = reportCategory === "all" || r.category === reportCategory;
      const matchQuery =
        !reportSearch ||
        r.title.toLowerCase().includes(reportSearch.toLowerCase()) ||
        r.doctorName.toLowerCase().includes(reportSearch.toLowerCase()) ||
        r.reportNumber.toLowerCase().includes(reportSearch.toLowerCase()) ||
        r.parameters.some((p) => p.name.toLowerCase().includes(reportSearch.toLowerCase()));
      return matchCat && matchQuery;
    });
  }, [medicalData.reports, reportCategory, reportSearch]);

  const activeRx = medicalData.prescriptions.filter((p) => p.status === "active");

  function handleRequestRefill(item: PrescriptionItem) {
    setRefillNotice(`Refill request submitted for ${item.medication}. Dr. ${item.prescribedBy} will review it.`);
    setTimeout(() => setRefillNotice(null), 4000);
  }

  return (
    <div className="mx-auto max-w-page px-4 pt-6 pb-20 md:px-8 md:pt-10">
      {/* Top Banner / Welcome Header */}
      <div className="rounded-3xl bg-gradient-to-br from-card via-card to-canvas-subtle p-6 sm:p-8 border border-hairline shadow-sm relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-accent/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent-soft text-accent border border-accent/20">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Patient Health Hub
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-fill text-ink border border-hairline">
                {patientId}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success-soft px-2.5 py-0.5 rounded-full border border-success/20">
                <Check size={12} /> Verified
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              Welcome back, {user.name}
            </h1>
            <p className="text-xs sm:text-sm text-ink-2 max-w-xl">
              Access your upcoming outpatient clinic appointments, laboratory investigations, prescriptions, and official doctor records from one secure place.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button asChild className="gap-2 shadow-sm">
              <Link href="/book">
                <Calendar size={16} />
                <span>Book Appointment</span>
              </Link>
            </Button>
            <Button asChild variant="secondary" className="gap-2">
              <Link href="/payments">
                <ClipboardList size={16} />
                <span>Billing & Payments</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2 border-hairline">
              <Link href="/profile" title="Edit Profile">
                <UserCircle size={18} />
                <span className="hidden sm:inline">Profile</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* 4 Quick Stat Bento Cards */}
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Appointments */}
          <button
            type="button"
            onClick={() => setActiveTab("appointments")}
            className={`text-left p-4 rounded-2xl border transition-all ${
              activeTab === "appointments"
                ? "bg-accent/10 border-accent/40 shadow-sm ring-1 ring-accent/30"
                : "bg-card/70 hover:bg-card border-hairline"
            }`}
          >
            <div className="flex items-center justify-between text-muted mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Appointments</span>
              <Calendar size={18} className="text-accent" />
            </div>
            <p className="text-2xl font-bold text-ink">{upcomingVisits.length}</p>
            <p className="text-xs text-ink-2 mt-0.5 truncate">
              {nextVisit ? `Next: ${formatShortDate(nextVisit.date)}, ${nextVisit.time}` : "No upcoming visits"}
            </p>
          </button>

          {/* Card 2: Reports */}
          <button
            type="button"
            onClick={() => setActiveTab("reports")}
            className={`text-left p-4 rounded-2xl border transition-all ${
              activeTab === "reports"
                ? "bg-accent/10 border-accent/40 shadow-sm ring-1 ring-accent/30"
                : "bg-card/70 hover:bg-card border-hairline"
            }`}
          >
            <div className="flex items-center justify-between text-muted mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Reports Ready</span>
              <ClipboardList size={18} className="text-success" />
            </div>
            <p className="text-2xl font-bold text-ink">{medicalData.reports.length}</p>
            <p className="text-xs text-ink-2 mt-0.5 truncate">Lab, X-Ray & ECG</p>
          </button>

          {/* Card 3: Prescriptions */}
          <button
            type="button"
            onClick={() => setActiveTab("prescriptions")}
            className={`text-left p-4 rounded-2xl border transition-all ${
              activeTab === "prescriptions"
                ? "bg-accent/10 border-accent/40 shadow-sm ring-1 ring-accent/30"
                : "bg-card/70 hover:bg-card border-hairline"
            }`}
          >
            <div className="flex items-center justify-between text-muted mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Medications</span>
              <span className="text-accent font-bold text-sm">Rx</span>
            </div>
            <p className="text-2xl font-bold text-ink">{activeRx.length}</p>
            <p className="text-xs text-ink-2 mt-0.5 truncate">Active prescriptions</p>
          </button>

          {/* Card 4: Vitals */}
          <button
            type="button"
            onClick={() => setActiveTab("vitals")}
            className={`text-left p-4 rounded-2xl border transition-all ${
              activeTab === "vitals"
                ? "bg-accent/10 border-accent/40 shadow-sm ring-1 ring-accent/30"
                : "bg-card/70 hover:bg-card border-hairline"
            }`}
          >
            <div className="flex items-center justify-between text-muted mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Latest Vitals</span>
              <Clock size={18} className="text-warn" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-ink">
              {medicalData.vitals.bloodPressure.systolic}/{medicalData.vitals.bloodPressure.diastolic}
              <span className="text-xs font-normal text-muted ml-1">mmHg</span>
            </p>
            <p className="text-xs text-success font-medium mt-0.5 truncate">
              Pulse: {medicalData.vitals.heartRate.bpm} bpm · Normal
            </p>
          </button>
        </div>
      </div>

      {/* Displaced Visits Rebooking Notice */}
      {openOffers.map(({ visit, href }) => (
        <Notice key={visit.id} tone="info" className="mt-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span>
              Your doctor modified clinic hours. Your visit on <strong>{formatShortDate(visit.date)}, {visit.time}</strong> ({visit.reference}) requires a new time slot.
            </span>
            <Link
              href={href}
              className="inline-flex items-center gap-1 font-semibold text-accent dark:text-cyan-300 hover:underline whitespace-nowrap"
            >
              <span>Choose new time</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </Notice>
      ))}

      {/* General Notification Slot */}
      {noticeSlot}

      {/* Temporary Toast Refill Notification */}
      {refillNotice && (
        <Notice tone="success" role="status" className="mt-4">
          {refillNotice}
        </Notice>
      )}

      {/* Tab Controls */}
      <div className="mt-8 border-b border-hairline">
        <div className="flex gap-2 sm:gap-6 overflow-x-auto pb-px no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("appointments")}
            className={`pb-3.5 text-sm sm:text-base font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === "appointments"
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <Calendar size={18} />
            <span>Appointments</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-fill">
              {visits.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("reports")}
            className={`pb-3.5 text-sm sm:text-base font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === "reports"
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <ClipboardList size={18} />
            <span>Medical & Lab Reports</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-fill">
              {medicalData.reports.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("prescriptions")}
            className={`pb-3.5 text-sm sm:text-base font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === "prescriptions"
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <span className="font-serif font-bold text-sm">℞</span>
            <span>Prescriptions</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-fill">
              {medicalData.prescriptions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("vitals")}
            className={`pb-3.5 text-sm sm:text-base font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === "vitals"
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <Clock size={18} />
            <span>Health Vitals</span>
          </button>
        </div>
      </div>

      {/* TAB CONTENT 1: APPOINTMENTS */}
      {activeTab === "appointments" && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-ink">Your Consultations & Visits</h2>
              <p className="text-xs sm:text-sm text-ink-2">
                Manage upcoming clinic appointments, reschedule visits, or book new times with your doctor.
              </p>
            </div>
            <Button asChild size="sm" className="gap-1.5 self-start sm:self-auto">
              <Link href="/book">
                <Plus size={16} />
                <span>Book visit</span>
              </Link>
            </Button>
          </div>

          <VisitList
            visits={visits}
            today={today}
            mode="patient"
            returnTo="/appointments"
            payments={payments}
            moves={moves}
          />
        </div>
      )}

      {/* TAB CONTENT 2: MEDICAL REPORTS */}
      {activeTab === "reports" && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-ink">Official Diagnostic & Lab Reports</h2>
              <p className="text-xs sm:text-sm text-ink-2">
                Complete pathology results, clinical biochemistry, radiology scans, and doctor impressions.
              </p>
            </div>

            {/* Search & Filter Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[220px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  placeholder="Search tests or parameters…"
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-full bg-fill border border-hairline focus:border-accent focus:outline-none text-ink placeholder:text-muted"
                />
              </div>

              {/* Category selector */}
              <div className="flex items-center gap-1 bg-fill p-1 rounded-lg border border-hairline text-xs">
                {[
                  { id: "all", label: "All" },
                  { id: "lab", label: "Lab" },
                  { id: "radiology", label: "Radiology" },
                  { id: "cardiology", label: "ECG" },
                  { id: "clinical", label: "Clinical" },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setReportCategory(cat.id)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      reportCategory === cat.id
                        ? "bg-card text-ink font-semibold shadow-xs"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Reports Grid */}
          {filteredReports.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-hairline bg-card/40 space-y-3">
              <ClipboardList size={36} className="mx-auto text-muted/60" />
              <p className="text-sm font-medium text-ink">No medical reports found</p>
              <p className="text-xs text-muted max-w-sm mx-auto">
                No reports matching your search filter. Clear search or check back after your lab investigations are completed.
              </p>
              {reportSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setReportSearch("");
                    setReportCategory("all");
                  }}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredReports.map((report) => (
                <SpotlightCard
                  key={report.id}
                  as="article"
                  className="rounded-2xl p-5 border border-hairline bg-card hover:border-accent/30 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-accent-soft text-accent border border-accent/20">
                          {report.categoryLabel}
                        </span>
                        <h3 className="text-base font-bold text-ink mt-1.5 leading-snug">
                          {report.title}
                        </h3>
                        <p className="text-xs text-muted font-mono">{report.reportNumber}</p>
                      </div>

                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success-soft px-2.5 py-0.5 rounded-full border border-success/20 shrink-0">
                        <Check size={12} /> Ready
                      </span>
                    </div>

                    <p className="text-xs text-ink-2 leading-relaxed line-clamp-2">
                      {report.summary}
                    </p>

                    {/* Key Findings Preview */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {report.parameters.slice(0, 3).map((p) => (
                        <span
                          key={p.name}
                          className="px-2 py-0.5 rounded bg-fill text-[11px] text-ink font-mono border border-hairline"
                        >
                          {p.name.split(" ")[0]}: <strong className="font-semibold">{p.value} {p.unit}</strong>
                        </span>
                      ))}
                      {report.parameters.length > 3 && (
                        <span className="px-1.5 py-0.5 text-[10px] text-muted self-center">
                          +{report.parameters.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-hairline flex items-center justify-between text-xs">
                    <div className="text-muted">
                      <span>{report.doctorName}</span> · <span>{formatShortDate(report.date)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedReport(report)}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </SpotlightCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 3: PRESCRIPTIONS */}
      {activeTab === "prescriptions" && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-ink">Prescriptions & Active Medications</h2>
              <p className="text-xs sm:text-sm text-ink-2">
                Medications authorized by your clinic doctors, dosing instructions, and refill options.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {medicalData.prescriptions.map((rx) => (
              <SpotlightCard
                key={rx.id}
                as="article"
                className="rounded-2xl p-5 border border-hairline bg-card flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-black text-accent text-lg">℞</span>
                        <h3 className="text-base font-bold text-ink">{rx.medication}</h3>
                      </div>
                      {rx.genericName && (
                        <p className="text-xs text-muted italic ml-6">{rx.genericName}</p>
                      )}
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        rx.status === "active"
                          ? "bg-accent-soft text-accent border border-accent/25"
                          : "bg-fill text-muted border border-hairline"
                      }`}
                    >
                      {rx.status === "active" ? "Active" : "Completed"}
                    </span>
                  </div>

                  <div className="bg-fill/40 p-3 rounded-xl border border-hairline space-y-1.5 text-xs">
                    <p className="text-ink">
                      <strong>Dosage:</strong> {rx.dosage} · {rx.form}
                    </p>
                    <p className="text-ink">
                      <strong>Frequency:</strong> {rx.frequency}
                    </p>
                    <p className="text-muted leading-relaxed">
                      <strong>Instructions:</strong> {rx.instructions}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3.5 border-t border-hairline flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="text-muted">
                    <span>{rx.prescribedBy}</span> · <span>{rx.refills} refills left</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRx(rx)}
                    >
                      View Order
                    </Button>
                    {rx.status === "active" && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRequestRefill(rx)}
                      >
                        Request Refill
                      </Button>
                    )}
                  </div>
                </div>
              </SpotlightCard>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: HEALTH VITALS */}
      {activeTab === "vitals" && (
        <div className="mt-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-ink">Clinical Vitals & Health Profile</h2>
            <p className="text-xs sm:text-sm text-ink-2">
              Physical health measurements recorded during outpatient consultations.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Blood Pressure */}
            <div className="p-5 rounded-2xl bg-card border border-hairline space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Blood Pressure
              </span>
              <p className="text-3xl font-extrabold text-ink">
                {medicalData.vitals.bloodPressure.systolic}/{medicalData.vitals.bloodPressure.diastolic}
                <span className="text-sm font-normal text-muted ml-1">mmHg</span>
              </p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-soft text-success">
                <Check size={12} /> {medicalData.vitals.bloodPressure.status} Target (&lt; 120/80)
              </div>
              <p className="text-xs text-muted pt-2 border-t border-hairline">
                Last checked: {formatShortDate(medicalData.vitals.lastChecked)}
              </p>
            </div>

            {/* Resting Heart Rate */}
            <div className="p-5 rounded-2xl bg-card border border-hairline space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Resting Heart Rate
              </span>
              <p className="text-3xl font-extrabold text-ink">
                {medicalData.vitals.heartRate.bpm}
                <span className="text-sm font-normal text-muted ml-1">bpm</span>
              </p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-soft text-success">
                <Check size={12} /> Optimal Sinus Rhythm (60 - 100)
              </div>
              <p className="text-xs text-muted pt-2 border-t border-hairline">
                Recorded via clinical 12-lead ECG
              </p>
            </div>

            {/* Fasting Blood Glucose */}
            <div className="p-5 rounded-2xl bg-card border border-hairline space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Fasting Glucose
              </span>
              <p className="text-3xl font-extrabold text-ink">
                {medicalData.vitals.bloodSugar.mgDl}
                <span className="text-sm font-normal text-muted ml-1">mg/dL</span>
              </p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-soft text-success">
                <Check size={12} /> Euglycemic (Target 70 - 99)
              </div>
              <p className="text-xs text-muted pt-2 border-t border-hairline">
                HbA1c: 5.4% (Normal non-diabetic range)
              </p>
            </div>

            {/* Body Mass Index */}
            <div className="p-5 rounded-2xl bg-card border border-hairline space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Weight & BMI
              </span>
              <p className="text-3xl font-extrabold text-ink">
                {medicalData.vitals.bmi}
                <span className="text-sm font-normal text-muted ml-1">BMI</span>
              </p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-soft text-success">
                <Check size={12} /> {medicalData.vitals.bmiCategory} ({medicalData.vitals.weightKg} kg, {medicalData.vitals.heightCm} cm)
              </div>
              <p className="text-xs text-muted pt-2 border-t border-hairline">
                Standard healthy range: 18.5 - 24.9
              </p>
            </div>

            {/* Blood Type */}
            <div className="p-5 rounded-2xl bg-card border border-hairline space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Blood Group
              </span>
              <p className="text-3xl font-extrabold text-accent">
                {medicalData.vitals.bloodGroup}
              </p>
              <p className="text-xs text-muted">
                Rh Positive · Compatible donor/recipient recorded on NHS registry
              </p>
              <p className="text-xs text-muted pt-2 border-t border-hairline">
                Verified by Westbrook Pathology
              </p>
            </div>

            {/* Allergies & Alerts */}
            <div className="p-5 rounded-2xl bg-card border border-hairline space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Recorded Allergies
              </span>
              <div className="pt-1">
                {medicalData.vitals.allergies.map((allergy) => (
                  <span
                    key={allergy}
                    className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-success-soft text-success border border-success/20"
                  >
                    {allergy}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted pt-3">
                No active drug contraindications reported. Notify reception on check-in if allergies develop.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {selectedReport && (
        <ReportModal
          report={selectedReport}
          patientName={user.name}
          patientDob={user.dob}
          patientMobile={user.mobile}
          onClose={() => setSelectedReport(null)}
        />
      )}

      {/* Prescription Modal */}
      {selectedRx && (
        <PrescriptionModal
          prescription={selectedRx}
          patientName={user.name}
          patientDob={user.dob}
          onClose={() => setSelectedRx(null)}
        />
      )}
    </div>
  );
}
