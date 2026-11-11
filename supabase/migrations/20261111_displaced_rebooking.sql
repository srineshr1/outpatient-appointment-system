-- Displaced patient rebooking. A doctor may explicitly confirm a session change that removes reserved
-- hours: the visits become 'displaced' (never deleted, original time kept), and each booked patient is
-- offered other times that are held for them. Additive only: no existing appointment row is changed by
-- this migration. Server only: RLS on, no policies, service role only, SECURITY INVOKER functions with
-- an empty search_path, the same as the earlier clinic migrations.

-- 1. A visit can be displaced. The time it had stays on the row.
alter table public.clinic_appointments drop constraint if exists clinic_appointments_status_check;
alter table public.clinic_appointments
  add constraint clinic_appointments_status_check
  check (status in ('booked', 'completed', 'cancelled', 'pending_payment', 'expired', 'displaced'));
alter table public.clinic_appointments add column if not exists displaced_at text;
alter table public.clinic_appointments add column if not exists displaced_reason text;

-- 2. Offers. Only the SHA-256 of the patient's link token is kept.
create table if not exists public.clinic_rebooking_offers (
  id text primary key,
  appointment_id text not null references public.clinic_appointments (id),
  doctor_id text not null,
  token_hash text not null unique,
  status text not null check (status in ('pending', 'accepted', 'expired', 'cancelled')),
  reason text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  closed_at timestamptz,
  chosen_slot_id text
);
create unique index if not exists clinic_rebooking_offers_one_pending
  on public.clinic_rebooking_offers (appointment_id) where status = 'pending';
create index if not exists clinic_rebooking_offers_by_doctor on public.clinic_rebooking_offers (doctor_id, created_at desc);
create index if not exists clinic_rebooking_offers_due on public.clinic_rebooking_offers (expires_at) where status = 'pending';

-- 3. Places held for an offer. They count as reserved for every placement check until the offer closes.
create table if not exists public.clinic_rebooking_holds (
  offer_id text not null references public.clinic_rebooking_offers (id) on delete cascade,
  appointment_id text not null,
  doctor_id text not null,
  slot_id text not null unique,
  date text not null,
  time text not null,
  end_time text,
  session_id text,
  token integer,
  wave_capacity integer,
  position integer not null default 0,
  primary key (offer_id, slot_id)
);
create index if not exists clinic_rebooking_holds_by_doctor on public.clinic_rebooking_holds (doctor_id, date);

alter table public.clinic_rebooking_offers enable row level security;
alter table public.clinic_rebooking_holds enable row level security;
revoke all on public.clinic_rebooking_offers, public.clinic_rebooking_holds from anon, authenticated;
grant all on public.clinic_rebooking_offers, public.clinic_rebooking_holds to service_role;

-- 4. A held place may not overlap a reservation or another held place (same rules as a booking).
create or replace function public.clinic_guard_rebooking_hold()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.doctor_id, 731));
  if exists (
    select 1 from public.clinic_appointments a
    where a.doctor_id = new.doctor_id and a.date = new.date
      and a.status in ('booked', 'pending_payment', 'completed')
      and (a.slot_id = new.slot_id or (
        new.time < coalesce(a.end_time, (
          select pg_catalog.to_char(a.time::time + (case when legacy.mode = 'stream' then legacy.slot_minutes else legacy.wave_minutes end) * interval '1 minute', 'HH24:MI')
          from public.clinic_consult_sessions legacy where legacy.id = a.session_id and legacy.doctor_id = a.doctor_id
        ), '23:59') and a.time < coalesce(new.end_time, '23:59')
        and not (new.token is not null and a.token is not null
          and split_part(a.slot_id, '#', 1) = split_part(new.slot_id, '#', 1)
          and a.time = new.time and a.end_time = new.end_time)
      ))
  ) or exists (
    select 1 from public.clinic_rebooking_holds h
    where h.doctor_id = new.doctor_id and h.date = new.date
      and not (h.offer_id = new.offer_id and h.slot_id = new.slot_id)
      and (h.slot_id = new.slot_id or (
        new.time < coalesce(h.end_time, '23:59') and h.time < coalesce(new.end_time, '23:59')
        and not (new.token is not null and h.token is not null
          and split_part(h.slot_id, '#', 1) = split_part(new.slot_id, '#', 1)
          and h.time = new.time and h.end_time = new.end_time)
      ))
  ) then
    raise exception 'Time overlaps a protected reservation' using errcode = '23505';
  end if;
  return new;
