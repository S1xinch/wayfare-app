import type { Trip } from './types'

/** tripId -> ISO time it was deleted. Stops a deleted trip from being resurrected by another device's older copy. */
export type Deleted = Record<string, string>

/** Newest copy of each trip wins; a trip stays deleted unless it was edited after the deletion. ISO timestamps compare as strings. */
export function mergeTrips(local: Trip[], remote: Trip[], deleted: Deleted): Trip[] {
  const byId = new Map<string, Trip>()
  for (const t of [...local, ...remote]) {
    const cur = byId.get(t.id)
    if (!cur || t.updatedAt > cur.updatedAt) byId.set(t.id, t)
  }
  return [...byId.values()]
    .filter((t) => !(deleted[t.id] && deleted[t.id] >= t.updatedAt))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Union of tombstones, keeping the latest time per trip. ponytail: never pruned, fine for a personal trip list. */
export function mergeDeleted(a: Deleted, b: Deleted): Deleted {
  const out = { ...a }
  for (const [id, at] of Object.entries(b)) if (!out[id] || at > out[id]) out[id] = at
  return out
}
