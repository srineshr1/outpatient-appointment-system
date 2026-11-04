-- Run the app's /api/cron every 5 minutes from inside Supabase (Vercel Hobby crons are daily only).
-- It expires payment holds, sends due reminders and retries failed notifications. The shared secret
-- and the URL are read from clinic_settings when the job runs, so rotating them needs no new job.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'clinic-cron-5min',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := (select value #>> '{}' from public.clinic_settings where key = 'cron_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select value #>> '{}' from public.clinic_settings where key = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $job$
);