end $$;

drop trigger if exists clinic_rebooking_hold_guard on public.clinic_rebooking_holds;
create trigger clinic_rebooking_hold_guard before insert or update on public.clinic_rebooking_holds
for each row execute function public.clinic_guard_rebooking_hold();

-- 5. The placement guard, as in 20261110_session_trims.sql, plus: held rebooking places are reserved.
create or replace function public.clinic_guard_placement()
returns trigger language plpgsql set search_path = '' as $$
declare
  s public.clinic_consult_sessions%rowtype;
  step integer;
  offset_minutes integer;
  expected_end text;
begin
  if tg_op = 'UPDATE' then
    if row(new.doctor_id, new.slot_id, new.date, new.time, new.end_time, new.session_id, new.token, new.wave_capacity)
       is not distinct from
       row(old.doctor_id, old.slot_id, old.date, old.time, old.end_time, old.session_id, old.token, old.wave_capacity)
       and old.status in ('booked', 'pending_payment', 'completed') then
      return new;
    end if;
  end if;
  if new.status not in ('booked', 'pending_payment', 'completed') then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.doctor_id, 731));
  if new.session_id is not null then
    select * into s from public.clinic_consult_sessions where id = new.session_id;
    if not found or s.doctor_id <> new.doctor_id or s.archived_at is not null then
      raise exception 'Session is no longer available' using errcode = '23505';
    end if;
    if (s.on_date is not null and s.on_date <> new.date) or
       (s.on_date is null and (
          not (extract(isodow from new.date::date)::text = any(string_to_array(s.weekdays, ','))) or
          (s.start_date is not null and new.date < s.start_date) or
          (s.end_date is not null and new.date > s.end_date) or exists (
            select 1 from public.clinic_consult_sessions other where other.doctor_id = new.doctor_id
              and other.archived_at is null and other.on_date = new.date
          )
       )) then
      raise exception 'Session no longer runs on this date' using errcode = '23505';
    end if;
    step := case when s.mode = 'stream' then s.slot_minutes
      else coalesce(s.wave_minutes, extract(epoch from (s.end_time::time - s.start_time::time))::integer / 60) end;
    offset_minutes := extract(epoch from (new.time::time - s.start_time::time))::integer / 60;
    expected_end := pg_catalog.to_char(new.time::time + step * interval '1 minute', 'HH24:MI');
    if step <= 0 or offset_minutes < 0 or offset_minutes % step <> 0 or
       offset_minutes + step > extract(epoch from (s.end_time::time - s.start_time::time))::integer / 60 or
       expected_end > s.end_time or new.end_time is distinct from expected_end or
       (s.mode = 'stream' and (new.token is not null or new.slot_id <> new.doctor_id || '-' || new.date || '-' || replace(new.time, ':', ''))) or
       (s.mode = 'wave' and (new.token is null or new.token < 1 or new.token > s.wave_capacity or
         new.wave_capacity is distinct from s.wave_capacity or new.slot_id <>
           'w-' || s.id || '-' || new.date || '-' || replace(new.time, ':', '') || '#' || new.token::text)) then
      raise exception 'Placement changed while booking; refresh availability' using errcode = '23505';
    end if;
    if exists (
      select 1 from public.clinic_session_trims t
      join public.clinic_consult_sessions absorber on absorber.id = t.absorbed_by
      where t.session_id = new.session_id
        and absorber.archived_at is null
        and absorber.doctor_id = new.doctor_id
        and new.time < t.end_time
        and t.start_time < coalesce(new.end_time, '23:59')
        and absorber.start_time <= t.start_time
        and absorber.end_time >= t.end_time
        and (
          (absorber.on_date is not null and absorber.on_date = new.date)
          or (
            absorber.on_date is null
            and extract(isodow from new.date::date)::text = any(string_to_array(absorber.weekdays, ','))
            and (absorber.start_date is null or new.date >= absorber.start_date)
            and (absorber.end_date is null or new.date <= absorber.end_date)
            and not exists (
              select 1 from public.clinic_consult_sessions oneoff
              where oneoff.doctor_id = absorber.doctor_id
                and oneoff.archived_at is null
                and oneoff.on_date = new.date
            )
          )
        )
    ) then
      raise exception 'That time was lent to another session' using errcode = '23505';
    end if;
  end if;
  if exists (
    select 1 from public.clinic_appointments a
    where a.id <> new.id and a.doctor_id = new.doctor_id and a.date = new.date
      and a.status in ('booked', 'pending_payment', 'completed')
      and (a.slot_id = new.slot_id or (
        new.time < coalesce(a.end_time, (
          select pg_catalog.to_char(a.time::time + (case when legacy.mode = 'stream' then legacy.slot_minutes else legacy.wave_minutes end) * interval '1 minute', 'HH24:MI')
          from public.clinic_consult_sessions legacy where legacy.id = a.session_id
            and legacy.doctor_id = a.doctor_id
        ), '23:59') and a.time < coalesce(new.end_time, '23:59')
        and not (new.token is not null and a.token is not null
          and split_part(a.slot_id, '#', 1) = split_part(new.slot_id, '#', 1)
          and a.time = new.time and a.end_time = new.end_time)
      ))
  ) then
    raise exception 'Time overlaps a protected reservation' using errcode = '23505';
  end if;
  -- Places held for displaced patients. A visit accepting its own offer has had its holds released first.
  if exists (
    select 1 from public.clinic_rebooking_holds h
    where h.doctor_id = new.doctor_id and h.date = new.date and h.appointment_id <> new.id
      and (h.slot_id = new.slot_id or (
        new.time < coalesce(h.end_time, '23:59') and h.time < coalesce(new.end_time, '23:59')
        and not (new.token is not null and h.token is not null
          and split_part(h.slot_id, '#', 1) = split_part(new.slot_id, '#', 1)
          and h.time = new.time and h.end_time = new.end_time)
      ))
  ) then
    raise exception 'Time is held for a displaced patient' using errcode = '23505';
  end if;
  return new;
