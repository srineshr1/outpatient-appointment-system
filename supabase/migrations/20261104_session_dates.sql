-- Date-bounded and one-off consulting sessions. Additive and nullable, so code that does not know
-- these columns keeps working: it never writes them, and a one-off session stores empty weekdays,
-- so older code simply generates no slots for it.
alter table public.clinic_consult_sessions add column if not exists start_date text;
alter table public.clinic_consult_sessions add column if not exists end_date text;
alter table public.clinic_consult_sessions add column if not exists on_date text;
alter table public.clinic_consult_sessions drop constraint if exists clinic_consult_sessions_dates;
alter table public.clinic_consult_sessions add constraint clinic_consult_sessions_dates check (
  (start_date is null or start_date ~ '^\d{4}-\d{2}-\d{2}$')
  and (end_date is null or end_date ~ '^\d{4}-\d{2}-\d{2}$')
  and (on_date is null or on_date ~ '^\d{4}-\d{2}-\d{2}$')
  and (start_date is null or end_date is null or start_date <= end_date)
  and (on_date is null or (start_date is null and end_date is null))
);
