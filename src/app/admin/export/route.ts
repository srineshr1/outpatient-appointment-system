/**
 * CSV downloads for the admin console. Admins only. Every export is written to the activity
 * log. Exports leave out CHI numbers, mobiles and notes: open the visit for those.
 */
import { NextResponse, type NextRequest } from "next/server";
import { actorOf, recordEvent } from "@/lib/audit";
import { actionLabel, ROLE_LABELS } from "@/lib/audit-labels";
import {
  filterVisits,
  loadSnapshot,
  matchesEvent,
  readEventFilters,
  readVisitFilters,
  type SearchParams,
} from "@/lib/admin-data";
import { isPaymentMethod } from "@/lib/clinic-types";
import { isIsoDate, londonWallClock } from "@/lib/clock";
import { getCurrentUser } from "@/lib/session";
import { STATE_LABELS, METHOD_LABELS, dailyTakings, ledger, londonDay, toCsv, type CsvValue, type LedgerRow } from "@/lib/payments";

function instant(iso: string): string {
  if (!iso) return "";
  const wall = londonWallClock(new Date(iso));
  return `${wall.date} ${wall.time}`;
}

function ledgerCsv(rows: readonly LedgerRow[]): CsvValue[][] {
  return [
    ["When (UK time)", "Reference", "Patient", "Type", "Method", "Amount (GBP)", "By", "Note"],
    ...rows.map(({ entry, charge, visit }) => [
      instant(entry.at),
      charge.reference,
      visit?.patientName ?? "",
      entry.kind === "payment" ? "Payment" : "Refund",
      METHOD_LABELS[entry.method],
      { pence: entry.kind === "refund" ? -entry.amountPence : entry.amountPence },
      entry.byName,
      entry.note,
    ]),
  ];
}

function searchParamsOf(request: NextRequest): SearchParams {
  const query: SearchParams = {};
  for (const [key, value] of request.nextUrl.searchParams) query[key] = value;
  return query;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in?as=staff&next=%2Fadmin", request.url));
  if (user.role !== "admin") return new NextResponse("Only admins can export.", { status: 403 });

  const query = searchParamsOf(request);
  const kind = request.nextUrl.searchParams.get("kind") ?? "";
  const snapshot = await loadSnapshot();
  const visits = snapshot.visits.map((row) => row.visit);
  const visitsById = new Map(visits.map((visit) => [visit.id, visit]));
  let rows: CsvValue[][];
  let name: string;
  let what: string;

  if (kind === "takings") {
    const requested = request.nextUrl.searchParams.get("date") ?? "";
    const date = isIsoDate(requested) ? requested : snapshot.today;
    const report = dailyTakings(date, snapshot.charges, visits);
    rows = ledgerCsv(report.rows);
    rows.push([], ["Total received", "", "", "", "", { pence: report.total.receivedPence }]);
    rows.push(["Total refunded", "", "", "", "", { pence: -report.total.refundedPence }]);
    rows.push(["Net", "", "", "", "", { pence: report.total.netPence }]);
    name = `takings-${date}.csv`;
    what = `Daily takings, ${date}`;
  } else if (kind === "payments") {
    const method = request.nextUrl.searchParams.get("method") ?? "";
    const type = request.nextUrl.searchParams.get("type") ?? "";
    const from = request.nextUrl.searchParams.get("from") ?? "";
    const to = request.nextUrl.searchParams.get("to") ?? "";
    const q = (request.nextUrl.searchParams.get("q") ?? "").toLowerCase();
    const filtered = ledger(snapshot.charges, visitsById).filter(({ entry, charge, visit }) => {
      if (isPaymentMethod(method) && entry.method !== method) return false;
      if ((type === "payment" || type === "refund") && entry.kind !== type) return false;
      const day = londonDay(entry.at);
      if (isIsoDate(from) && day < from) return false;
      if (isIsoDate(to) && day > to) return false;
      return !q || `${charge.reference} ${visit?.patientName ?? ""} ${entry.byName}`.toLowerCase().includes(q);
    });
    rows = ledgerCsv(filtered);
    name = `payments-${snapshot.today}.csv`;
    what = `Payments, ${filtered.length} rows`;
  } else if (kind === "appointments" || kind === "fees") {
    const filters = readVisitFilters(query, kind === "fees" ? "all" : "upcoming");
    const matched = filterVisits(snapshot.visits, filters, snapshot.today);
    rows = [
      ["Date", "Time", "Reference", "Patient", "Doctor", "Reason", "Visit", "Fee (GBP)", "Paid (GBP)", "Refunded (GBP)", "Owed (GBP)", "Payment", "Booked at (UK time)"],
      ...matched.map((row) => [
        row.visit.date,
        row.visit.time,
        row.visit.reference,
        row.visit.patientName,
        row.doctorName,
        row.reasonLabel,
        row.visit.status,
        row.charge ? { pence: row.charge.amountPence } : "",
        { pence: row.money.paidPence },
        { pence: row.money.refundedPence },
        { pence: row.money.duePence },
        STATE_LABELS[row.money.state],
        instant(row.visit.createdAt),
      ]),
    ];
    name = `${kind === "fees" ? "visit-fees" : "appointments"}-${snapshot.today}.csv`;
    what = `${kind === "fees" ? "Visit fees" : "Appointments"}, ${matched.length} rows`;
  } else if (kind === "activity") {
    const filters = readEventFilters(query);
    const events = snapshot.events.filter((event) => matchesEvent(event, filters));
    rows = [
      ["When (UK time)", "What", "Code", "Details", "Reason given", "Who", "Role"],
      ...events.map((event) => [
        instant(event.at),
        actionLabel(event.action),
        event.action,
        event.summary,
        event.reason,
        event.actorName,
        ROLE_LABELS[event.actorRole] ?? event.actorRole,
      ]),
    ];
    name = `activity-${snapshot.today}.csv`;
    what = `Activity, ${events.length} rows`;
  } else {
    return new NextResponse("Unknown export.", { status: 400 });
  }

  await recordEvent({ actor: actorOf(user), action: "report.exported", subjectType: "report", subjectId: kind, summary: what });
  // A byte-order mark so spreadsheet apps read names with accents correctly.
  return new NextResponse(`\uFEFF${toCsv(rows)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
