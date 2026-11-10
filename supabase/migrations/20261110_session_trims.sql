-- Free-edge cuts. A session can lend empty minutes to the session that grows into it.
-- No appointment row is updated or deleted. Booked visits keep their original times.

create table if not exists public.clinic_session_trims (
  doctor_id text not null,
  session_id text not null,
  on_date text not null,
  start_time text not null,
  end_time text not null,
  absorbed_by text not null,
  primary key (session_id, on_date, start_time, absorbed_by),
  constraint clinic_session_trims_times check (start_time < end_time)
);
create index if not exists clinic_session_trims_by_doctor on public.clinic_session_trims (doctor_id);
create index if not exists clinic_session_trims_by_absorbed on public.clinic_session_trims (absorbed_by);

alter table public.clinic_session_trims enable row level security;
revoke all on public.clinic_session_trims from anon, authenticated;
grant all on public.clinic_session_trims to service_role;

-- One write for the session row and the cuts it owns. The session-edit trigger still applies.
create or replace function public.clinic_save_session(p_session jsonb, p_trims jsonb)
returns void language plpgsql set search_path = '' as $$
declare
  row_doctor text := p_session->>'doctor_id';
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(row_doctor, 731));
  insert into public.clinic_consult_sessions (
    id, doctor_id, label, weekdays, start_time, end_time, room, mode,
    slot_minutes, wave_minutes, wave_capacity, start_date, end_date, on_date,
    archived_at, created_at, updated_at
  ) values (
    p_session->>'id', row_doctor, coalesce(p_session->>'label', ''), coalesce(p_session->>'weekdays', ''),
    p_session->>'start_time', p_session->>'end_time', coalesce(p_session->>'room', ''), p_session->>'mode',
    (p_session->>'slot_minutes')::integer, (p_session->>'wave_minutes')::integer, (p_session->>'wave_capacity')::integer,
    p_session->>'start_date', p_session->>'end_date', p_session->>'on_date', p_session->>'archived_at',
    coalesce(p_session->>'created_at', ''), coalesce(p_session->>'updated_at', '')
  )
  on conflict (id) do update set
    label = excluded.label, weekdays = excluded.weekdays, start_time = excluded.start_time,
    end_time = excluded.end_time, room = excluded.room, mode = excluded.mode,
    slot_minutes = excluded.slot_minutes, wave_minutes = excluded.wave_minutes,
    wave_capacity = excluded.wave_capacity, start_date = excluded.start_date,
    end_date = excluded.end_date, on_date = excluded.on_date, archived_at = excluded.archived_at,
    updated_at = excluded.updated_at;
  delete from public.clinic_session_trims where absorbed_by = p_session->>'id';
  insert into public.clinic_session_trims (doctor_id, session_id, on_date, start_time, end_time, absorbed_by)
  select row_doctor, cut->>'session_id', cut->>'on_date', cut->>'start_time', cut->>'end_time', p_session->>'id'
  from jsonb_array_elements(coalesce(p_trims, '[]'::jsonb)) as cut;
end $$;

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
    -- A lent edge stays with the session that absorbed it, including later dates of the same cut.
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
  return new;
end $$;

revoke all on function public.clinic_save_session(jsonb, jsonb), public.clinic_guard_placement() from public, anon, authenticated;
grant execute on function public.clinic_save_session(jsonb, jsonb), public.clinic_guard_placement() to service_role;