end $$;

-- 6. Displace, save the session and hold the offered places, in one transaction.
-- Returns 'ok', 'stale' (a listed visit changed since it was read) or 'taken' (an offered place is
-- no longer free). On anything but 'ok' nothing is written.
create or replace function public.clinic_displace_and_save_session(p_session jsonb, p_trims jsonb, p_displaced jsonb)
returns text language plpgsql set search_path = '' as $$
declare
  row_doctor text := p_session->>'doctor_id';
  item jsonb;
  slot jsonb;
  changed integer;
  slot_position integer;
begin
  begin
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(row_doctor, 731));
    for item in select value from jsonb_array_elements(coalesce(p_displaced, '[]'::jsonb)) loop
      update public.clinic_appointments set
        status = 'displaced',
        displaced_at = item->>'at',
        displaced_reason = coalesce(item->>'reason', '')
      where id = item->>'appointment_id' and doctor_id = row_doctor
        and status = item->>'from_status' and status in ('booked', 'pending_payment')
        and slot_id = item->>'from_slot_id';
      get diagnostics changed = row_count;
      if changed = 0 then raise exception 'stale' using errcode = 'P0001'; end if;
    end loop;
    perform public.clinic_save_session(p_session, p_trims);
    for item in select value from jsonb_array_elements(coalesce(p_displaced, '[]'::jsonb)) loop
      if item->'offer' is null or jsonb_typeof(item->'offer') = 'null' then continue; end if;
      insert into public.clinic_rebooking_offers (id, appointment_id, doctor_id, token_hash, status, reason, created_at, expires_at)
      values (item->'offer'->>'id', item->>'appointment_id', row_doctor, item->'offer'->>'token_hash', 'pending',
        coalesce(item->'offer'->>'reason', ''), (item->'offer'->>'created_at')::timestamptz, (item->'offer'->>'expires_at')::timestamptz);
      slot_position := 0;
      for slot in select value from jsonb_array_elements(coalesce(item->'offer'->'slots', '[]'::jsonb)) loop
        insert into public.clinic_rebooking_holds
          (offer_id, appointment_id, doctor_id, slot_id, date, time, end_time, session_id, token, wave_capacity, position)
        values (item->'offer'->>'id', item->>'appointment_id', row_doctor, slot->>'slot_id', slot->>'date', slot->>'time',
          slot->>'end_time', slot->>'session_id', (slot->>'token')::integer, (slot->>'wave_capacity')::integer, slot_position);
        slot_position := slot_position + 1;
      end loop;
    end loop;
  exception
    when unique_violation then return 'taken';
    when raise_exception then
      if sqlerrm = 'stale' then return 'stale'; end if;
      raise;
  end;
  return 'ok';
