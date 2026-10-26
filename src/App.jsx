import { useEffect, useRef, useState } from "react";
import { Book } from "./Book";
import { Confirmed } from "./Confirmed";
import { Details } from "./Details";
import { doctors, FRAGILE_SLOT_ID, practice, reasons, slots } from "./data";
import { addDays, mondayOf, nextOpening, referenceFor } from "./format";

const EMPTY_FORM = {
  name: "",
  dob: "",
  mobile: "",
  chi: "",
  reasonId: "",
  note: "",
  isNew: false,
};

export default function App() {
  const [step, setStep] = useState(1);
  const [doctorId, setDoctorId] = useState(null);
  const [day, setDay] = useState("2026-10-29");
  const [weekStart, setWeekStart] = useState("2026-10-26");
  const [slotId, setSlotId] = useState(null);
  const [takenIds, setTakenIds] = useState([]);
  const [slotError, setSlotError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [booking, setBooking] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const headingRef = useRef(null);
  const errorRef = useRef(null);
  const skipFirstFocus = useRef(true);
  const loadTimer = useRef(null);

  const doctor = doctors.find((person) => person.id === doctorId) ?? null;
  const slot = slots.find((item) => item.id === slotId) ?? null;

  useEffect(() => () => window.clearTimeout(loadTimer.current), []);

  function showWeekLoading() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setLoading(true);
    window.clearTimeout(loadTimer.current);
    loadTimer.current = window.setTimeout(() => setLoading(false), 400);
  }

  useEffect(() => {
    if (step !== 2) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setStep(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const focusSnapshot = useRef({ step, slotError });

  useEffect(() => {
    if (skipFirstFocus.current) {
      skipFirstFocus.current = false;
      focusSnapshot.current = { step, slotError };
      return;
    }
    const stepChanged = focusSnapshot.current.step !== step;
    const errorAppeared = Boolean(slotError) && slotError !== focusSnapshot.current.slotError;
    focusSnapshot.current = { step, slotError };
    if (errorAppeared) {
      errorRef.current?.focus();
      return;
    }
    if (stepChanged) headingRef.current?.focus();
  }, [step, slotError]);

  function selectDoctor(id) {
    setDoctorId(id);
    setSlotId(null);
    setSlotError("");
    const next = nextOpening(id, takenIds);
    if (!next) return;
    setDay(next.date);
    const monday = mondayOf(next.date);
    if (monday !== weekStart) {
      setWeekStart(monday);
      showWeekLoading();
    }
  }

  function leaveDoctor() {
    setDoctorId(null);
    setSlotId(null);
    setSlotError("");
  }

  function selectSlot(id) {
    const next = slots.find((item) => item.id === id);
    setSlotId(id);
    setSlotError("");
    if (next) setDay(next.date);
  }

  function shiftWeek(direction) {
    const next = addDays(weekStart, direction * 7);
    if (next === weekStart) return;
    setWeekStart(next);
    const end = addDays(next, 4);
    if (day < next || day > end) setDay(next);
    showWeekLoading();
  }

  function jumpTo(iso) {
    const monday = mondayOf(iso);
    setDay(iso);
    if (monday !== weekStart) {
      setWeekStart(monday);
      showWeekLoading();
    }
  }

  function confirmBooking() {
    if (!slot || form.isNew) return;
    setSubmitting(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => {
      setSubmitting(false);
      if (slot.id === FRAGILE_SLOT_ID && !takenIds.includes(slot.id)) {
        setTakenIds((ids) => [...ids, slot.id]);
        setSlotId(null);
        setSlotError("This time was taken at 13:41. Choose another.");
        setDay(slot.date);
        setWeekStart(mondayOf(slot.date));
        setStep(1);
        return;
      }
      const reason = reasons.find((item) => item.id === form.reasonId);
      setBooking({
        reference: referenceFor(slot.id, form.name),
        doctor,
        slot,
        reason,
        patient: form,
      });
      setTakenIds((ids) => (ids.includes(slot.id) ? ids : [...ids, slot.id]));
      setStep(3);
    }, reduce ? 0 : 400);
  }

  function bookAnother() {
    if (!booking) return;
    const bookedId = booking.slot.id;
    setTakenIds((ids) => (ids.includes(bookedId) ? ids : [...ids, bookedId]));
    setDoctorId(null);
    setDay(booking.slot.date);
    setWeekStart(mondayOf(booking.slot.date));
    setSlotId(null);
    setBooking(null);
    setForm(EMPTY_FORM);
    setSlotError("");
    setStep(1);
  }

  return (
    <div className={`min-h-dvh bg-paper font-sans text-ink ${step === 1 && slot ? "pb-32 md:pb-0" : ""}`}>
      <a
        href={step === 1 ? "#book" : "#content"}
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-20 focus:bg-paper-raised focus:px-4 focus:py-3 focus:text-ui"
      >
        {step === 1 ? (doctor ? "Skip to the book" : "Skip to the doctors") : "Skip to content"}
      </a>
      <header className="border-b border-line bg-paper-raised">
        <div className="mx-auto flex max-w-page items-baseline justify-between gap-4 px-4 py-4 md:px-8">
          <div>
            <p className="font-display text-section font-medium text-ink italic">Halden Street</p>
            <p className="text-label text-muted uppercase">Find a doctor</p>
          </div>
          <a
            href={practice.phoneHref}
            className="text-ui text-ink tabular-nums underline decoration-line underline-offset-4 hover:decoration-accent"
          >
            {practice.phoneDisplay}
          </a>
        </div>
      </header>

      <main id="content" ref={headingRef} tabIndex={-1} className="step-in pt-8 pb-16 outline-none md:pt-12">
        {step === 1 ? (
          <Book
            doctors={doctors}
            doctor={doctor}
            weekStart={weekStart}
            slotId={slotId}
            takenIds={takenIds}
            loading={loading}
            slotError={slotError}
            errorRef={errorRef}
            onDoctor={selectDoctor}
            onLeave={leaveDoctor}
            onSlot={selectSlot}
            onWeek={shiftWeek}
            onJump={jumpTo}
            onHold={() => slot && setStep(2)}
          />
        ) : null}
        {step === 2 && slot && doctor ? (
          <Details
            doctor={doctor}
            slot={slot}
            form={form}
            submitting={submitting}
            onChange={setForm}
            onBack={() => setStep(1)}
            onConfirm={confirmBooking}
          />
        ) : null}
        {step === 3 && booking ? <Confirmed booking={booking} onAnother={bookAnother} /> : null}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-page flex-col gap-2 px-4 py-6 md:flex-row md:items-baseline md:justify-between md:px-8">
          <p className="text-ui text-ink">{practice.address}</p>
          <p className="text-ui text-ink-soft">{practice.hours}</p>
        </div>
      </footer>
    </div>
  );
}
