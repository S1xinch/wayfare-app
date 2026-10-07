# Wayfare

Plan trips offline, then find the cheapest flights. One app, one account.

- **Flights** (`/`): live fares, 30-day price history, deal detection, price-drop email alerts. Free, no affiliate links.
- **Trips** (`/trips`): offline-first itineraries, packing, expenses, notes, a map and nearby ideas. Trips live in IndexedDB on the device and sync to the account when signed in.

This repo is the merge of `wayfare-app` (trips, a Vite SPA) and `flight-finder` (flights, Next.js). Flight Finder is the base; the Wayfare trips code lives in `src/wayfare/` and is mounted at `/trips` as client-only routes.

Stack: Next.js (App Router) + Tailwind + Recharts + Redux Toolkit/idb-keyval/Leaflet (trips), Neon Postgres, Upstash Redis, Bright Data (Google Flights), Resend, Vercel.

## Setup

1. Copy `.env.example` to `.env.local` and fill it in.
2. `npm install`
3. `npm run migrate` (creates the tables in Neon, including `trip_sync`)
4. `npm run dev`

`npm test` runs the unit tests, `npm run typecheck` checks types.

## Deploy (Vercel)

1. Import this repo in Vercel. Add the Neon and Upstash Redis integrations (they set `DATABASE_URL` and the Redis variables).
2. Add the remaining variables from `.env.example`: `BRIGHTDATA_API_KEY`, `JWT_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, `APP_URL`, `RESEND_API_KEY`, `MAIL_FROM`.
3. Run `npm run migrate` once against the production `DATABASE_URL`.
4. In this GitHub repo add secrets `APP_URL` and `CRON_SECRET` so the scheduled workflow can refresh watched routes.

## Moving existing Wayfare users over

Only needed for the production cutover. After `npm run migrate`, run `node --env-file=.env.local scripts/import-wayfare.mjs`: it copies verified `wf_users` into `users` (an email that already has a Flight Finder account keeps that account) and `wf_sync` into `trip_sync`. The `wf_*` tables are left in place. **Rotate `JWT_SECRET` at cutover**: old Wayfare session cookies carry `wf_users` ids, which are different people in `users`.

## How it works

- `/api/trips` is the trip sync endpoint: one JSON document per user, merged per trip on the client (`src/wayfare/merge.ts`) and written with an optimistic revision (409 means pull, merge, retry).

- `/api/search` validates the query and returns cached results (Redis, 1 hour). On a miss it reads Google Flights
  directly with the vendored [fli-js](src/vendor/fli/NOTICE.md) client (1-3 seconds, no credits, capped by
  `DIRECT_DAILY_CAP`). If that fails it falls back to a Bright Data lookup (minutes, capped by `DAILY_SEARCH_CAP`).
  Three direct failures in a row pause the direct path for 10 minutes. Set `SEARCH_PROVIDER=brightdata` to switch it off.
  Either way the cheapest fare is logged to `price_history`.
- The direct read is unofficial and may break or be blocked when Google changes its page; that is what the fallback is for.
- "Find a flight by number" (home page) calls `/api/flightnumber`, which looks up the flight's route in Aviationstack's live
  schedule (cached 30 days; visitors who are not signed in get 5 uncached lookups a day), then opens the normal results for that
  route and date filtered to the flight (`?fn=`). The results page also has a flight-number filter for any search.
  A flight that is not in today's live schedule cannot be resolved; searching by route still works.
- `/api/status` shows live flight status for saved flights near their travel day (Aviationstack, free plan: 100 requests a month).
- Deal = price at or below 90% of the route's 30-day average (needs 3+ observations). High = 110% or more.
- `.github/workflows/refresh.yml` calls `/api/cron` every 6 hours. It re-prices the stalest watched routes and emails due alerts.
- Booking records are encrypted at rest (AES-256-GCM). Passwords use bcrypt (12 rounds). Sessions are 24-hour JWTs in an HTTP-only cookie.

## Data limits

The Bright Data Google Flights feed provides airline, flight number, times, duration, stops and price. It does not
provide fare breakdowns, baggage rules, seat prices, aircraft type, ratings or emissions, so the app does not show them.
