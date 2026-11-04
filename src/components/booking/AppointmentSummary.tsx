import { DoctorPortrait } from "@/components/doctors/DoctorPortrait";
import { Calendar, Clock, Pin } from "@/components/icons";
import { Card } from "@/components/ui/Card";
import { addMinutes } from "@/lib/clock";
import type { Doctor, Reason, Slot } from "@/lib/data";
import { practice } from "@/lib/data";
import { formatFull } from "@/lib/format";
import { slotTimeLabel } from "@/lib/sessions";
import type { ReactNode } from "react";

interface Props {
  doctor: Doctor;
  slot: Slot;
  reason?: Reason | null;
  title?: string;
  footer?: ReactNode;
  /** Wave bookings: the patient's token. */
  token?: number | null;
}

export function AppointmentSummary({ doctor, slot, reason, title = "Your appointment", footer, token }: Props) {
  return (
    <Card className="p-5 md:p-6">
      <h2 className="text-callout font-semibold text-muted">{title}</h2>
      <div className="mt-4 flex items-center gap-3">
        <DoctorPortrait doctor={doctor} size={44} />
        <div>
          <p className="text-body font-semibold text-ink">{doctor.name}</p>
          <p className="text-callout text-muted">{doctor.interest}</p>
        </div>
      </div>
      <dl className="mt-5 grid gap-3 border-t border-hairline pt-5 text-body">
        <Row icon={<Calendar size={20} />} term="Date">
          {formatFull(slot.date)}
        </Row>
        <Row icon={<Clock size={20} />} term="Time">
          {slot.mode === "wave" ? (
            <>
              <span className="tabular">{slotTimeLabel(slot)}</span>
              <span className="text-muted">
                {token ? ` · token ${token}, seen in token order` : " · seen in token order"}
              </span>
            </>
          ) : (
            <>
              <span className="tabular">
                {slot.time}
                {reason ? `–${addMinutes(slot.time, reason.minutes)}` : ""}
              </span>
              <span className="text-muted">{reason ? ` · ${reason.minutes} minutes` : " · length depends on the reason"}</span>
            </>
          )}
        </Row>
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
      <dt className="mt-0.5 shrink-0 text-muted">
        {icon}
        <span className="sr-only">{term}</span>
      </dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}
