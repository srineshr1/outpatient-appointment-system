"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { Close, Search } from "@/components/icons";
import { ButtonLink } from "@/components/ui/Button";
import { buttonClass } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/Card";
import { PendingButton } from "@/components/ui/PendingButton";
import type { AppointmentRecord } from "@/lib/clinic-types";
import { reasons } from "@/lib/data";
import { formatWhen } from "@/lib/format";
import { queueVisit, updateVisit } from "@/server/booking-actions";
import type { DoctorFilterOption } from "./ClinicBookView";
import { clockLabel, QueueBoard } from "./QueueBoard";

type DeskTab = "today" | "upcoming" | "earlier";

export interface ReceptionDeskProps {
  userName: string;
  visits: AppointmentRecord[];
  today: string;
  doctorNames: Record<string, string>;
  doctorOptions: DoctorFilterOption[];
  filterDoctorId: string;
  payments: Record<string, string>;
  returnTo: string;
  noticeSlot?: ReactNode;
  displacedSlot?: ReactNode;
}

function reasonLabel(id: string): string {
  return reasons.find((reason) => reason.id === id)?.label ?? "Appointment";
}

function statusLabel(visit: AppointmentRecord): string {
  const status = visit.status;
  if (status === "booked" && visit.consultStartedAt) return "With the doctor";
  if (status === "booked" && visit.checkedInAt) return `Checked in ${clockLabel(visit.checkedInAt)}`;
  if (status === "no_show") return "No-show";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (status === "pending_payment") return "Awaiting payment";
  if (status === "expired") return "Hold expired";
  if (status === "displaced") return "Needs a new time";
  return "Booked";
}

function statusClass(status: AppointmentRecord["status"]): string {
  if (status === "completed") return "bg-success-soft text-success border-success/25";
  if (status === "cancelled" || status === "expired" || status === "no_show") return "bg-fill text-muted border-hairline";
  if (status === "pending_payment" || status === "displaced") return "bg-warn-soft text-warn border-warn/25";
  return "bg-accent-soft text-accent border-accent/25";
}

function byTime(a: AppointmentRecord, b: AppointmentRecord): number {
  return a.date === b.date ? a.time.localeCompare(b.time) || a.patientName.localeCompare(b.patientName) : a.date.localeCompare(b.date);
}

