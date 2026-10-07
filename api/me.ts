import { clearCookie, currentUser, guard, json, sql } from './_lib.js'

export async function GET(req: Request) {
  const u = await currentUser(req)
  return u ? json({ email: u.email }) : json({ error: 'Not signed in' }, 401)
}

/** Delete the account. wf_sync rows go with it (ON DELETE CASCADE). */
export async function DELETE(req: Request) {
  const bad = guard(req)
  if (bad) return bad
  const u = await currentUser(req)
  if (!u) return json({ error: 'Not signed in' }, 401)
  await sql`DELETE FROM wf_users WHERE id = ${u.id}`
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() })
}
