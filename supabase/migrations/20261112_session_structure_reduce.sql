-- Let a doctor reduce a session's structure (fewer patients per wave, another slot length or wave
-- interval, stream/wave, days or dates) while it has reservations, as long as every remaining upcoming
-- reservation still fits the changed session. Reservations that would not fit are displaced first by
-- clinic_displace_and_save_session in the same transaction (the doctor confirms and the patients are
-- offered new times). Removing a session still needs no reservations left. Relaxes the earlier rule;
-- no data is changed. SECURITY INVOKER, empty search_path, service role only.
create or replace function public.clinic_lock_session_edit()
returns trigger language plpgsql set search_path = '' as $$
declare
  today text := pg_catalog.to_char(current_timestamp at time zone 'Asia/Kolkata', 'YYYY-MM-DD');
  step integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.doctor_id, 731));
  if tg_op <> 'UPDATE' then return new; end if;
  if new.archived_at is not null and old.archived_at is null then
    if exists (
      select 1 from public.clinic_appointments a where a.session_id = old.id
        and a.status in ('booked', 'pending_payment', 'completed') and a.date >= today
    ) then
      raise exception 'Reserved sessions may change hours, name and room only' using errcode = '23514';
    end if;
    return new;
  end if;
  if row(new.mode, new.weekdays, new.on_date, new.start_date, new.end_date,
         new.slot_minutes, new.wave_minutes, new.wave_capacity, new.archived_at)
     is not distinct from
     row(old.mode, old.weekdays, old.on_date, old.start_date, old.end_date,
         old.slot_minutes, old.wave_minutes, old.wave_capacity, old.archived_at) then
    return new;
  end if;
  step := case when new.mode = 'stream' then new.slot_minutes
    else coalesce(new.wave_minutes, extract(epoch from (new.end_time::time - new.start_time::time))::integer / 60) end;
  if exists (
    select 1 from public.clinic_appointments a where a.session_id = old.id
      and a.status in ('booked', 'pending_payment', 'completed') and a.date >= today
      and not (
        new.archived_at is null and coalesce(step, 0) > 0
        -- still runs on the visit's date
        and ((new.on_date is not null and new.on_date = a.date) or (new.on_date is null
          and extract(isodow from a.date::date)::text = any(string_to_array(new.weekdays, ','))
          and (new.start_date is null or a.date >= new.start_date)
          and (new.end_date is null or a.date <= new.end_date)))
        -- same start on the new grid, inside the hours, same length
        and extract(epoch from (a.time::time - new.start_time::time))::integer / 60 >= 0
        and (extract(epoch from (a.time::time - new.start_time::time))::integer / 60) % step = 0
        and pg_catalog.to_char(a.time::time + step * interval '1 minute', 'HH24:MI') <= new.end_time
        and (a.end_time is null or a.end_time = pg_catalog.to_char(a.time::time + step * interval '1 minute', 'HH24:MI'))
        -- same kind of place, and a wave still has room for the token
        and ((new.mode = 'stream' and a.token is null
              and a.slot_id = a.doctor_id || '-' || a.date || '-' || replace(a.time, ':', ''))
          or (new.mode = 'wave' and a.token is not null and a.token >= 1 and a.token <= new.wave_capacity
              and split_part(a.slot_id, '#', 1) = 'w-' || new.id || '-' || a.date || '-' || replace(a.time, ':', '')))
      )
  ) then
    raise exception 'Reserved sessions may change hours, name and room only' using errcode = '23514';
  end if;
  return new;
end $$;

revoke all on function public.clinic_lock_session_edit() from public, anon, authenticated;
grant execute on function public.clinic_lock_session_edit() to service_role;
