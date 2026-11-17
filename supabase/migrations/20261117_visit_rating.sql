-- One rating on a completed visit, sent by the patient after they are seen.
-- Additive only: no existing appointment row is changed by this migration.
-- Server only: RLS on clinic_appointments stays as it is (service role, no public policies).
-- rated_at is text, matching displaced_at and the other instants on this table (ISO-8601).
-- The app writes the same string to SQLite and Postgres.

alter table public.clinic_appointments add column if not exists rating_score integer;
alter table public.clinic_appointments add column if not exists rating_note text;
alter table public.clinic_appointments add column if not exists rated_at text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clinic_appointments_rating_check'
      and conrelid = 'public.clinic_appointments'::regclass
  ) then
    alter table public.clinic_appointments
      add constraint clinic_appointments_rating_check
      check (
        (
          rating_score is null
          and rated_at is null
          and rating_note is null
        )
        or (
          rating_score between 1 and 5
          and rated_at is not null
          and (rating_note is null or char_length(rating_note) <= 280)
        )
      );
  end if;
end $$;
