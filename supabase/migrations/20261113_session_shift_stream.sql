-- When a session grows into the start of a neighbouring stream on the same day, the stream starts
-- later and the booked patients in the part it gives up move, in order, to its earliest free later
-- slots. One call saves the session and its free-edge cuts, moves each visit through
-- clinic_reschedule (placement guard + history line) and then checks that nothing holding a place is
-- left inside a cut part. All or nothing: returns 'ok', 'stale' (a visit changed since it was read, or
-- the cut would still reach a reservation) or 'taken' (a target slot was reserved or held meanwhile).
-- Additive: a new function only; no table or existing function changes, no data is changed.
-- SECURITY INVOKER, empty search_path, service role only.
create or replace function public.clinic_shift_and_save_session(p_session jsonb, p_trims jsonb, p_moves jsonb)
returns text language plpgsql set search_path = '' as $$
declare
  row_doctor text := p_session->>'doctor_id';
  item jsonb;
  outcome text;
begin
  begin
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(row_doctor, 731));
    perform public.clinic_save_session(p_session, p_trims);
    for item in select value from jsonb_array_elements(coalesce(p_moves, '[]'::jsonb)) loop
      if not exists (
        select 1 from public.clinic_appointments a
        where a.id = item->>'appointment_id' and a.doctor_id = row_doctor
      ) then
        raise exception 'stale' using errcode = 'P0001';
      end if;
      outcome := public.clinic_reschedule(item->>'appointment_id', item->>'from_slot_id', item->'to', item->'history');
      if outcome <> 'ok' then raise exception '%', outcome using errcode = 'P0001'; end if;
    end loop;
    if exists (
      select 1
      from jsonb_array_elements(coalesce(p_trims, '[]'::jsonb)) as cut
      join public.clinic_appointments a
        on a.session_id = cut->>'session_id' and a.date = cut->>'on_date' and a.doctor_id = row_doctor
      where a.status in ('booked', 'pending_payment', 'completed')
        and a.time < cut->>'end_time'
        and coalesce(a.end_time, '23:59') > cut->>'start_time'
    ) then
      raise exception 'stale' using errcode = 'P0001';
    end if;
  exception
    when unique_violation then return 'taken';
    when raise_exception then
      if sqlerrm in ('stale', 'taken') then return sqlerrm; end if;
      raise;
  end;
  return 'ok';
end $$;

revoke all on function public.clinic_shift_and_save_session(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.clinic_shift_and_save_session(jsonb, jsonb, jsonb) to service_role;
