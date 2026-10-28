-- Self-signup profiles, doctor consulting sessions (stream and wave), and reschedule history.
-- Same rules as the rest of the clinic store: server only, service role key, RLS on, no policies.
-- The unrelated products/orders tables are not touched.

-- One profile per account. `kind` says which onboarding it belongs to; `data` holds the fields.
create table if not exists public.clinic_profiles (
  user_id text primary key,
  kind text not null check (kind in ('patient', 'doctor')),
  data jsonb not null default '{}'::jsonb,
  updated_at text not null
);

-- A doctor's weekly consulting session. Stream: one patient per fixed slot. Wave: N patients per wave.
create table if not exists public.clinic_consult_sessions (
  id text primary key,
  doctor_id text not null,
  label text not null default '',
  weekdays text not null,
  start_time text not null,
  end_time text not null,
  room text not null default '',
  mode text not null check (mode in ('stream', 'wave')),
  slot_minutes integer,
  wave_minutes integer,
  wave_capacity integer,
  archived_at text,
  created_at text not null,
  updated_at text not null,
  constraint clinic_consult_sessions_times check (start_time < end_time),
  constraint clinic_consult_sessions_mode_fields check (
    (mode = 'stream' and slot_minutes between 5 and 120 and wave_minutes is null and wave_capacity is null)
    or (mode = 'wave' and wave_minutes between 15 and 240 and wave_capacity between 1 and 50 and slot_minutes is null)
  )
);
create index if not exists clinic_consult_sessions_by_doctor on public.clinic_consult_sessions (doctor_id);

-- Wave bookings carry a token. Their slot_id is "<wave>#<token>", so the existing unique index on
-- held slots stops two people sharing a token, and the check stops a token above the wave's capacity.
alter table public.clinic_appointments add column if not exists session_id text;
alter table public.clinic_appointments add column if not exists token integer;
alter table public.clinic_appointments add column if not exists wave_capacity integer;
alter table public.clinic_appointments add column if not exists end_time text;
alter table public.clinic_appointments drop constraint if exists clinic_appointments_token_within_capacity;
alter table public.clinic_appointments add constraint clinic_appointments_token_within_capacity
  check (token is null or (wave_capacity is not null and token >= 1 and token <= wave_capacity));

-- Who moved a visit, from where to where, and when. Append-only.
create table if not exists public.clinic_reschedules (
  id text primary key,
  appointment_id text not null,
  reference text not null,
  doctor_id text not null,
  patient_user_id text,
  by_user_id text,
  by_name text not null default '',
  by_role text not null default '',
  from_slot_id text not null,
  from_date text not null,
  from_time text not null,
  from_token integer,
  to_slot_id text not null,
  to_date text not null,
  to_time text not null,
  to_token integer,
  reason text not null default '',
  at text not null
);
create index if not exists clinic_reschedules_by_appointment on public.clinic_reschedules (appointment_id, at);
create index if not exists clinic_reschedules_by_doctor on public.clinic_reschedules (doctor_id);
create index if not exists clinic_reschedules_by_patient on public.clinic_reschedules (patient_user_id);

drop trigger if exists clinic_reschedules_no_change on public.clinic_reschedules;
create trigger clinic_reschedules_no_change before update or delete on public.clinic_reschedules
  for each row execute function public.clinic_append_only();

-- Move a booked visit to another slot or wave and write the history line in one transaction.
-- Returns 'ok', 'taken' (the new slot or token is held), or 'stale' (the visit is no longer booked
-- in the slot the caller read).
create or replace function public.clinic_reschedule(p_id text, p_from_slot text, p_to jsonb, p_history jsonb)
returns text language plpgsql set search_path = '' as $$
declare changed integer;
begin
  begin
    update public.clinic_appointments set
      slot_id = p_to->>'slot_id',
      date = p_to->>'date',
      time = p_to->>'time',
      end_time = p_to->>'end_time',
      session_id = p_to->>'session_id',
      token = (p_to->>'token')::int,
      wave_capacity = (p_to->>'wave_capacity')::int
    where id = p_id and status = 'booked' and slot_id = p_from_slot;
    get diagnostics changed = row_count;
  exception when unique_violation then
    return 'taken';
  end;
  if changed = 0 then return 'stale'; end if;
  insert into public.clinic_reschedules
    (id, appointment_id, reference, doctor_id, patient_user_id, by_user_id, by_name, by_role,
     from_slot_id, from_date, from_time, from_token, to_slot_id, to_date, to_time, to_token, reason, at)
  values (
    p_history->>'id', p_id, p_history->>'reference', p_history->>'doctor_id', p_history->>'patient_user_id',
    p_history->>'by_user_id', coalesce(p_history->>'by_name', ''), coalesce(p_history->>'by_role', ''),
    p_history->>'from_slot_id', p_history->>'from_date', p_history->>'from_time', (p_history->>'from_token')::int,
    p_history->>'to_slot_id', p_history->>'to_date', p_history->>'to_time', (p_history->>'to_token')::int,
    coalesce(p_history->>'reason', ''), p_history->>'at'
  );
  return 'ok';
end $$;

alter table public.clinic_profiles enable row level security;
alter table public.clinic_consult_sessions enable row level security;
alter table public.clinic_reschedules enable row level security;

revoke all on public.clinic_profiles, public.clinic_consult_sessions, public.clinic_reschedules from anon, authenticated;
revoke all on function public.clinic_reschedule(text, text, jsonb, jsonb) from public, anon, authenticated;
grant all on public.clinic_profiles, public.clinic_consult_sessions, public.clinic_reschedules to service_role;
grant execute on function public.clinic_reschedule(text, text, jsonb, jsonb) to service_role;
