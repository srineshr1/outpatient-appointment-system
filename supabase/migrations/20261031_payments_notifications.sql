-- Day 3: online payments (Razorpay behind a provider interface), refunds, and the notification
-- outbox with scheduled reminders. Server-only tables: RLS on, no policies, service role only.

-- 1. A visit can now wait for payment, or lapse when the hold runs out. Held places (pending_payment)
--    count towards capacity through the same one-holder-per-slot index.
alter table public.clinic_appointments drop constraint if exists clinic_appointments_status_check;
alter table public.clinic_appointments
  add constraint clinic_appointments_status_check
  check (status in ('booked', 'completed', 'cancelled', 'pending_payment', 'expired'));
drop index if exists public.clinic_appointments_one_held_slot;
create unique index clinic_appointments_one_held_slot
  on public.clinic_appointments (slot_id) where status in ('booked', 'completed', 'pending_payment');

-- 2. Settings: refund tiers, reminder offsets, hold length, and what the cron runner needs.
create table if not exists public.clinic_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.clinic_settings enable row level security;

insert into public.clinic_settings (key, value) values
  ('refund_policy', '{"tiers":[{"minHours":24,"percent":100},{"minHours":2,"percent":50},{"minHours":0,"percent":0}],"doctorCancelPercent":100}'),
  ('reminder_offsets_minutes', '[1440, 120]'),
  ('hold_minutes', '15')
on conflict (key) do nothing;

-- The cron runner's shared secret. Generated here, never printed. The /api/cron route accepts it
-- (or the CRON_SECRET env var when one is set), and pg_cron reads it from here.
insert into public.clinic_settings (key, value)
  values ('cron_secret', to_jsonb(encode(extensions.gen_random_bytes(32), 'hex')))
on conflict (key) do nothing;
insert into public.clinic_settings (key, value)
  values ('cron_url', '"https://outpatient-appointment-system.vercel.app/api/cron"')
on conflict (key) do nothing;

-- 3. The doctor's consultation fee: the source of truth for what a booking is charged.
create table if not exists public.clinic_doctor_fees (
  doctor_id text primary key,
  fee_minor integer not null check (fee_minor >= 0),
  currency text not null default 'INR',
  updated_at timestamptz not null default now()
);
alter table public.clinic_doctor_fees enable row level security;
insert into public.clinic_doctor_fees (doctor_id, fee_minor) values
  ('adeyemi', 80000), ('reid', 60000), ('cho', 70000), ('rahman', 50000), ('macleod', 40000)
on conflict (doctor_id) do nothing;

