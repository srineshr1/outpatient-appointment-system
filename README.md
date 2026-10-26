# Halden Street Practice — GP booking

Online appointment booking for registered patients: choose a doctor, pick a time, enter details, get a reference and a calendar invite.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4 and Motion.

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
| `/` | Doctor directory with search and specialty filter |
| `/doctors/[id]?week=YYYY-MM-DD` | Week view; the week is clamped to the bookable window |
| `/book/details` | Patient form (redirects to `/` if no time is held) |
| `/book/confirmed` | Reference, summary and `.ics` download |

- `src/lib/clock.ts` — all dates and times are Europe/London wall-clock, independent of server or browser time zone (tests run in Asia/Kolkata to prove it).
- `src/lib/data.ts` — doctors, reasons, and a deterministic slot generator over a rolling four-week window.
- `src/lib/repository.ts` — the data-access seam. Every caller treats it as async; replace the function bodies with calls to the practice system to go live. `confirmBooking` re-checks availability and throws `SlotUnavailableError` if the time has gone.
- `src/components/providers/BookingProvider.tsx` — cross-route booking state. The held time and booking reference persist in `sessionStorage`; **patient details are kept in memory only** and are never written to storage.

## Production notes

- **There is no backend yet.** Slots are generated and bookings are not stored anywhere outside the browser tab. Before real use, `repository.ts` must call an authenticated API that owns availability and records bookings, and confirmation must happen server-side.
- The pages render per request (they depend on the current time), so deploy as a Node server (`next build && next start`) or any host that supports Next.js server rendering. Static export is not supported.
- Set `NEXT_PUBLIC_SITE_URL` to the public origin for correct Open Graph URLs.
- Security headers: a nonce-based CSP is set in `src/proxy.ts`; HSTS, nosniff, frame and permissions policies in `next.config.ts`. Serve over HTTPS.
- Fonts are self-hosted at build time via `next/font` (Inter, used where SF Pro isn't available); no font requests reach third parties.
- `app/error.tsx` has a hook for an error reporter. Do not send patient data to it.
