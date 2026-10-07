import { userId } from "@/lib/auth";
import { flightCode } from "@/lib/flightstatus";
import { json, limit } from "@/lib/http";
import { redis } from "@/lib/redis";

type Route = { found: true; o: string; d: string; airline: string } | { found: false };

const DAY = 864e5;
const ANON_DAILY = 5; // uncached lookups per day for visitors who are not signed in (protects the free 100/month)

/**
 * GET /api/flightnumber?flight=BA%20117&date=2026-12-20
 * Works out which route a flight number flies, so the results page can show that flight's fares on that date.
 * The route comes from Aviationstack's live schedule (one request, then cached for 30 days). The fares themselves
 * come from the normal search, filtered to the flight number on the results page.
 */
export async function GET(req: Request) {
  try {
    return await lookup(req);
  } catch (e) {
    // e.g. Redis unreachable or not configured: answer with JSON so the form can show a message instead of a bare 500
    console.error("flightnumber failed", e);
    return json({ error: "Flight number lookup is unavailable right now. Try again later." }, 503);
  }
}

async function lookup(req: Request) {
  const rl = await limit(req, "flightnum", 10);
  if (rl) return rl;

  const q = new URL(req.url).searchParams;
  const code = flightCode(q.get("flight") ?? "");
  const date = q.get("date") ?? "";
  if (!code) return json({ error: "Enter a flight number like BA 117." }, 400);
  const t = Date.parse(date);
  const today = Date.parse(new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(t) || t < today || t > today + 330 * DAY)
    return json({ error: "Choose a date from today up to 11 months ahead." }, 400);

  const ck = `fnroute_${code}`;
  const hit = await redis.get<Route>(ck);
  if (hit) return json({ ...hit, flight: code, date });

  const key = process.env.AVIATIONSTACK_API_KEY;
  if (!key) return json({ error: "Flight number lookup is not set up yet." }, 503);

  const uid = await userId();
  if (!uid) {
    const day = `avs_fn_${new Date().toISOString().slice(0, 10)}`;
    const n = await redis.incr(day);
    if (n === 1) await redis.expire(day, 172800);
    if (n > ANON_DAILY) return json({ error: "Flight number lookups are busy today. Sign in, or search by route instead." }, 429);
  }
  const month = `avs_${new Date().toISOString().slice(0, 7)}`;
  const used = await redis.incr(month);
  if (used === 1) await redis.expire(month, 40 * 86400);
  if (used > Number(process.env.AVIATIONSTACK_MONTHLY_CAP ?? 90))
    return json({ error: "Flight number lookups for this month are used up. Search by route instead." }, 429);

  try {
    const res = await fetch(`https://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(key)}&flight_iata=${code}&limit=10`, {
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json();
    if (!res.ok || body.error) throw new Error(`Aviationstack ${res.status}: ${JSON.stringify(body.error ?? {}).slice(0, 200)}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (body.data ?? []).find((r: any) => /^[A-Z]{3}$/.test(r?.departure?.iata ?? "") && /^[A-Z]{3}$/.test(r?.arrival?.iata ?? ""));
    const out: Route = row ? { found: true, o: row.departure.iata, d: row.arrival.iata, airline: String(row.airline?.name ?? "") } : { found: false };
    await redis.set(ck, out, { ex: out.found ? 30 * 86400 : 6 * 3600 }); // a flight that is not in today's schedule may be tomorrow
    return json({ ...out, flight: code, date });
  } catch (e) {
    console.error("flightnumber failed", e);
    return json({ error: "Flight number lookup is unavailable right now. Try again later." }, 502);
  }
}
