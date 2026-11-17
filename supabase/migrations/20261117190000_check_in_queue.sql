-- Check-in and the day's queue.
-- Additive only: two new nullable columns, and the status check gains 'no_show'. No row is changed.
-- A checked-in patient (and one with the doctor) stays 'booked', so capacity, the booking functions
-- and every listing that counts booked visits keep working unchanged.
-- Times are text (ISO-8601), like rated_at and displaced_at on this table.

alter table public.clinic_appointments add column if not exists checked_in_at text;
alter table public.clinic_appointments add column if not exists consult_started_at text;

-- Replace the status check with one that also allows 'no_show' (a closed visit, like 'cancelled').
-- Every value the old check allowed is still allowed, so validating it cannot fail on existing rows.
alter table public.clinic_appointments drop constraint if exists clinic_appointments_status_check;
alter table public.clinic_appointments
  add constraint clinic_appointments_status_check
  check (status = any (array['booked', 'completed', 'cancelled', 'pending_payment', 'expired', 'displaced', 'no_show']::text[]));

-- The consultation can only start once the patient is checked in (the app records both together).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clinic_appointments_consult_after_check_in'
      and conrelid = 'public.clinic_appointments'::regclass
  ) then
    alter table public.clinic_appointments
      add constraint clinic_appointments_consult_after_check_in
      check (consult_started_at is null or checked_in_at is not null);
  end if;
end $$;
