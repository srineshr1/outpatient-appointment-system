import { Badge, type Tone } from "@/components/admin/ui";
import { formatShortDate } from "@/lib/format";
import type { DisplacedEntry, DisplacedStatus } from "@/lib/rebooking";

const STATUS: Record<DisplacedStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "warn" },
  rebooked: { label: "Rebooked", tone: "success" },
  refunded: { label: "Refunded", tone: "neutral" },
  released: { label: "Hold released", tone: "neutral" },
};

const at = (date: string, time: string) => `${formatShortDate(date)}, ${time}`;

function detail(entry: DisplacedEntry): string {
  const { offer, visit, status } = entry;
  if (status === "pending" && offer) {
    const until = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
      .format(new Date(offer.expiresAt));
    return `${offer.slots.length} ${offer.slots.length === 1 ? "time" : "times"} held until ${until}`;
  }
  if (status === "rebooked") return `Now ${at(visit.date, visit.time)}${visit.token ? ` (token ${visit.token})` : ""}`;
  if (status === "refunded") return offer?.status === "expired" ? "No time chosen, cancelled and refunded" : "Patient cancelled, refunded";
  return "Unpaid hold, nothing was charged";
}

/**
 * Patients the doctor moved off removed hours, newest first, with where each one stands. Server
 * component: the caller reads the list with displacedFor().
 */
export function DisplacedPatients({ entries }: { entries: readonly DisplacedEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section aria-labelledby="displaced-patients" className="mt-8 rounded-card border border-hairline bg-surface p-5 shadow-card md:p-6">
      <h2 id="displaced-patients" className="text-title3 font-semibold text-ink">
        Displaced patients
      </h2>
      <p className="mt-1 text-callout text-ink-2">
        Visits in hours you removed. Each patient was offered new times; until they choose, those times are held for them.
      </p>
      <ul className="mt-4 divide-y divide-hairline">
        {entries.map((entry) => {
          const original = entry.offer && entry.status === "rebooked" ? null : at(entry.visit.date, entry.visit.time);
          return (
            <li key={entry.visit.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3">
              <div className="min-w-0">
                <p className="text-body font-medium text-ink">
                  {entry.visit.patientName} <span className="text-callout font-normal text-muted">· {entry.visit.reference}</span>
                </p>
                <p className="text-callout text-ink-2 tabular">
                  {original ? `Was ${original} · ` : ""}
                  {detail(entry)}
                </p>
              </div>
              <Badge tone={STATUS[entry.status].tone}>{STATUS[entry.status].label}</Badge>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