-- 4. Payments: one order per held visit. The hold expiry lives here.
create table if not exists public.clinic_payments (
  id text primary key,
  appointment_id text not null unique,
  provider text not null,
  provider_order_id text unique,
  provider_payment_id text unique,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null default 'INR',
  status text not null check (status in ('created', 'failed', 'captured', 'expired')),
  failure_reason text not null default '',
  method text not null default '',
  hold_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists clinic_payments_by_hold on public.clinic_payments (hold_expires_at) where status in ('created', 'failed');
alter table public.clinic_payments enable row level security;

-- 5. Provider events, stored once by event id. A repeated delivery hits the primary key.
create table if not exists public.clinic_payment_events (
  id text primary key,
  provider text not null,
  type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text not null default ''
);
alter table public.clinic_payment_events enable row level security;

-- 6. Refunds. At most one active (pending or processed) refund per payment, and an idempotency key.
create table if not exists public.clinic_refunds (
  id text primary key,
  payment_id text not null references public.clinic_payments (id),
  appointment_id text not null,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null default 'INR',
  status text not null check (status in ('pending', 'processed', 'failed')),
  kind text not null check (kind in ('patient_cancel', 'doctor_cancel', 'late_payment', 'admin')),
  reason text not null default '',
  policy_percent integer not null default 100,
  idempotency_key text not null unique,
  provider_refund_id text unique,
  failure_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);
create unique index if not exists clinic_refunds_one_active
  on public.clinic_refunds (payment_id) where status in ('pending', 'processed');
create index if not exists clinic_refunds_by_appointment on public.clinic_refunds (appointment_id);
alter table public.clinic_refunds enable row level security;

-- 7. The notification outbox. dedupe_key is unique, so a retry can never send twice.
create table if not exists public.clinic_notifications (
  id text primary key,
  dedupe_key text not null unique,
  kind text not null,
  channel text not null default 'email',
  recipient text not null,
  appointment_id text,
  payload jsonb not null default '{}'::jsonb,
  status text not null check (status in ('scheduled', 'sending', 'sent', 'failed', 'cancelled', 'skipped')),
  attempts integer not null default 0,
  last_error text not null default '',
  scheduled_for timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists clinic_notifications_due on public.clinic_notifications (scheduled_for) where status in ('scheduled', 'failed', 'sending');
create index if not exists clinic_notifications_by_appointment on public.clinic_notifications (appointment_id);
alter table public.clinic_notifications enable row level security;

-- 8. Transactional functions.

-- Confirm a payment: the payment row and the visit change together, or not at all.
-- Outcomes: confirmed, late_confirmed (the hold had lapsed but the place was still free), already,
-- slot_lost (money taken but the place is gone: the caller refunds it), not_found.
create or replace function public.clinic_confirm_payment(p_payment_id text, p_provider_payment_id text, p_method text)
returns jsonb language plpgsql set search_path = '' as $$
declare pay public.clinic_payments; appt public.clinic_appointments; outcome text;
begin
  select * into pay from public.clinic_payments where id = p_payment_id for update;
  if not found then return jsonb_build_object('outcome', 'not_found'); end if;
  if pay.status = 'captured' then
    return jsonb_build_object('outcome', 'already', 'appointment_id', pay.appointment_id);
  end if;
  select * into appt from public.clinic_appointments where id = pay.appointment_id for update;
  if not found then return jsonb_build_object('outcome', 'not_found'); end if;

  if appt.status = 'pending_payment' then
    update public.clinic_appointments set status = 'booked' where id = appt.id;
    outcome := 'confirmed';
  elsif appt.status = 'expired' then
    begin
      update public.clinic_appointments set status = 'booked' where id = appt.id;
      outcome := 'late_confirmed';
    exception when unique_violation then
      outcome := 'slot_lost';
    end;
  else
    outcome := 'slot_lost';
  end if;

  update public.clinic_payments
    set status = 'captured', provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
        method = coalesce(nullif(p_method, ''), method), paid_at = now(), updated_at = now(), failure_reason = ''
    where id = pay.id;
  return jsonb_build_object('outcome', outcome, 'appointment_id', appt.id);
end $$;

-- Release holds that ran out. Returns the visits it released.
create or replace function public.clinic_expire_holds(p_now timestamptz)
returns setof text language plpgsql set search_path = '' as $$
declare ids text[];
begin
  select coalesce(array_agg(a.id), '{}') into ids
  from public.clinic_payments p join public.clinic_appointments a on a.id = p.appointment_id
  where p.status in ('created', 'failed') and p.hold_expires_at <= p_now and a.status = 'pending_payment';
  if array_length(ids, 1) is null then return; end if;
  update public.clinic_appointments set status = 'expired' where id = any(ids) and status = 'pending_payment';
  update public.clinic_payments set status = 'expired', updated_at = now()
    where appointment_id = any(ids) and status in ('created', 'failed');
  return query select unnest(ids);
end $$;

-- Queue a notification, once per dedupe key. A cancelled one with the same key is revived.
create or replace function public.clinic_enqueue_notification(p jsonb)
returns text language plpgsql set search_path = '' as $$
declare n integer;
begin
  insert into public.clinic_notifications (id, dedupe_key, kind, channel, recipient, appointment_id, payload, status, scheduled_for)
  values (p->>'id', p->>'dedupe_key', p->>'kind', coalesce(p->>'channel', 'email'), p->>'recipient', p->>'appointment_id',
          coalesce(p->'payload', '{}'::jsonb), 'scheduled', coalesce((p->>'scheduled_for')::timestamptz, now()))
  on conflict (dedupe_key) do update
    set status = 'scheduled', scheduled_for = excluded.scheduled_for, payload = excluded.payload, attempts = 0, last_error = ''
    where public.clinic_notifications.status = 'cancelled';
  get diagnostics n = row_count;
  if n = 0 then return 'exists'; end if;
  return 'queued';
end $$;

-- Hand out due notifications to one runner. Rows stuck "sending" for 10 minutes are picked up again.
create or replace function public.clinic_claim_notifications(p_limit integer, p_now timestamptz)
returns setof public.clinic_notifications language plpgsql set search_path = '' as $$
begin
  return query
  with due as (
    select id from public.clinic_notifications
    where scheduled_for <= p_now and (
      status = 'scheduled'
      or (status = 'failed' and attempts < 5 and claimed_at < p_now - interval '2 minutes')
      or (status = 'sending' and claimed_at < p_now - interval '10 minutes' and attempts < 5)
    )
    order by scheduled_for limit p_limit for update skip locked
  )
  update public.clinic_notifications n
    set status = 'sending', attempts = n.attempts + 1, claimed_at = p_now
    from due where n.id = due.id
    returning n.*;
end $$;

revoke all on function public.clinic_confirm_payment(text, text, text) from public, anon, authenticated;
revoke all on function public.clinic_expire_holds(timestamptz) from public, anon, authenticated;
revoke all on function public.clinic_enqueue_notification(jsonb) from public, anon, authenticated;
revoke all on function public.clinic_claim_notifications(integer, timestamptz) from public, anon, authenticated;

revoke all on public.clinic_settings, public.clinic_doctor_fees, public.clinic_payments, public.clinic_payment_events,
  public.clinic_refunds, public.clinic_notifications from anon, authenticated;
grant all on public.clinic_settings, public.clinic_doctor_fees, public.clinic_payments, public.clinic_payment_events,
  public.clinic_refunds, public.clinic_notifications to service_role;
grant execute on function public.clinic_confirm_payment(text, text, text), public.clinic_expire_holds(timestamptz),
  public.clinic_enqueue_notification(jsonb), public.clinic_claim_notifications(integer, timestamptz) to service_role;
