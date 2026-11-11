# Displaced patient rebooking

When a doctor removes hours that patients have already booked, the change is no longer simply
refused: the doctor can explicitly confirm **Notify them and offer new times**. The patients are
told, offered the nearest free times (held for them), and choose a time or a full refund.

Normal edits are unchanged. Anything that does not strand a booked visit saves as before, and
structural changes to a booked session (mode, slot length, recurrence) are still refused.

## Flow

1. **Doctor** shrinks a session's hours (Sessions workspace) or removes a booked session. The form
   lists the affected visits and asks to confirm. Backing out changes nothing.
2. **One transaction** (`saveSessionDisplacing`; Supabase `clinic_displace_and_save_session`):
   - saves the session;
   - marks each stranded visit `displaced`, with `displaced_at` and `displaced_reason` (rows are never
     deleted; the original date, time, reference and payment stay on the row);
   - creates one `rebooking_offers` row per booked visit and holds up to 3 nearest free times
     (`OFFER_SLOTS`, at most 5) with the same doctor for 24 hours (`rebooking_holds`). Held times are
     closed to every other booking path, including the database placement trigger.
   If any visit or time changed meanwhile, nothing is written and the doctor is asked again.
3. **After commit**, the outbox queues the notices (`src/lib/rebooking-notices.ts`):
   - email to every displaced patient with one button per held time (`/rebook/<token>?slot=…`),
     **Show more times** and **Cancel and get a full refund**;
   - a short text with the offer link, only for Indian 10-digit mobiles (6–9) when SMS is on;
     everyone else gets the email alone;
   - an unpaid payment hold in a removed session gets a "released, nothing charged" email instead.
4. **Patient** opens `/rebook/<token>`. Opening a link never changes anything (mail scanners follow
   links); the patient confirms with a button:
   - **Confirm new time**: the visit moves atomically to the held time, or any other open time,
     with the same reference and the same payment (`clinic_accept_rebooking`). Reschedule history,
     reminders, a confirmation (email + text) and a doctor email follow.
   - **Cancel and refund** (with a confirmation tick): the offer closes, the holds are released, the
     visit is cancelled and refunded in full through the normal Razorpay refund flow
     (`refundForCancellation(…, "clinic")`, idempotent), or through the desk ledger for desk visits.
5. **Expiry**: each cron tick (`runCron`, the existing pg_cron → `/api/cron` job every 5 minutes)
   runs `expireOffers()`. A lapsed offer is closed, its holds released, the visit cancelled and refunded,
   and a final email sent. It is idempotent: an offer closes once. An unsent offer email is dropped
   once the patient has answered or the offer lapsed.
6. **Doctor dashboard**: **Displaced patients** on the Sessions page (and the pending ones on the
   clinic book) shows each displaced visit as pending, rebooked, refunded or hold released.

## Security

- The link token is `HMAC-SHA256(REBOOK_TOKEN_SECRET || AUTH_SECRET, "rebook:" + offerId)`. Only its
  SHA-256 is stored (`token_hash`). The outbox stores the offer id and rebuilds the link when sending,
  so the raw token never reaches the database. Production refuses to build links without a secret of
  at least 16 characters.
- The token is the only credential for `/rebook/*` (the patient may be signed out). It is checked in
  constant time, the page is `noindex` and `Referrer-Policy: no-referrer`. Every action re-reads the
  offer, and accepting checks the time is still free and in the future.
- New tables have RLS on and no policies; the functions are `security invoker`, `search_path = ''`,
  executable by `service_role` only.

## Stores

- Supabase: migration `supabase/migrations/20261111_displaced_rebooking.sql`; smoke test
  `supabase/tests/displaced_rebooking.sql` (fixture data, rolled back).
- SQLite: the same tables and checks inside `BEGIN IMMEDIATE` transactions.
- Blob (legacy): not supported. Displacing throws a clear error and the doctor is told to use
  Supabase; normal edits keep working.

## Configuration

- `REBOOK_TOKEN_SECRET` (optional; falls back to `AUTH_SECRET`).
- `SMS_MODE` / `FAST2SMS_API_KEY` and `RESEND_API_KEY` as for other notices. Tests use mocked senders.
- No new Vercel cron: expiry rides on the existing 5-minute scheduler.

## Rollout

Apply `20261111_displaced_rebooking.sql` to a test/preview Supabase project first, run the smoke test,
then production. It adds a status value, two nullable columns, two tables, triggers and functions;
it does not update or delete existing rows. Do not merge until mentor approval.
