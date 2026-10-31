-- Westbrook clinic data store. The app reaches these tables only from the server, with the
-- service role key. RLS is on and there are no policies, so the public (anon/authenticated)
-- API roles can read and write nothing.

create table if not exists public.clinic_users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  name text not null,
  role text not null check (role in ('patient', 'doctor', 'reception', 'admin')),
  doctor_id text,
  mobile text not null default '',
  dob text not null default '',
  created_at text not null,
  disabled_at text,
  sessions_revoked_at text,
  doctor_room text,
  doctor_interest text
);

create table if not exists public.clinic_sessions (
  token_hash text primary key,
  id text not null unique,
  user_id text not null,
  created_at text not null default '',
  expires_at text not null,
  device text not null default ''
);
create index if not exists clinic_sessions_by_user on public.clinic_sessions (user_id);

create table if not exists public.clinic_appointments (
  id text primary key,
  reference text not null,
  slot_id text not null,
  doctor_id text not null,
  date text not null,
  time text not null,
  reason_id text not null,
  patient_name text not null,
  patient_dob text not null default '',
  patient_mobile text not null default '',
  patient_chi text not null default '',
  note text not null default '',
  status text not null check (status in ('booked', 'completed', 'cancelled')),
  patient_user_id text,
  created_at text not null
);
-- One held visit per slot: this is what makes two people picking the same time safe.
create unique index if not exists clinic_appointments_one_held_slot
  on public.clinic_appointments (slot_id) where status in ('booked', 'completed');
create index if not exists clinic_appointments_by_patient on public.clinic_appointments (patient_user_id);
create index if not exists clinic_appointments_by_doctor on public.clinic_appointments (doctor_id, date);

create table if not exists public.clinic_login_codes (
  email text primary key,
  code_hash text not null,
  expires_at text not null,
  sent_at text not null,
  attempts integer not null default 0,
  signup_token_hash text
);

create table if not exists public.clinic_charges (
  appointment_id text primary key,
  reference text not null,
  reason_id text not null,
  amount_pence integer not null,
  created_at text not null,
  waived_at text,
  waived_by_user_id text,
  waived_by_name text not null default '',
  waived_reason text not null default '',
  version integer not null default 0
);

create table if not exists public.clinic_payment_entries (
  id text primary key,
  appointment_id text not null references public.clinic_charges (appointment_id),
  kind text not null check (kind in ('payment', 'refund')),
  method text not null check (method in ('online_card', 'desk_card', 'cash')),
  amount_pence integer not null check (amount_pence > 0),
  at text not null,
  by_user_id text,
  by_name text not null default '',
  note text not null default ''
);
create index if not exists clinic_payment_entries_by_visit on public.clinic_payment_entries (appointment_id);

create table if not exists public.clinic_audit_events (
  seq bigint generated always as identity,
  id text primary key,
  at text not null,
  action text not null,
  actor_id text,
  actor_name text not null,
  actor_role text not null,
  subject_type text,
  subject_id text,
  summary text not null,
  reason text not null default ''
);
create index if not exists clinic_audit_events_by_time on public.clinic_audit_events (at desc, seq desc);

-- The activity log and the money trail are append-only.
create or replace function public.clinic_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'This record is append-only.';
end $$;

drop trigger if exists clinic_audit_events_no_change on public.clinic_audit_events;
create trigger clinic_audit_events_no_change before update or delete on public.clinic_audit_events
  for each row execute function public.clinic_append_only();
drop trigger if exists clinic_payment_entries_no_change on public.clinic_payment_entries;
create trigger clinic_payment_entries_no_change before update or delete on public.clinic_payment_entries
  for each row execute function public.clinic_append_only();

-- Charges are written together with their payment lines, atomically.
create or replace function public.clinic_create_charge(p_charge jsonb, p_entries jsonb)
returns text language plpgsql set search_path = '' as $$
declare inserted integer;
begin
  insert into public.clinic_charges
    (appointment_id, reference, reason_id, amount_pence, created_at, waived_at, waived_by_user_id, waived_by_name, waived_reason)
  values (
    p_charge->>'appointment_id', p_charge->>'reference', p_charge->>'reason_id', (p_charge->>'amount_pence')::int,
    p_charge->>'created_at', p_charge->>'waived_at', p_charge->>'waived_by_user_id',
    coalesce(p_charge->>'waived_by_name', ''), coalesce(p_charge->>'waived_reason', '')
  ) on conflict (appointment_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return 'exists'; end if;
  insert into public.clinic_payment_entries (id, appointment_id, kind, method, amount_pence, at, by_user_id, by_name, note)
  select e->>'id', p_charge->>'appointment_id', e->>'kind', e->>'method', (e->>'amount_pence')::int, e->>'at',
         e->>'by_user_id', coalesce(e->>'by_name', ''), coalesce(e->>'note', '')
  from jsonb_array_elements(p_entries) as e;
  return 'ok';
end $$;

-- Change one charge without losing a concurrent change: the caller read version p_version.
create or replace function public.clinic_apply_charge(p_appointment_id text, p_version integer, p_waiver jsonb, p_entries jsonb)
returns text language plpgsql set search_path = '' as $$
declare updated integer;
begin
  update public.clinic_charges set
    waived_at = p_waiver->>'waived_at',
    waived_by_user_id = p_waiver->>'waived_by_user_id',
    waived_by_name = coalesce(p_waiver->>'waived_by_name', ''),
    waived_reason = coalesce(p_waiver->>'waived_reason', ''),
    version = version + 1
  where appointment_id = p_appointment_id and version = p_version;
  get diagnostics updated = row_count;
  if updated = 0 then return 'stale'; end if;
  insert into public.clinic_payment_entries (id, appointment_id, kind, method, amount_pence, at, by_user_id, by_name, note)
  select e->>'id', p_appointment_id, e->>'kind', e->>'method', (e->>'amount_pence')::int, e->>'at',
         e->>'by_user_id', coalesce(e->>'by_name', ''), coalesce(e->>'note', '')
  from jsonb_array_elements(p_entries) as e;
  return 'ok';
end $$;

alter table public.clinic_users enable row level security;
alter table public.clinic_sessions enable row level security;
alter table public.clinic_appointments enable row level security;
alter table public.clinic_login_codes enable row level security;
alter table public.clinic_charges enable row level security;
alter table public.clinic_payment_entries enable row level security;
alter table public.clinic_audit_events enable row level security;

revoke all on public.clinic_users, public.clinic_sessions, public.clinic_appointments, public.clinic_login_codes,
  public.clinic_charges, public.clinic_payment_entries, public.clinic_audit_events from anon, authenticated;
revoke all on function public.clinic_append_only(), public.clinic_create_charge(jsonb, jsonb),
  public.clinic_apply_charge(text, integer, jsonb, jsonb) from public, anon, authenticated;
grant all on public.clinic_users, public.clinic_sessions, public.clinic_appointments, public.clinic_login_codes,
  public.clinic_charges, public.clinic_payment_entries, public.clinic_audit_events to service_role;
grant execute on function public.clinic_create_charge(jsonb, jsonb),
  public.clinic_apply_charge(text, integer, jsonb, jsonb) to service_role;
