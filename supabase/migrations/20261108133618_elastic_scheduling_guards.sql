-- Serialize reservations and session edits per doctor. No existing appointment is updated.
-- SECURITY INVOKER, empty search_path, server/service-role only; existing RLS stays intact.
create or replace function public.clinic_lock_session_edit()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.doctor_id, 731));
  if tg_op = 'UPDATE' and (
    row(new.mode, new.weekdays, new.on_date, new.start_date, new.end_date,
        new.slot_minutes, new.wave_minutes, new.wave_capacity, new.archived_at)
    is distinct from
    row(old.mode, old.weekdays, old.on_date, old.start_date, old.end_date,
        old.slot_minutes, old.wave_minutes, old.wave_capacity, old.archived_at)
  ) and exists (
    select 1 from public.clinic_appointments a where a.session_id = old.id
      and a.status in ('booked', 'pending_payment', 'completed')
      and a.date >= pg_catalog.to_char(current_timestamp at time zone 'Asia/Kolkata', 'YYYY-MM-DD')
  ) then
    raise exception 'Reserved sessions may change hours, name and room only' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists clinic_session_edit_lock on public.clinic_consult_sessions;
create trigger clinic_session_edit_lock before insert or update on public.clinic_consult_sessions
for each row execute function public.clinic_lock_session_edit();

create or replace function public.clinic_guard_placement()
returns trigger language plpgsql set search_path = '' as $$
declare
  s public.clinic_consult_sessions%rowtype;
  step integer;
  offset_minutes integer;
  expected_end text;
begin
  -- Payment completion/cancellation and metadata updates must not invalidate a preserved booking.
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
  end if;
  -- An unchanged wave may share its interval, but a shifted/resized wave cannot reset capacity.
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
  return new;
end $$;

drop trigger if exists clinic_placement_guard on public.clinic_appointments;
create trigger clinic_placement_guard before insert or update on public.clinic_appointments
for each row execute function public.clinic_guard_placement();

revoke all on function public.clinic_lock_session_edit(), public.clinic_guard_placement() from public, anon, authenticated;
grant execute on function public.clinic_lock_session_edit(), public.clinic_guard_placement() to service_role;
