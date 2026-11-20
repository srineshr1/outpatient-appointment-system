-- Fictional one-click demo reception account for the sign-in page.
-- Additive and idempotent: inserts only when this id and email are both unused.
-- Leaves every other account alone, including any live reception logins.

insert into public.clinic_users (
  id,
  email,
  password_hash,
  name,
  role,
  doctor_id,
  mobile,
  dob,
  created_at
)
select
  'user-demo-reception',
  'demo.reception@halden.example',
  'scrypt2$32768$8$3$u6eTfBs0u6z8RWykTltJvg$dO1LMxRbA0rnzBZdL9n1vi9g2j-OVk5B6RJBRmUW4Gg',
  'Demo Reception',
  'reception',
  null,
  '',
  '',
  '2026-11-20T00:00:00.000Z'
where not exists (
  select 1
  from public.clinic_users
  where id = 'user-demo-reception'
     or lower(email) = 'demo.reception@halden.example'
);
