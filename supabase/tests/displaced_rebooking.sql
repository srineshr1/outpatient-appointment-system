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
create function pg_temp.session(p_end text) returns jsonb language sql as $$
  select jsonb_build_object('id', 'rebook-sql', 'doctor_id', 'rebook-doctor', 'label', 'Rebook test', 'weekdays', '1,2,3,4,5,6',
    'start_time', '10:00', 'end_time', p_end, 'room', 'Test', 'mode', 'stream', 'slot_minutes', 30, 'created_at', '', 'updated_at', '')
$$;
create function pg_temp.slot(p_date text, p_time text, p_end text) returns jsonb language sql as $$
  select jsonb_build_object('slot_id', 'rebook-doctor-' || p_date || '-' || replace(p_time, ':', ''), 'date', p_date, 'time', p_time,
    'end_time', p_end, 'session_id', 'rebook-sql', 'token', null, 'wave_capacity', null)
$$;
create function pg_temp.history(p_id text, p_to jsonb) returns jsonb language sql as $$
  select jsonb_build_object('id', p_id, 'reference', 'REBOOK-1', 'doctor_id', 'rebook-doctor', 'patient_user_id', 'patient',
    'by_user_id', 'patient', 'by_name', 'Example', 'by_role', 'patient', 'from_slot_id', 'rebook-doctor-2099-01-05-1130',
    'from_date', '2099-01-05', 'from_time', '11:30', 'from_token', null, 'to_slot_id', p_to->>'slot_id',
    'to_date', p_to->>'date', 'to_time', p_to->>'time', 'to_token', null, 'reason', 'Rebooked', 'at', '2099-01-01T00:00:00Z')
$$;

insert into public.clinic_consult_sessions
(id, doctor_id, label, weekdays, start_time, end_time, room, mode, slot_minutes, created_at, updated_at)
values ('rebook-sql', 'rebook-doctor', 'Rebook test', '1,2,3,4,5,6', '10:00', '12:00', 'Test', 'stream', 30, '', '');
insert into public.clinic_appointments
(id, reference, slot_id, doctor_id, date, time, end_time, reason_id, patient_name, status, created_at, session_id) values
('rebook-a', 'REBOOK-1', 'rebook-doctor-2099-01-05-1130', 'rebook-doctor', '2099-01-05', '11:30', '12:00', 'new', 'Example', 'booked', '', 'rebook-sql'),
('rebook-h', 'REBOOK-2', 'rebook-doctor-2099-01-06-1130', 'rebook-doctor', '2099-01-06', '11:30', '12:00', 'new', 'Example', 'pending_payment', '', 'rebook-sql'),
('rebook-b', 'REBOOK-3', 'rebook-doctor-2099-01-07-1030', 'rebook-doctor', '2099-01-07', '10:30', '11:00', 'new', 'Example', 'booked', '', 'rebook-sql');
create temporary table rebook_original as select * from public.clinic_appointments where id like 'rebook-%';

-- A stale read changes nothing at all.
do $$ begin
  if public.clinic_displace_and_save_session(pg_temp.session('11:00'), '[]', jsonb_build_array(jsonb_build_object(
    'appointment_id', 'rebook-a', 'from_status', 'pending_payment', 'from_slot_id', 'rebook-doctor-2099-01-05-1130',
    'reason', 'Hours changed', 'at', '2099-01-01T00:00:00Z', 'offer', null))) <> 'stale' then
    raise exception 'Expected a stale displacement';
  end if;
  if exists ((select * from rebook_original) except (select * from public.clinic_appointments where id like 'rebook-%'))
     or (select end_time from public.clinic_consult_sessions where id = 'rebook-sql') <> '12:00' then
    raise exception 'A stale displacement changed data';
  end if;
end $$;