export function ReceptionDesk({
  userName,
  visits,
  today,
  doctorNames,
  doctorOptions,
  filterDoctorId,
  payments,
  returnTo,
  noticeSlot,
  displacedSlot,
}: ReceptionDeskProps) {
  const searchId = useId();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<DeskTab>("today");

  const groups = useMemo(() => {
    const todayVisits: AppointmentRecord[] = [];
    const upcoming: AppointmentRecord[] = [];
    const earlier: AppointmentRecord[] = [];
    for (const visit of [...visits].sort(byTime)) {
      if (visit.date === today) todayVisits.push(visit);
      else if (visit.date > today && visit.status !== "cancelled" && visit.status !== "expired" && visit.status !== "no_show") upcoming.push(visit);
      else if (visit.date < today) earlier.push(visit);
    }
    return { todayVisits, upcoming, earlier };
  }, [visits, today]);

  const waitingToday = groups.todayVisits.filter((visit) => visit.status === "booked").length;

  const listed = tab === "today" ? groups.todayVisits : tab === "upcoming" ? groups.upcoming : groups.earlier;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return listed;
    return listed.filter((visit) => {
      const doctor = (doctorNames[visit.doctorId] ?? "").toLowerCase();
      return (
        visit.patientName.toLowerCase().includes(q) ||
        visit.reference.toLowerCase().includes(q) ||
        doctor.includes(q)
      );
    });
  }, [listed, search, doctorNames]);

  const name = userName.trim() || "there";

  return (
    <div className="mx-auto max-w-5xl px-5 pt-8 pb-16 md:px-8 md:pt-10">
      <header>
        <h1 className="text-title2 font-bold tracking-tight text-ink md:text-title1">Desk</h1>
        <p className="mt-1.5 text-body text-ink-2">
          Hello {name}.{" "}
          <span className="font-semibold text-ink tabular">{waitingToday}</span>{" "}
          {waitingToday === 1 ? "patient is" : "patients are"} still booked today.
        </p>
      </header>

      {noticeSlot}
      {displacedSlot}

      <QueueBoard visits={visits} today={today} doctorNames={doctorNames} returnTo={returnTo} showDoctor />

      {doctorOptions.length > 0 ? (
        <nav aria-label="Filter by doctor" className="mt-6 flex flex-wrap gap-2">
          <ButtonLink href="/dashboard" variant={!filterDoctorId ? "primary" : "secondary"} size="md" aria-current={!filterDoctorId ? "page" : undefined}>
            All doctors
          </ButtonLink>
          {doctorOptions.map((item) => (
            <ButtonLink
              key={item.id}
              href={`/dashboard?doctor=${item.id}`}
              variant={filterDoctorId === item.id ? "primary" : "secondary"}
              size="md"
              aria-current={filterDoctorId === item.id ? "page" : undefined}
            >
              {item.short}
            </ButtonLink>
          ))}
        </nav>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Which patients">
          {(
            [
              ["today", `Today (${groups.todayVisits.length})`],
              ["upcoming", `Upcoming (${groups.upcoming.length})`],
              ["earlier", `Earlier (${groups.earlier.length})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={buttonClass(tab === value ? "primary" : "secondary", "sm")}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <label htmlFor={searchId} className="sr-only">
            Search patients by name, doctor, or reference
          </label>
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, doctor, or reference"
            className="field pl-10 pr-10"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-2.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-fill hover:text-ink"
            >
              <Close size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="mt-6 p-6">
          <p className="text-body font-medium text-ink">
            {listed.length === 0 ? "No patients in this list." : "No patients match that search."}
          </p>
        </Card>
      ) : (
        <ul aria-label="Patients" className="mt-6 grid gap-3">
          {filtered.map((visit) => {
            const doctor = doctorNames[visit.doctorId] ?? "Doctor";
            const open = visit.status === "booked" || visit.status === "pending_payment";
            return (
              <li key={visit.id}>
                <article className="rounded-card border border-hairline bg-surface p-4 shadow-card sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-callout font-medium text-ink-2 tabular">
                        {formatWhen({ date: visit.date, time: visit.time }, today)}
                      </p>
                      <h2 className="mt-0.5 text-body font-semibold text-ink">{visit.patientName}</h2>
                      <p className="mt-1 text-callout text-ink-2">
                        {doctor}
                        <span aria-hidden="true"> · </span>
                        {reasonLabel(visit.reasonId)}
                        <span aria-hidden="true"> · </span>
                        <span className="tabular">{visit.reference}</span>
                        {payments[visit.id] ? (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span className="tabular">{payments[visit.id]}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <p className={`inline-flex rounded-full border px-2.5 py-0.5 text-caption font-semibold ${statusClass(visit.status)}`}>
                      {statusLabel(visit)}
                    </p>
                  </div>

                  {open ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {visit.status === "booked" && visit.date === today && !visit.checkedInAt ? (
                        <form action={queueVisit}>
                          <input type="hidden" name="id" value={visit.id} />
                          <input type="hidden" name="step" value="check_in" />
                          <input type="hidden" name="return" value={returnTo} />
                          <PendingButton
                            pendingLabel="Checking in…"
                            className={buttonClass("primary", "sm")}
                            aria-label={`Check in ${visit.patientName}`}
                          >
                            Check in
                          </PendingButton>
                        </form>
                      ) : null}
                      {visit.status === "booked" && visit.date <= today && !visit.checkedInAt ? (
                        <form action={queueVisit}>
                          <input type="hidden" name="id" value={visit.id} />
                          <input type="hidden" name="step" value="no_show" />
                          <input type="hidden" name="return" value={returnTo} />
                          <PendingButton
                            pendingLabel="Updating…"
                            className={buttonClass("secondary", "sm")}
                            aria-label={`Mark ${visit.patientName} as a no-show`}
                          >
                            No-show
                          </PendingButton>
                        </form>
                      ) : null}
                      {visit.status === "booked" ? (
                        <form action={updateVisit}>
                          <input type="hidden" name="id" value={visit.id} />
                          <input type="hidden" name="status" value="completed" />
                          <input type="hidden" name="return" value={returnTo} />
                          <PendingButton
                            pendingLabel="Updating…"
                            className={buttonClass(visit.checkedInAt ? "primary" : "secondary", "sm")}
                            aria-label={`Mark ${visit.patientName} completed`}
                          >
                            Mark completed
                          </PendingButton>
                        </form>
                      ) : null}
                      <form action={updateVisit}>
                        <input type="hidden" name="id" value={visit.id} />
                        <input type="hidden" name="status" value="cancelled" />
                        <input type="hidden" name="return" value={returnTo} />
                        <PendingButton
                          pendingLabel="Cancelling…"
                          className={buttonClass("secondary", "sm")}
                          aria-label={`Cancel ${visit.patientName}`}
                        >
                          {visit.status === "pending_payment" ? "Cancel hold" : "Cancel visit"}
                        </PendingButton>
                      </form>
                      {visit.status === "booked" && visit.date >= today ? (
                        <ButtonLink
                          href={`/reschedule/${visit.id}?return=${encodeURIComponent(returnTo)}`}
                          variant="secondary"
                          size="sm"
                        >
                          Reschedule
                        </ButtonLink>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
