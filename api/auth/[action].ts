import { appUrl, checkPw, DUMMY_HASH, clearCookie, hashPw, json, limit, guard, sendMail, sessionCookie, sha, sql, token } from '../_lib.js'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PW = 10

export async function POST(req: Request) {
  const bad = guard(req)
  if (bad) return bad
  const action = new URL(req.url).pathname.split('/').pop()
  const b = await req.json().catch(() => ({}))
  const email = String(b.email ?? '').trim().toLowerCase()
  const password = String(b.password ?? '')

  if (action === 'logout') return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() })

  const rl = await limit(req, `auth-${action}`, 8, 600)
  if (rl) return rl

  if (action === 'register') {
    if (!EMAIL.test(email) || email.length > 254) return json({ error: 'Enter a valid email.' }, 400)
    if (password.length < MIN_PW) return json({ error: `Password must be at least ${MIN_PW} characters.` }, 400)
    if (password.length > 72) return json({ error: 'Password must be 72 characters or fewer.' }, 400) // bcrypt ignores bytes past 72
    const t = token()
    // A verified account is never touched. An unverified one gets a fresh token and the latest password, so a lost
    // verification email can be retried by registering again.
    const rows = await sql`
      INSERT INTO wf_users (email, password_hash, verify_hash) VALUES (${email}, ${await hashPw(password)}, ${sha(t)})
      ON CONFLICT (email) DO UPDATE SET verify_hash = EXCLUDED.verify_hash, password_hash = EXCLUDED.password_hash, updated_at = now()
      WHERE wf_users.email_verified = FALSE
      RETURNING id`
    // Same answer whether or not the address exists, so registration can't be used to probe accounts.
    if (rows.length) await sendMail(email, 'Verify your Wayfare email', `Confirm your email to finish creating your Wayfare account:\n${appUrl()}/#/verify?token=${t}`)
    return json({ ok: true, message: 'Check your email for a verification link.' })
  }

  // POST (not GET), so email scanners that pre-open links can't verify an address.
  if (action === 'verify') {
    const rows = await sql`UPDATE wf_users SET email_verified = TRUE, verify_hash = NULL, updated_at = now() WHERE verify_hash = ${sha(String(b.token ?? ''))} RETURNING id`
    return rows.length ? json({ ok: true }) : json({ error: 'This verification link is invalid or already used.' }, 400)
  }

  if (action === 'login') {
    const u = (await sql`SELECT id, password_hash, email_verified FROM wf_users WHERE email = ${email}`)[0]
    const good = await checkPw(password, u?.password_hash ?? DUMMY_HASH)
    if (!u || !good) return json({ error: 'Wrong email or password.' }, 401)
    if (!u.email_verified) return json({ error: 'Verify your email first. Check your inbox.' }, 403)
    return json({ ok: true }, 200, { 'Set-Cookie': await sessionCookie(u.id) })
  }

  if (action === 'forgot') {
    const t = token()
    const rows = await sql`UPDATE wf_users SET reset_hash = ${sha(t)}, reset_expires = now() + interval '1 hour' WHERE email = ${email} RETURNING id`
    if (rows.length) await sendMail(email, 'Reset your Wayfare password', `Reset your password (link valid for 1 hour):\n${appUrl()}/#/reset?token=${t}`)
    return json({ ok: true, message: 'If that email has an account, a reset link is on its way.' })
  }

  if (action === 'reset') {
    if (password.length < MIN_PW || password.length > 72) return json({ error: `Password must be ${MIN_PW}-72 characters.` }, 400)
    // Receiving the link proves control of the inbox, so this also verifies the address. pw_changed_at signs out other sessions.
    const rows = await sql`
      UPDATE wf_users SET password_hash = ${await hashPw(password)}, reset_hash = NULL, reset_expires = NULL,
        email_verified = TRUE, pw_changed_at = now(), updated_at = now()
      WHERE reset_hash = ${sha(String(b.token ?? ''))} AND reset_expires > now() RETURNING id`
    return rows.length ? json({ ok: true }) : json({ error: 'This reset link is invalid or expired.' }, 400)
  }

  return json({ error: 'Not found' }, 404)
}
