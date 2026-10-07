import { json, limit } from "@/lib/http";
import { redis } from "@/lib/redis";

// Nearby sights for the trips "Ideas" tab, from OpenStreetMap's Overpass API. This runs on the server because browsers
// cannot set the User-Agent Overpass asks clients to send (the main server answers generic agents with 406, and its
// error pages carry no CORS headers, which the browser reports as a CORS failure). It also tries several mirrors and
// caches each area for a day. Only numeric coordinates are accepted, so this cannot be used as a general Overpass relay.
export const maxDuration = 45;

// The main operator's servers. They are asked at the same time and the first good answer wins: any one of them is often
// overloaded (504), and a single query can take 10-20 s. Third-party mirrors were tried and are unreachable.
const MIRRORS = [
  "https://z.overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];
const TOURISM = ["attraction", "museum", "gallery", "viewpoint", "zoo", "theme_park", "artwork"];
const HISTORIC = ["monument", "castle", "ruins", "memorial", "archaeological_site"];
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
  // exact tag matches (same places as a regex over the values, but cheaper for Overpass to evaluate)
  const query = `[out:json][timeout:30];(${[
    ...TOURISM.map((t) => `nwr["tourism"="${t}"]${a};`),
    ...HISTORIC.map((t) => `nwr["historic"="${t}"]${a};`),
    `nwr["leisure"="park"]["name"]${a};`,
  ].join("")});out center 120;`;

  const stop = new AbortController();
  const ask = async (url: string) => {
    const r = await fetch(url, {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
      signal: AbortSignal.any([stop.signal, AbortSignal.timeout(35_000)]),
    });
    if (!r.ok) throw new Error(`${url} ${r.status}`);
    return ((await r.json()).elements ?? []) as unknown[];
  };
  try {
    const elements = await Promise.any(MIRRORS.map(ask));
    stop.abort(); // the first answer wins; stop asking the others
    await redis.set(key, elements, { ex: 86400 }).catch(() => {});
    return json({ elements });
  } catch {
    return json({ error: "Sights lookup is busy right now, try again in a minute." }, 503);
  }
}
