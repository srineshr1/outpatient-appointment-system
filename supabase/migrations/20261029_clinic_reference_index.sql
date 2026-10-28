-- Booking references are looked up one at a time when a visit is booked (is this one free?).
create index if not exists clinic_appointments_by_reference on public.clinic_appointments (reference);