end $$;

-- 7. Accept: release the offer's holds, move the visit, book it, write history, close the offer.
-- Returns 'ok', 'stale', 'expired' or 'taken'. The placement guard checks the new time.
create or replace function public.clinic_accept_rebooking(p_offer_id text, p_to jsonb, p_history jsonb, p_at timestamptz)
returns text language plpgsql set search_path = '' as $$
declare
  offer public.clinic_rebooking_offers%rowtype;
  visit public.clinic_appointments%rowtype;
begin
  select * into offer from public.clinic_rebooking_offers where id = p_offer_id for update;
  if not found or offer.status <> 'pending' then return 'stale'; end if;
  select * into visit from public.clinic_appointments where id = offer.appointment_id for update;
  if not found or visit.status <> 'displaced' or visit.doctor_id <> offer.doctor_id then return 'stale'; end if;
  if offer.expires_at <= p_at then return 'expired'; end if;
  begin
    delete from public.clinic_rebooking_holds where offer_id = offer.id;
    update public.clinic_appointments set
      slot_id = p_to->>'slot_id',
      date = p_to->>'date',
      time = p_to->>'time',
      end_time = p_to->>'end_time',
      session_id = p_to->>'session_id',
      token = (p_to->>'token')::int,
      wave_capacity = (p_to->>'wave_capacity')::int,
      status = 'booked'
    where id = visit.id and status = 'displaced';
  exception when unique_violation then
    return 'taken';
  end;
  insert into public.clinic_reschedules
    (id, appointment_id, reference, doctor_id, patient_user_id, by_user_id, by_name, by_role,
     from_slot_id, from_date, from_time, from_token, to_slot_id, to_date, to_time, to_token, reason, at)
  values (
    p_history->>'id', visit.id, p_history->>'reference', p_history->>'doctor_id', p_history->>'patient_user_id',
    p_history->>'by_user_id', coalesce(p_history->>'by_name', ''), coalesce(p_history->>'by_role', ''),
    p_history->>'from_slot_id', p_history->>'from_date', p_history->>'from_time', (p_history->>'from_token')::int,
    p_history->>'to_slot_id', p_history->>'to_date', p_history->>'to_time', (p_history->>'to_token')::int,
    coalesce(p_history->>'reason', ''), p_history->>'at'
  );
  update public.clinic_rebooking_offers set status = 'accepted', closed_at = p_at, chosen_slot_id = p_to->>'slot_id'
    where id = offer.id;
  return 'ok';
end $$;

-- 8. Close a pending offer (patient cancelled, or it expired): release holds, cancel the displaced visit.
-- Returns 'ok' once; 'stale' when the offer was already closed. The caller refunds.
create or replace function public.clinic_close_rebooking(p_offer_id text, p_status text, p_at timestamptz)
returns text language plpgsql set search_path = '' as $$
declare offer public.clinic_rebooking_offers%rowtype;
begin
  if p_status not in ('cancelled', 'expired') then raise exception 'Unknown offer status' using errcode = '22023'; end if;
  select * into offer from public.clinic_rebooking_offers where id = p_offer_id for update;
  if not found or offer.status <> 'pending' then return 'stale'; end if;
  delete from public.clinic_rebooking_holds where offer_id = offer.id;
  update public.clinic_appointments set status = 'cancelled' where id = offer.appointment_id and status = 'displaced';
  update public.clinic_rebooking_offers set status = p_status, closed_at = p_at where id = offer.id;
  return 'ok';
end $$;

revoke all on function public.clinic_guard_rebooking_hold(), public.clinic_guard_placement(),
  public.clinic_displace_and_save_session(jsonb, jsonb, jsonb),
  public.clinic_accept_rebooking(text, jsonb, jsonb, timestamptz),
  public.clinic_close_rebooking(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.clinic_guard_rebooking_hold(), public.clinic_guard_placement(),
  public.clinic_displace_and_save_session(jsonb, jsonb, jsonb),
  public.clinic_accept_rebooking(text, jsonb, jsonb, timestamptz),
  public.clinic_close_rebooking(text, text, timestamptz) to service_role;
