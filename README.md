# Wayfare

Offline-first trip planner. Itinerary, packing list, expenses, notes, map, and budget-based ideas. Everything is stored on your device.

Live: https://wayfare-app-phi.vercel.app

```bash
npm install
npm run dev      # local dev server
npm run build    # typecheck + production build
npm run icons    # regenerate app icons and iOS splash screens
node scripts/suggest-check.ts   # budget and suggestion logic checks
```

Hosted on Vercel (static app + `api/` functions). Accounts need `DATABASE_URL`, `JWT_SECRET`, `APP_URL`, `RESEND_API_KEY` and `MAIL_FROM`; apply the schema with `npm run migrate`.
