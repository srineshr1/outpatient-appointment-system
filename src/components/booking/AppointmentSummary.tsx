import { Calendar, Clock, Pin } from "@/components/icons";
import { Card } from "@/components/ui/Card";
import { addMinutes } from "@/lib/clock";
import type { Doctor, Reason, Slot } from "@/lib/data";
import { formatFull, monogram } from "@/lib/format";
import type { ReactNode } from "react";

interface Props {
  doctor: Doctor;
  slot: Slot;
  reason?: Reason | null;
  title?: string;
  footer?: ReactNode;
}

export function AppointmentSummary({ doctor, slot, reason, title = "Your appointment", footer }: Props) {
  return (
    <Card className="p-5 md:p-6">
      <h2 className="text-callout font-semibold text-muted">{title}</h2>
      <div className="mt-4 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-fill text-callout font-semibold text-ink-2"
        >
          {monogram(doctor.name)}
        </span>
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
          <span className="tabular">
            {slot.time}
            {reason ? `–${addMinutes(slot.time, reason.minutes)}` : ""}
          </span>
          <span className="text-muted">{reason ? ` · ${reason.minutes} minutes` : " · length depends on the reason"}</span>
        </Row>
        <Row icon={<Pin size={20} />} term="Where">
          {doctor.room}, Halden Street Practice
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
