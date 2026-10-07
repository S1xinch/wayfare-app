import type { Trip } from './types'

export interface Idea { id: string; name: string; kind: string; cost: number; known: boolean; lat: number; lng: number }
interface OsmEl { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

// Rough USD entry prices by OSM tag value. Estimates only; ponytail: static table, swap for a real price source if one exists.
const COST: Record<string, number> = {
  museum: 15, gallery: 12, zoo: 25, theme_park: 50, attraction: 8, viewpoint: 0, artwork: 0,
  castle: 12, ruins: 0, monument: 0, memorial: 0, archaeological_site: 8, park: 0,
}

const day = (s: string) => Date.parse(s + 'T00:00:00Z') / 864e5

/** Budget left divided by days left in the trip (today counts if the trip has started). Assumes expenses share the budget's currency. */
export function dailyBudget(t: Pick<Trip, 'budget' | 'expenses' | 'startDate' | 'endDate'>, today: string) {
  const left = t.budget - t.expenses.reduce((n, e) => n + e.amount, 0)
  const from = Math.max(day(today), day(t.startDate))
  return Math.max(0, left) / Math.max(1, day(t.endDate) - from + 1)
}

/** fee=no is a known zero; otherwise fall back to the category estimate. */
export function estimate(tags: Record<string, string>) {
  const kind = tags.tourism ?? tags.historic ?? tags.leisure ?? ''
  const base = COST[kind] ?? 8
  if (tags.fee === 'no') return { kind, cost: 0, known: true }
  if (tags.fee === 'yes') return { kind, cost: Math.max(base, 5), known: true }
  return { kind, cost: base, known: false }
}

/** Keep named, de-duplicated ideas that fit the daily budget; free first, then cheapest. */
export function rank(els: OsmEl[], daily: number): Idea[] {
  const seen = new Set<string>()
  const out: Idea[] = []
  for (const e of els) {
    const name = e.tags?.name?.trim()
    const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon
    if (!name || lat == null || lng == null || seen.has(name.toLowerCase())) continue
    const { kind, cost, known } = estimate(e.tags!)
    if (cost > daily) continue
    seen.add(name.toLowerCase())
    out.push({ id: `${e.type}${e.id}`, name, kind: kind.replace(/_/g, ' '), cost, known, lat, lng })
  }
  return out.sort((a, b) => a.cost - b.cost || Number(b.known) - Number(a.known)).slice(0, 25)
}

/** Geocode with Nominatim, then list nearby sights with Overpass. Both are free and keyless; only the destination text and its coordinates leave the device. */
export async function fetchElements(destination: string, signal: AbortSignal): Promise<OsmEl[]> {
  const g = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(destination)}`, { signal })
  if (!g.ok) throw new Error('Location lookup failed')
  const hit = (await g.json())[0]
  const lat = Number(hit?.lat), lon = Number(hit?.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error(`Couldn't find “${destination}” on the map`)
  const a = `(around:6000,${lat},${lon})`
  const q = `[out:json][timeout:20];(nwr["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|theme_park|artwork)$"]${a};nwr["historic"~"^(monument|castle|ruins|memorial|archaeological_site)$"]${a};nwr["leisure"="park"]["name"]${a};);out center 120;`
  // public Overpass servers shed load often; try the mirror before giving up
  for (const host of ['overpass-api.de', 'overpass.kumi.systems']) {
    try {
      const r = await fetch(`https://${host}/api/interpreter`, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal })
      if (r.ok) return (await r.json()).elements ?? []
    } catch (e) { if (signal.aborted) throw e }
  }
  throw new Error('Sights lookup is busy right now, try again in a minute')
}
