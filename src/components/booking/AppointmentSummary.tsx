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
  accent?: boolean;
}

export function AppointmentSummary({ doctor, slot, reason, title = "Your appointment", footer, token, accent = false }: Props) {
  return (
    <Card
      className={`p-5 backdrop-blur-md md:p-6 ${
        accent ? "border-cyan-400/25 shadow-[0_0_24px_rgba(34,211,238,0.08)]" : "border-white/10"
      }`}
    >
      <h2 className="text-callout font-semibold text-zinc-400">{title}</h2>
      <div className="mt-4 flex items-center gap-3">
        <DoctorPortrait doctor={doctor} size={44} className="ring-1 ring-white/10" />
        <div>
          <p className="text-body font-semibold text-zinc-50">{doctor.name}</p>
          <p className="text-callout text-zinc-400">{doctor.interest}</p>
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
              <span className="text-zinc-400">
                {token ? ` · token ${token}, seen in token order` : " · seen in token order"}
              </span>
            </>
          ) : (
            <>
              <span className="tabular">
                {slot.time}
                {reason ? `–${addMinutes(slot.time, reason.minutes)}` : ""}
              </span>
              <span className="text-zinc-400">{reason ? ` · ${reason.minutes} minutes` : " · length depends on the reason"}</span>
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
      <dt className="mt-0.5 shrink-0 text-cyan-400/80">
        {icon}
        <span className="sr-only">{term}</span>
      </dt>
      <dd className="text-zinc-100">{children}</dd>
    </div>
  );
}