-- Confirmed displacement: visits keep their time, the booked one gets two held places, the hold none.
do $$ begin
  if public.clinic_displace_and_save_session(pg_temp.session('11:00'), '[]', jsonb_build_array(
    jsonb_build_object('appointment_id', 'rebook-a', 'from_status', 'booked', 'from_slot_id', 'rebook-doctor-2099-01-05-1130',
      'reason', 'Hours changed', 'at', '2099-01-01T00:00:00Z', 'offer', jsonb_build_object('id', 'offer-a', 'token_hash', 'hash-a',
        'reason', 'Hours changed', 'created_at', '2099-01-01T00:00:00Z', 'expires_at', '2099-01-02T00:00:00Z',
        'slots', jsonb_build_array(pg_temp.slot('2099-01-05', '10:00', '10:30'), pg_temp.slot('2099-01-05', '10:30', '11:00')))),
    jsonb_build_object('appointment_id', 'rebook-h', 'from_status', 'pending_payment', 'from_slot_id', 'rebook-doctor-2099-01-06-1130',
      'reason', 'Hours changed', 'at', '2099-01-01T00:00:00Z', 'offer', null))) <> 'ok' then
    raise exception 'Expected the displacement to succeed';
  end if;
  if (select end_time from public.clinic_consult_sessions where id = 'rebook-sql') <> '11:00' then raise exception 'Session not saved'; end if;
  if (select count(*) from public.clinic_appointments where id in ('rebook-a', 'rebook-h') and status = 'displaced'
      and time = '11:30' and displaced_at is not null and displaced_reason = 'Hours changed') <> 2 then
    raise exception 'Displaced visits lost their original time or reason';
  end if;
  if (select count(*) from public.clinic_rebooking_holds where offer_id = 'offer-a') <> 2
     or exists (select 1 from public.clinic_rebooking_offers where appointment_id = 'rebook-h') then
    raise exception 'Offer holds are wrong';
  end if;
end $$;

-- Held places are reserved for everyone else.
select pg_temp.expect_unavailable($q$insert into public.clinic_appointments
(id, reference, slot_id, doctor_id, date, time, end_time, reason_id, patient_name, status, created_at, session_id)
values ('rebook-thief', 'REBOOK-9', 'rebook-doctor-2099-01-05-1000', 'rebook-doctor', '2099-01-05', '10:00', '10:30', 'new', 'Example', 'booked', '', 'rebook-sql')$q$);

-- Offering a place another offer holds is refused and rolls everything back.
do $$ begin
  if public.clinic_displace_and_save_session(pg_temp.session('10:30'), '[]', jsonb_build_array(
    jsonb_build_object('appointment_id', 'rebook-b', 'from_status', 'booked', 'from_slot_id', 'rebook-doctor-2099-01-07-1030',
      'reason', 'Hours changed', 'at', '2099-01-01T00:00:00Z', 'offer', jsonb_build_object('id', 'offer-b', 'token_hash', 'hash-b',
        'reason', 'Hours changed', 'created_at', '2099-01-01T00:00:00Z', 'expires_at', '2000-01-02T00:00:00Z',
        'slots', jsonb_build_array(pg_temp.slot('2099-01-05', '10:00', '10:30')))))) <> 'taken' then
    raise exception 'Expected a taken offer';
  end if;
  if (select status from public.clinic_appointments where id = 'rebook-b') <> 'booked'
     or (select end_time from public.clinic_consult_sessions where id = 'rebook-sql') <> '11:00'
     or exists (select 1 from public.clinic_rebooking_offers where id = 'offer-b') then
    raise exception 'A taken displacement changed data';
  end if;
end $$;

