-- Doctors an admin has verified. Only verified doctors are listed for patients to book.
-- Doctors already on the system are treated as verified, so nobody drops out of the directory.
alter table public.clinic_users add column if not exists verified_at text;
update public.clinic_users set verified_at = coalesce(created_at, now()::text) where role = 'doctor' and verified_at is null;
