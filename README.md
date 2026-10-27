# Halden Street Practice — GP booking

Online appointment booking for a demonstration GP practice: create an account, choose a doctor, pick a time, and see the visit on that doctor’s clinic book.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4 and Motion. Accounts, sessions and visits are stored in SQLite (`data/clinic.sqlite`). Set `BLOB_READ_WRITE_TOKEN` to store them in a private Vercel Blob store instead, which is what the hosted app uses.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | oxlint + TypeScript type-check |
| `npm test` | Unit and component tests (Vitest, jsdom) |
| `npm run test:e2e` | Playwright on mobile (390px) and desktop (1280px), with axe WCAG 2.2 AA checks. First run: `npx playwright install chromium` |

## How it fits together

| Route | Purpose |
| --- | --- |
| `/` | Landing page: hero, how it works, doctor profiles with search and specialty filter |
| `/doctors/[id]?week=YYYY-MM-DD` | Week view; the week is clamped to the bookable window |
| `/book/details` | Patient form. Needs a patient sign-in (the held time survives it); redirects to `/` if no time is held |
| `/book/confirmed` | Reference, summary and `.ics` download |
| `/sign-in`, `/register` | Sign-in with a patient / staff toggle (`?as=staff` opens the staff tab). Sample accounts are on each tab |
| `/appointments` | The signed-in patient’s visits. Cancel a booked visit here |
| `/dashboard` | Doctor clinic book, or every doctor for reception. Mark complete or cancel |

- `src/lib/clock.ts` — all dates and times are Europe/London wall-clock, independent of server or browser time zone (tests run in Asia/Kolkata to prove it).
- `src/lib/data.ts` — doctors, reasons, and a deterministic slot generator over a rolling four-week window.
- `src/lib/repository.ts` — the data-access seam. Every caller treats it as async; replace the function bodies with calls to the practice system to go live. `confirmBooking` re-checks availability and throws `SlotUnavailableError` if the time has gone.
- `src/components/providers/BookingProvider.tsx` — cross-route booking state. The held time and booking reference persist in `sessionStorage`; **patient details are kept in memory only** and are never written to storage.

## Sample accounts

Every sample account uses the password `Halden-demo-2026`.

| Email | What you can do |
| --- | --- |
| `ann.lee@halden.example` | Book as a patient and see your visits |
| `helen.cho@halden.example` (and the other doctors) | Open that doctor’s clinic book |
| `desk@halden.example` | Reception view of every doctor |

This is a demonstration practice. Don’t enter a real CHI number or medical details you want kept private.

## Production notes

- A booking is saved on the server. The same slot cannot be held twice. Cancelling frees it. The doctor’s clinic book and the patient’s appointment list read that record.
- Sessions are httpOnly cookies, valid for 14 days. Passwords are stored as scrypt hashes.
- The pages render per request (they depend on the current time and the book), so deploy as a Node server (`next build && next start`) or any host that supports Next.js server rendering. Static export is not supported. On Vercel, set `BLOB_READ_WRITE_TOKEN` from a private Blob store so visits survive across serverless instances.
- Set `NEXT_PUBLIC_SITE_URL` to the public origin for correct Open Graph URLs.
- Security headers: a nonce-based CSP is set in `src/proxy.ts`; HSTS, nosniff, frame and permissions policies in `next.config.ts`. Serve over HTTPS.
- Fonts are self-hosted at build time via `next/font` (Inter, used where SF Pro isn't available); no font requests reach third parties.
- `app/error.tsx` has a hook for an error reporter. Do not send patient data to it.