-- Accept: the visit moves into its own held place, the other hold is released, history is written.
do $$ begin
  if public.clinic_accept_rebooking('offer-a', pg_temp.slot('2099-01-05', '10:00', '10:30'),
      pg_temp.history('rebook-move', pg_temp.slot('2099-01-05', '10:00', '10:30')), '2099-01-01T01:00:00Z') <> 'ok' then
    raise exception 'Expected the offer to be accepted';
  end if;
  if not exists (select 1 from public.clinic_appointments where id = 'rebook-a' and status = 'booked' and time = '10:00'
      and slot_id = 'rebook-doctor-2099-01-05-1000' and reference = 'REBOOK-1' and displaced_at is not null)
     or exists (select 1 from public.clinic_rebooking_holds where offer_id = 'offer-a')
     or (select status from public.clinic_rebooking_offers where id = 'offer-a') <> 'accepted'
     or not exists (select 1 from public.clinic_reschedules where id = 'rebook-move') then
    raise exception 'Accepting did not move the visit atomically';
  end if;
  if public.clinic_accept_rebooking('offer-a', pg_temp.slot('2099-01-05', '10:30', '11:00'),
      pg_temp.history('rebook-move-2', pg_temp.slot('2099-01-05', '10:30', '11:00')), '2099-01-01T01:00:00Z') <> 'stale' then
    raise exception 'An offer was accepted twice';
  end if;
end $$;
insert into public.clinic_appointments
(id, reference, slot_id, doctor_id, date, time, end_time, reason_id, patient_name, status, created_at, session_id)
values ('rebook-released', 'REBOOK-8', 'rebook-doctor-2099-01-05-1030', 'rebook-doctor', '2099-01-05', '10:30', '11:00', 'new', 'Example', 'booked', '', 'rebook-sql');

-- Expiry: an expired offer cannot be accepted; closing it cancels the visit once and frees its holds.
do $$ begin
  if public.clinic_displace_and_save_session(pg_temp.session('10:30'), '[]', jsonb_build_array(
    jsonb_build_object('appointment_id', 'rebook-b', 'from_status', 'booked', 'from_slot_id', 'rebook-doctor-2099-01-07-1030',
      'reason', 'Hours changed', 'at', '2099-01-01T00:00:00Z', 'offer', jsonb_build_object('id', 'offer-b', 'token_hash', 'hash-b',
        'reason', 'Hours changed', 'created_at', '2099-01-01T00:00:00Z', 'expires_at', '2000-01-02T00:00:00Z',
        'slots', jsonb_build_array(pg_temp.slot('2099-01-07', '10:00', '10:30')))))) <> 'ok' then
    raise exception 'Expected the second displacement to succeed';
  end if;
  if public.clinic_accept_rebooking('offer-b', pg_temp.slot('2099-01-07', '10:00', '10:30'),
      pg_temp.history('rebook-late', pg_temp.slot('2099-01-07', '10:00', '10:30')), '2099-01-01T01:00:00Z') <> 'expired' then
    raise exception 'Expected an expired offer';
  end if;
  if public.clinic_close_rebooking('offer-b', 'expired', '2099-01-01T01:00:00Z') <> 'ok'
     or public.clinic_close_rebooking('offer-b', 'expired', '2099-01-01T01:00:00Z') <> 'stale' then
    raise exception 'Closing is not idempotent';
  end if;
  if (select status from public.clinic_appointments where id = 'rebook-b') <> 'cancelled'
     or (select time from public.clinic_appointments where id = 'rebook-b') <> '10:30'
     or exists (select 1 from public.clinic_rebooking_holds where offer_id = 'offer-b')
     or (select status from public.clinic_rebooking_offers where id = 'offer-b') <> 'expired' then
    raise exception 'Closing an offer left holds or the visit open';
  end if;
end $$;

-- Server only.
do $$ begin
  if has_function_privilege('anon', 'public.clinic_accept_rebooking(text, jsonb, jsonb, timestamptz)', 'execute')
     or has_function_privilege('authenticated', 'public.clinic_displace_and_save_session(jsonb, jsonb, jsonb)', 'execute')
     or has_function_privilege('anon', 'public.clinic_close_rebooking(text, text, timestamptz)', 'execute')
     or has_table_privilege('anon', 'public.clinic_rebooking_offers', 'select')
     or has_table_privilege('authenticated', 'public.clinic_rebooking_holds', 'select')
     or not (select relrowsecurity from pg_class where oid = 'public.clinic_rebooking_offers'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.clinic_rebooking_holds'::regclass) then
    raise exception 'Rebooking objects are reachable by public roles';
  end if;
end $$;
rollback;
