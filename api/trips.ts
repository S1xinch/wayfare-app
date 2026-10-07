import { currentUser, guard, json, limit, sql } from './_lib.js'

const MAX_BYTES = 2_000_000
const MAX_TRIPS = 500

const current = async (uid: number) => {
  const r = (await sql`SELECT rev, doc FROM wf_sync WHERE user_id = ${uid}`)[0]
  return r ? { rev: r.rev as number, doc: r.doc } : { rev: 0, doc: null }
}

export async function GET(req: Request) {
  const u = await currentUser(req)
  return u ? json(await current(u.id)) : json({ error: 'Not signed in' }, 401)
}

/** Body {rev, doc}. Succeeds only if rev matches the stored one; otherwise 409 with the stored copy so the client can merge and retry. */
export async function PUT(req: Request) {
  const bad = guard(req)
  if (bad) return bad
  const u = await currentUser(req)
  if (!u) return json({ error: 'Not signed in' }, 401)
  const rl = await limit(req, 'sync', 60, 60)
  if (rl) return rl

  const text = await req.text()
  if (text.length > MAX_BYTES) return json({ error: 'Too much data to sync.' }, 413)
  let b: { rev?: unknown; doc?: { trips?: unknown; deleted?: unknown } }
  try { b = JSON.parse(text) } catch { return json({ error: 'Bad JSON' }, 400) }
  const doc = b.doc
  const okTrips = Array.isArray(doc?.trips) && doc.trips.length <= MAX_TRIPS && doc.trips.every((t: { id?: unknown; updatedAt?: unknown }) => typeof t?.id === 'string' && typeof t?.updatedAt === 'string')
  const okDel = !!doc?.deleted && typeof doc.deleted === 'object' && !Array.isArray(doc.deleted)
  if (!Number.isInteger(b.rev) || !okTrips || !okDel) return json({ error: 'Bad sync data' }, 400)

  const body = JSON.stringify({ trips: doc!.trips, deleted: doc!.deleted })
  const rows = b.rev === 0
    ? await sql`INSERT INTO wf_sync (user_id, doc) VALUES (${u.id}, ${body}::jsonb) ON CONFLICT DO NOTHING RETURNING rev`
    : await sql`UPDATE wf_sync SET doc = ${body}::jsonb, rev = rev + 1, updated_at = now() WHERE user_id = ${u.id} AND rev = ${b.rev as number} RETURNING rev`
  return rows.length ? json({ rev: rows[0].rev }) : json(await current(u.id), 409)
}
