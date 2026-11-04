import type { Metadata } from "next";
import { isClosedStatus } from "@/lib/clinic-types";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTitle } from "@/components/admin/AdminTitle";
import { AlertIcon, ArrowRightIcon } from "@/components/admin/icons";
import { EventTable, VisitTable } from "@/components/admin/tables";
import { Kpis, Panel, SectionHeading, TableWrap, Td, Th, adminButton, tableClass, tbodyClass, theadClass } from "@/components/admin/ui";
import { createdBetween, failedSignIns, loadSnapshot, navCounts, param, weekLoad, type SearchParams } from "@/lib/admin-data";
import { percent } from "@/lib/admin-format";
import { noticeText } from "@/lib/admin-notices";
import { requireAdminPage } from "@/lib/admin-page";
import { addDays, londonWallClock, now } from "@/lib/clock";
import { formatMoney } from "@/lib/fees";
import { londonDay, dailyTakings } from "@/lib/payments";
import { formatWeekRange, pluralise } from "@/lib/format";

export const metadata: Metadata = { title: "Overview" };

interface Attention {
  key: string;
  text: string;
  href: string;
  tone: "warn" | "danger";
}

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdminPage("/admin");
  const query = await searchParams;
  const snapshot = await loadSnapshot();
  const { today, visits, users, events } = snapshot;
  const time = londonWallClock(now()).time;

  const todayRows = visits.filter((row) => row.visit.date === today);
  const live = todayRows.filter((row) => !isClosedStatus(row.visit.status));
  const completed = live.filter((row) => row.visit.status === "completed").length;
  const toCome = live.filter((row) => row.visit.status === "booked" && row.visit.time >= time).length;
  const takings = dailyTakings(today, snapshot.charges, visits.map((row) => row.visit));
  const owing = visits.filter((row) => row.money.duePence > 0);
  const owedPence = owing.reduce((sum, row) => sum + row.money.duePence, 0);
  const weekAgo = addDays(today, -6);
  const bookedRecently = visits.filter((row) => createdBetween(row.visit.createdAt, weekAgo, today)).length;
  const newPatients = users.filter((user) => user.role === "patient" && createdBetween(user.createdAt, weekAgo, today)).length;
  const cancelledRecently = events.filter((event) => event.action === "appointment.cancelled" && londonDay(event.at) >= weekAgo).length;

  const refundsDue = visits.filter((row) => row.money.refundDuePence > 0);
  const pastUnpaid = visits.filter((row) => !isClosedStatus(row.visit.status) && row.visit.date < today && row.money.duePence > 0);
  const stale = visits.filter((row) => row.visit.status === "booked" && row.visit.date < today);
  const noFee = visits.filter((row) => row.money.state === "none" && row.visit.status === "booked" && row.visit.date >= today);
  const attempts = failedSignIns(events).filter((item) => item.locked || item.failures >= 3);

  const attention: Attention[] = [
    refundsDue.length > 0 && {
      key: "refunds",
      text: `${pluralise(refundsDue.length, "cancelled visit")} with ${formatMoney(refundsDue.reduce((sum, row) => sum + row.money.refundDuePence, 0))} to give back`,
      href: "/admin/payments/invoices?money=refund_due",
      tone: "danger" as const,
    },
    pastUnpaid.length > 0 && {
      key: "unpaid",
      text: `${pluralise(pastUnpaid.length, "past visit")} still owing ${formatMoney(pastUnpaid.reduce((sum, row) => sum + row.money.duePence, 0))}`,
      href: "/admin/payments/invoices?money=owed&when=past",
      tone: "warn" as const,
    },
    stale.length > 0 && {
      key: "stale",
      text: `${pluralise(stale.length, "visit")} from earlier days not marked complete or cancelled`,
      href: "/admin/appointments?when=past&status=booked",
      tone: "warn" as const,
    },
    attempts.length > 0 && {
      key: "signin",
      text: `${pluralise(attempts.length, "email")} with repeated wrong sign-in codes in the last day`,
      href: "/admin/security/attempts",
      tone: "danger" as const,
    },
    noFee.length > 0 && {
      key: "nofee",
      text: `${pluralise(noFee.length, "upcoming visit")} booked before fees started. Add the fee, or leave it free`,
      href: "/admin/payments/invoices?money=none&when=upcoming",
      tone: "warn" as const,
    },
  ].filter((item): item is Attention => Boolean(item));

  const load = weekLoad(visits, today);
  const recent = events.slice(0, 8);

  return (
    <AdminShell admin={admin} section="overview" counts={navCounts(snapshot)} notice={noticeText(param(query, "done"))}>
      <AdminTitle
        title="Overview"
        today={today}
        description="Everything happening at the practice today: visits, money and sign-ins."
        actions={
          <Link href="/admin/payments/takings" className={adminButton("secondary")}>
            Today’s takings
          </Link>
        }
      />

      <Kpis
        items={[
          { label: "Visits today", value: live.length, sub: `${completed} done · ${toCome} still to come` },
          {
            label: "Taken today",
            value: formatMoney(takings.total.netPence),
            sub: `${pluralise(takings.total.payments, "payment")} · ${pluralise(takings.total.refunds, "refund")}`,
          },
          { label: "Still owed", value: formatMoney(owedPence), sub: pluralise(owing.length, "visit"), tone: owedPence > 0 ? "warn" : undefined },
          { label: "Booked online, last 7 days", value: bookedRecently, sub: `${pluralise(newPatients, "new patient")} · ${cancelledRecently} cancelled` },
        ]}
      />

      <div className="mt-6">
        <Panel id="attention" title="Needs attention" description="Money and records waiting for someone to act.">
          {attention.length === 0 ? (
            <p className="text-sm text-ink-2">Nothing needs attention right now.</p>
          ) : (
            <ul className="grid gap-2">
              {attention.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className={`flex min-h-11 items-center gap-3 rounded-md border px-3 text-sm no-underline transition-colors hover:bg-[#f9fbfc] ${
                      item.tone === "danger" ? "border-[#f3c4c6]" : "border-[#f1d9a8]"
                    }`}
                  >
                    <AlertIcon size={18} className={item.tone === "danger" ? "shrink-0 text-[#a51c22]" : "shrink-0 text-[#774b06]"} />
                    <span className="flex-1 text-ink">{item.text}</span>
                    <ArrowRightIcon size={16} className="shrink-0 text-ink-2" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <section aria-labelledby="today-title" className="mt-10">
        <SectionHeading
          id="today-title"
          title="Today’s visits"
          count={todayRows.length}
          actions={
            <Link href="/admin/appointments?when=today" className={adminButton("ghost")}>
              Open the day
            </Link>
          }
        />
        <div className="mt-3">
          <VisitTable rows={todayRows} today={today} label="Today’s visits" empty="No visits booked online for today." showDate={false} />
        </div>
      </section>

      <section aria-labelledby="week-title" className="mt-10">
        <SectionHeading
          id="week-title"
          title="This week by doctor"
          description={`${formatWeekRange(load.weekStart)}. Taken times include visits booked by phone.`}
        />
        <div className="mt-3">
          <TableWrap label="This week by doctor">
            <table className={tableClass}>
              <caption className="sr-only">How full each doctor’s diary is this week</caption>
              <thead className={theadClass}>
                <tr>
                  <Th>Doctor</Th>
                  <Th align="right">Booked online</Th>
                  <Th align="right">Times taken</Th>
                  <Th>How full</Th>
                </tr>
              </thead>
              <tbody className={tbodyClass}>
                {load.doctors.map((doctor) => {
                  const full = percent(doctor.taken, doctor.capacity);
                  return (
                    <tr key={doctor.doctorId}>
                      <Td className="whitespace-nowrap font-medium">{doctor.name}</Td>
                      <Td align="right">{doctor.online}</Td>
                      <Td align="right">
                        {doctor.taken} of {doctor.capacity}
                      </Td>
                      <Td>
                        <span className="flex items-center gap-3">
                          <span aria-hidden="true" className="h-2 w-28 overflow-hidden rounded-full bg-fill">
                            <span
                              className={`block h-full rounded-full ${full >= 90 ? "bg-[#a51c22]" : full >= 70 ? "bg-[#b26b00]" : "bg-accent"}`}
                              style={{ width: `${full}%` }}
                            />
                          </span>
                          <span className="tabular-nums">{full}%</span>
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </div>
      </section>

      <section aria-labelledby="recent-title" className="mt-10">
        <SectionHeading
          id="recent-title"
          title="Recent activity"
          actions={
            <Link href="/admin/activity" className={adminButton("ghost")}>
              All activity
            </Link>
          }
        />
        <div className="mt-3">
          <EventTable events={recent} today={today} label="Recent activity" empty="Nothing has happened yet." />
        </div>
      </section>
    </AdminShell>
  );
}
