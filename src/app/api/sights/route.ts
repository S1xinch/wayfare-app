import { json, limit } from "@/lib/http";
import { redis } from "@/lib/redis";

// Nearby sights for the trips "Ideas" tab, from OpenStreetMap's Overpass API. This runs on the server because browsers
// cannot set the User-Agent Overpass asks clients to send (the main server answers generic agents with 406, and its
// error pages carry no CORS headers, which the browser reports as a CORS failure). It also tries several mirrors and
// caches each area for a day. Only numeric coordinates are accepted, so this cannot be used as a general Overpass relay.
export const maxDuration = 30;

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const UA = `Wayfare/1.0 (${process.env.APP_URL ?? "https://wayfare-app-phi.vercel.app"})`;
const round = (n: number) => Math.round(n * 100) / 100; // ~1 km: one cache entry per neighbourhood

export async function GET(req: Request) {
  const rl = await limit(req, "sights", 20);
  if (rl) return rl;

  const q = new URL(req.url).searchParams;
  const rawLat = q.get("lat") ?? "", rawLon = q.get("lon") ?? "";
  const lat = round(Number(rawLat)), lon = round(Number(rawLon));
  if (!rawLat || !rawLon || !(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) return json({ error: "Bad coordinates." }, 400);

  const key = `sights_${lat}_${lon}`;
  const hit = await redis.get<unknown[]>(key).catch(() => null);
  if (hit) return json({ elements: hit });

  const a = `(around:6000,${lat},${lon})`;
  const query = `[out:json][timeout:20];(nwr["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|theme_park|artwork)$"]${a};nwr["historic"~"^(monument|castle|ruins|memorial|archaeological_site)$"]${a};nwr["leisure"="park"]["name"]${a};);out center 120;`;

  // public Overpass servers shed load often; try the next mirror before giving up
  for (const url of MIRRORS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
        signal: AbortSignal.timeout(8_000),
      });
      if (!r.ok) continue;
      const elements = (await r.json()).elements ?? [];
      await redis.set(key, elements, { ex: 86400 }).catch(() => {});
      return json({ elements });
    } catch {
      /* timeout or network error: next mirror */
    }
  }
  return json({ error: "Sights lookup is busy right now, try again in a minute." }, 503);
}
