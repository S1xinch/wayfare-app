import type { Trip } from './types'

export type Badge = '' | 'Must see' | 'Popular'
export interface Idea { id: string; name: string; kind: string; cost: number; known: boolean; lat: number; lng: number; pop: number; badge: Badge }
// pop = how many Wikipedia language editions have an article about the place (added server-side by /api/sights)
interface OsmEl { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string>; pop?: number }

/** Articles in 60+ languages is a landmark, 15+ is well known. */
export const badgeFor = (pop: number): Badge => (pop >= 60 ? 'Must see' : pop >= 15 ? 'Popular' : '')

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

/** Keep named, de-duplicated ideas that fit the daily budget: best known first, then free/cheapest. A name that appears twice keeps its better-known copy. */
export function rank(els: OsmEl[], daily: number): Idea[] {
  const best = new Map<string, Idea>()
  for (const e of els) {
    const name = e.tags?.name?.trim()
    const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon
    if (!name || lat == null || lng == null) continue
    const { kind, cost, known } = estimate(e.tags!)
    if (cost > daily) continue
    const pop = e.pop ?? 0
    if ((best.get(name.toLowerCase())?.pop ?? -1) >= pop) continue
    best.set(name.toLowerCase(), { id: `${e.type}${e.id}`, name, kind: kind.replace(/_/g, ' '), cost, known, lat, lng, pop, badge: badgeFor(pop) })
  }
  return [...best.values()].sort((a, b) => b.pop - a.pop || a.cost - b.cost || Number(b.known) - Number(a.known)).slice(0, 25)
}

/** Geocode with Nominatim, then list nearby sights with Overpass. Both are free and keyless; only the destination text and its coordinates leave the device. */
export async function fetchElements(destination: string, signal: AbortSignal): Promise<OsmEl[]> {
  const g = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(destination)}`, { signal })
  if (!g.ok) throw new Error('Location lookup failed')
  const hit = (await g.json())[0]
  const lat = Number(hit?.lat), lon = Number(hit?.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error(`Couldn't find “${destination}” on the map`)
  // Overpass is queried by our own server (/api/sights): browsers can't send the User-Agent it requires, and its error pages have no CORS headers
  const r = await fetch(`/api/sights?lat=${lat}&lon=${lon}`, { signal })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? 'Sights lookup is busy right now, try again in a minute')
  return j.elements ?? []
}
