-- The in-app inbox behind the bell in the header. One row per person per event; the id doubles as
-- the dedupe key, so queueing the same visit change twice adds it once. Only the server reads it.
create table if not exists public.clinic_inbox (
  id text primary key,
  user_id text not null,
  kind text not null,
  title text not null,
  body text not null default '',
  href text not null default '',
  appointment_id text,
  read_at text,
  created_at text not null
);
create index if not exists clinic_inbox_by_user on public.clinic_inbox (user_id, created_at desc);
create index if not exists clinic_inbox_unread on public.clinic_inbox (user_id) where read_at is null;
alter table public.clinic_inbox enable row level security;
revoke all on public.clinic_inbox from anon, authenticated;
grant all on public.clinic_inbox to service_role;
