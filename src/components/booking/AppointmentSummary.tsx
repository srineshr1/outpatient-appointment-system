import { DoctorPortrait } from "@/components/doctors/DoctorPortrait";
import { Calendar, Clock, Pin, Users } from "@/components/icons";
import { Card } from "@/components/ui/Card";
import { addMinutes } from "@/lib/clock";
import type { Doctor, Reason, Slot } from "@/lib/data";
import { practice } from "@/lib/data";
import { formatFull } from "@/lib/format";
import { placesLabel, slotTimeLabel, tokenLabel } from "@/lib/sessions";
import type { ReactNode } from "react";

interface Props {
  doctor: Doctor;
  slot: Slot;
  reason?: Reason | null;
  title?: string;
  footer?: ReactNode;
  /** Wave bookings: the patient's token. */
  token?: number | null;
  accent?: boolean;
}

export function AppointmentSummary({ doctor, slot, reason, title = "Your appointment", footer, token, accent = false }: Props) {
  return (
    <Card
      className={`p-5 backdrop-blur-md md:p-6 ${
        accent ? "border-accent/25 dark:border-cyan-400/25 shadow-[0_0_24px_rgba(34,211,238,0.08)]" : "border-ink/10"
      }`}
    >
      <h2 className="text-callout font-semibold text-muted">{title}</h2>
      <div className="mt-4 flex items-center gap-3">
        <DoctorPortrait doctor={doctor} size={44} className="ring-1 ring-ink/10" />
        <div>
          <p className="text-body font-semibold text-ink">{doctor.name}</p>
          <p className="text-callout text-muted">{doctor.interest}</p>
        </div>
      </div>
      <dl className="mt-5 grid gap-3 border-t border-hairline pt-5 text-body">
        <Row icon={<Calendar size={20} />} term="Date">
          {formatFull(slot.date)}
        </Row>
        {slot.mode === "wave" ? (
          <>
            {/* A wave has no minute of its own: the patient comes in the wave's window and is seen by token. */}
            <Row icon={<Clock size={20} />} term="Wave">
              <span className="tabular">Wave {slotTimeLabel(slot)}</span>
              <span className="text-muted"> · arrive any time in this window</span>
            </Row>
            <Row icon={<Users size={20} />} term="Token">
              {token ? (
                <>
                  <span
                    data-testid="wave-token"
                    className="tabular inline-flex items-center rounded-lg border border-accent/25 dark:border-cyan-400/25 bg-accent/10 dark:bg-cyan-400/10 px-2.5 py-0.5 text-body font-bold text-accent dark:text-cyan-300"
                  >
                    {tokenLabel(token)}
                  </span>
                  <span className="mt-1 block text-callout text-muted">Patients are seen in token order, lowest first.</span>
                </>
              ) : (
                <>
                  <span>You get a token number when you book</span>
                  <span className="mt-1 block text-callout text-muted">
                    Seen in token order{placesLabel(slot) ? ` · ${placesLabel(slot)}` : ""}
                  </span>
                </>
              )}
            </Row>
          </>
        ) : (
          <Row icon={<Clock size={20} />} term="Time">
            <span className="tabular">
              {slot.time}
              {reason ? `–${addMinutes(slot.time, reason.minutes)}` : ""}
            </span>
            <span className="text-muted">{reason ? ` · ${reason.minutes} minutes` : " · length depends on the reason"}</span>
          </Row>
        )}
        <Row icon={<Pin size={20} />} term="Where">
          {doctor.room}, {practice.name}
        </Row>
      </dl>
      {footer ? <div className="mt-5 border-t border-hairline pt-4">{footer}</div> : null}
    </Card>
  );
}

function Row({ icon, term, children }: { icon: ReactNode; term: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="mt-0.5 shrink-0 text-accent/80 dark:text-cyan-400/80">
        {icon}
        <span className="sr-only">{term}</span>
      </dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}
