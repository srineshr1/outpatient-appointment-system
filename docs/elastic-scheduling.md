# Elastic scheduling

Doctors edit an existing session's start/end in the Sessions workspace. Free availability is
regenerated from the new bounds. Appointments are immutable snapshots: a visit outside reduced
hours remains in patient/staff books at its original date, time, end, reference and payment state.
Pending-payment holds are protected and may complete after resizing. No automatic cancellation,
reschedule, notification of a moved visit, refund, or appointment rewrite is performed.

## Safety and tradeoffs

- A booked session may change its hours, name and room, but not recurrence, mode, duration step,
  capacity or archive state while current/future reservations use it.
- Reservations are matched by doctor/date and original interval, not just slot ID. Shifted grids
  cannot reopen overlapping minutes. Adjacent nonoverlapping slots remain available.
- Unchanged waves retain normal token capacity. A resized wave overlapping an old reservation is
  conservatively closed to new bookings for that occurrence. Existing tokens/times are not moved
  or reused. Unaffected legacy sub-waves and unreserved dates follow the updated availability.
- SQLite validates placements inside its immediate write transaction. Supabase serializes session
  edits and new placements per doctor using transaction advisory locks, then checks the current
  session and protected intervals in a trigger. Existing payment/status-only updates bypass the
  new-placement check so an accepted hold can still complete.
- Old rows missing an end time recover the unchanged stream/sub-wave duration from their session.
  If no reliable duration exists (or a whole wave has no snapshot), the remaining day is conservatively
  unavailable; review those legacy rows before rollout rather than guessing a shorter visit.
- The legacy Blob store cannot coordinate changed slot identities atomically; resizing is refused
  there rather than advertised as safe. Use Supabase in production or SQLite locally.

## Rollout

Apply `supabase/migrations/20261108133618_elastic_scheduling_guards.sql` to the intended test/preview
Supabase project before enabling this UI there. The migration only adds functions/triggers/grants;
it does not update or delete any appointment. Existing server-only RLS remains unchanged. No live
migration or deployment is performed by this PR. Keep the stacked PR unmerged pending mentor review.

## Verification

- `npm test`: includes pure resizing/overlap/wave cases and server-action/SQLite integration tests.
- `npm run lint` and `npm run build`.
- In an isolated, migrated Postgres test database, run
  `psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/elastic_scheduling.sql`.
  The smoke test uses fake fixture data and rolls it back. It covers shrink/expansion, immutable
  booking snapshots, stale placement rejection, changed-grid overlap, payment completion after
  shrink, protected structural changes and wave token preservation.
- The migration chain (excluding unrelated cron extension setup) and SQL smoke tests were also run
  locally with PGlite/Postgres and pgcrypto. This is not a multi-connection concurrency stress test.
  Live Supabase, browser end-to-end checkout, SMS/email and Vercel deployment were not exercised.
