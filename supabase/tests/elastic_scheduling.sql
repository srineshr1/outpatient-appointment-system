-- Run against an isolated migrated test database, never production. Rolls all fixtures back.
begin;
create function pg_temp.expect_unavailable(statement text) returns void language plpgsql as $$
begin
  begin
    execute statement;
    raise exception 'Expected an unavailable placement: %', statement;
  exception when unique_violation then null;
  end;
end $$;

insert into public.clinic_consult_sessions
(id, doctor_id, label, weekdays, start_time, end_time, room, mode, slot_minutes, created_at, updated_at)
values ('elastic-sql', 'elastic-doctor', 'Elastic test', '1,2,3,4,5,6', '10:00', '12:00', 'Test', 'stream', 30, '', '');
insert into public.clinic_appointments
(id, reference, slot_id, doctor_id, date, time, end_time, reason_id, patient_name, status, created_at, session_id)
values ('elastic-booked', 'ELASTIC-1', 'elastic-doctor-2099-01-05-1130', 'elastic-doctor', '2099-01-05', '11:30', '12:00', 'new', 'Example', 'booked', '', 'elastic-sql');
create temporary table elastic_original as select * from public.clinic_appointments where id = 'elastic-booked';
update public.clinic_consult_sessions set end_time = '11:00' where id = 'elastic-sql';
do $$ begin
  if exists ((select * from elastic_original) except (select * from public.clinic_appointments where id = 'elastic-booked')) then
    raise exception 'Shrinking changed a booked appointment';
  end if;
end $$;
select pg_temp.expect_unavailable($q$insert into public.clinic_appointments
(id, reference, slot_id, doctor_id, date, time, end_time, reason_id, patient_name, status, created_at, session_id)
values ('elastic-stale', 'ELASTIC-2', 'elastic-doctor-2099-01-05-1100', 'elastic-doctor', '2099-01-05', '11:00', '11:30', 'new', 'Example', 'booked', '', 'elastic-sql')$q$);
update public.clinic_consult_sessions set start_time = '09:00', end_time = '12:00' where id = 'elastic-sql';
insert into public.clinic_appointments
(id, reference, slot_id, doctor_id, date, time, end_time, reason_id, patient_name, status, created_at, session_id)
values ('elastic-early', 'ELASTIC-3', 'elastic-doctor-2099-01-05-0900', 'elastic-doctor', '2099-01-05', '09:00', '09:30', 'new', 'Example', 'booked', '', 'elastic-sql');
update public.clinic_consult_sessions set start_time = '09:15', end_time = '12:15' where id = 'elastic-sql';
select pg_temp.expect_unavailable($q$insert into public.clinic_appointments
(id, reference, slot_id, doctor_id, date, time, end_time, reason_id, patient_name, status, created_at, session_id)
values ('elastic-overlap', 'ELASTIC-4', 'elastic-doctor-2099-01-05-1115', 'elastic-doctor', '2099-01-05', '11:15', '11:45', 'new', 'Example', 'booked', '', 'elastic-sql')$q$);

-- An existing payment hold may finish after the doctor has reduced the hours.
update public.clinic_consult_sessions set start_time = '10:00', end_time = '12:00' where id = 'elastic-sql';
insert into public.clinic_appointments
(id, reference, slot_id, doctor_id, date, time, end_time, reason_id, patient_name, status, created_at, session_id)
values ('elastic-hold', 'ELASTIC-5', 'elastic-doctor-2099-01-06-1130', 'elastic-doctor', '2099-01-06', '11:30', '12:00', 'new', 'Example', 'pending_payment', '', 'elastic-sql');
update public.clinic_consult_sessions set end_time = '11:00' where id = 'elastic-sql';
update public.clinic_appointments set status = 'booked' where id = 'elastic-hold';
do $$ begin
  if not exists (select 1 from public.clinic_appointments where id = 'elastic-hold' and status = 'booked' and time = '11:30' and end_time = '12:00') then
    raise exception 'Payment confirmation lost a protected hold';
  end if;
  begin
    update public.clinic_consult_sessions set slot_minutes = 15 where id = 'elastic-sql';
    raise exception 'Expected structural edit to be refused';
  exception when check_violation then null;
  end;
end $$;

insert into public.clinic_consult_sessions
(id, doctor_id, label, weekdays, start_time, end_time, room, mode, wave_capacity, created_at, updated_at)
values ('elastic-wave', 'elastic-wave-doctor', 'Wave', '1,2,3,4,5,6', '10:00', '12:00', 'Test', 'wave', 2, '', '');
insert into public.clinic_appointments
(id, reference, slot_id, doctor_id, date, time, end_time, reason_id, patient_name, status, created_at, session_id, token, wave_capacity)
values ('elastic-token1', 'ELASTIC-6', 'w-elastic-wave-2099-01-05-1000#1', 'elastic-wave-doctor', '2099-01-05', '10:00', '12:00', 'new', 'Example', 'booked', '', 'elastic-wave', 1, 2),
('elastic-token2', 'ELASTIC-7', 'w-elastic-wave-2099-01-05-1000#2', 'elastic-wave-doctor', '2099-01-05', '10:00', '12:00', 'new', 'Example', 'pending_payment', '', 'elastic-wave', 2, 2);
update public.clinic_consult_sessions set start_time = '09:00' where id = 'elastic-wave';
select pg_temp.expect_unavailable($q$insert into public.clinic_appointments
(id, reference, slot_id, doctor_id, date, time, end_time, reason_id, patient_name, status, created_at, session_id, token, wave_capacity)
values ('elastic-reset', 'ELASTIC-8', 'w-elastic-wave-2099-01-05-0900#1', 'elastic-wave-doctor', '2099-01-05', '09:00', '12:00', 'new', 'Example', 'booked', '', 'elastic-wave', 1, 2)$q$);
-- Preserve original token/time promises and allow payment completion.
update public.clinic_appointments set status = 'booked' where id = 'elastic-token2';
do $$ begin
  if (select count(*) from public.clinic_appointments where session_id = 'elastic-wave' and time = '10:00' and end_time = '12:00' and token in (1,2)) <> 2 then
    raise exception 'Wave reservations were changed';
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('clinic_guard_placement', 'clinic_lock_session_edit') and p.prosecdef) then
    raise exception 'Guard functions must not be SECURITY DEFINER';
  end if;
  if has_function_privilege('anon', 'public.clinic_guard_placement()', 'execute') or
     has_function_privilege('authenticated', 'public.clinic_lock_session_edit()', 'execute') then
    raise exception 'Public roles must not execute guard functions';
  end if;
end $$;
-- Simulate an older stream row without an end-time snapshot (before this trigger existed).
alter table public.clinic_appointments disable trigger clinic_placement_guard;
insert into public.clinic_appointments
(id, reference, slot_id, doctor_id, date, time, reason_id, patient_name, status, created_at, session_id)
values ('elastic-legacy', 'ELASTIC-9', 'elastic-doctor-2099-01-06-1000', 'elastic-doctor', '2099-01-06', '10:00', 'new', 'Example', 'booked', '', 'elastic-sql');
alter table public.clinic_appointments enable trigger clinic_placement_guard;
insert into public.clinic_appointments
(id, reference, slot_id, doctor_id, date, time, end_time, reason_id, patient_name, status, created_at, session_id)
values ('elastic-after-legacy', 'ELASTIC-10', 'elastic-doctor-2099-01-06-1030', 'elastic-doctor', '2099-01-06', '10:30', '11:00', 'new', 'Example', 'booked', '', 'elastic-sql');
rollback;
