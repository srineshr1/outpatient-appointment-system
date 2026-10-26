import { practice } from "./data";
import { addMinutes, ageLabel, downloadIcs, formatFull, formatPhone } from "./format";
import { IconCalendar } from "./icons";
import { Button } from "./ui";

export function Confirmed({ booking, onAnother }) {
  const { reference, doctor, slot, reason, patient } = booking;
  const end = addMinutes(slot.time, reason.minutes);
  const chi = patient.chi.replace(/\s/g, "");

  return (
    <div className="mx-auto grid max-w-page grid-cols-12 gap-x-4 gap-y-8 px-4 md:gap-x-6 md:px-8 xl:gap-x-12">
      <div className="col-span-12 xl:col-span-7">
        <p className="text-label text-ok uppercase">3 of 3 — Visit held</p>
        <h1 className="mt-4 font-display text-day font-medium text-ink tabular-nums md:text-numeral">
          <span className="sr-only">Booking reference </span>
          {reference}
        </h1>
        <p className="mt-6 max-w-prose text-body text-ink">
          {formatFull(slot.date)}, {slot.time}–{end}. {doctor.name}, {doctor.room}.
        </p>
        <div className="mt-8 flex flex-col items-stretch gap-3 md:flex-row md:items-center">
          <Button onClick={() => downloadIcs(booking)}>
            <IconCalendar />
            Download calendar file
          </Button>
          <Button variant="quiet" onClick={onAnother}>
            Book another time
          </Button>
        </div>
      </div>

      <div className="col-span-12 border-t border-line pt-6 xl:col-span-5 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-8">
        <h2 className="font-display text-section font-medium text-ink">The record</h2>
        <dl className="mt-4">
          <Row term="Patient" value={`${patient.name.trim()}, ${ageLabel(patient.dob)}`} />
          <Row term="Mobile" value={formatPhone(patient.mobile)} />
          <Row term="Reason" value={`${reason.label}, ${reason.minutes} minutes`} />
          <Row term="Bring" value={chi ? `CHI ${chi}. Arrive five minutes early.` : "Your CHI number, if you have one. Arrive five minutes early."} />
          <Row term="Release" value={`Two hours’ notice on ${practice.phoneDisplay}.`} />
        </dl>
        {patient.note.trim() ? (
          <p className="mt-6 max-w-prose border-t border-line pt-4 text-body text-ink-soft">{patient.note.trim()}</p>
        ) : null}
      </div>
    </div>
  );
}

function Row({ term, value }) {
  return (
    <div className="grid grid-cols-12 gap-4 border-b border-line py-3">
      <dt className="col-span-4 text-label text-muted uppercase">{term}</dt>
      <dd className="col-span-8 text-body text-ink tabular-nums">{value}</dd>
    </div>
  );
}
