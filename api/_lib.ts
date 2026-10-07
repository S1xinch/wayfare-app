import { neon } from '@neondatabase/serverless'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { createHash, randomBytes } from 'node:crypto'

export const sql = neon(process.env.DATABASE_URL!)

export const json = (data: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } })

export const sha = (s: string) => createHash('sha256').update(s).digest('hex')
export const token = () => randomBytes(32).toString('base64url')
export const hashPw = (p: string) => bcrypt.hash(p, 12)
export const checkPw = (p: string, h: string) => bcrypt.compare(p, h)
// compared when the email is unknown, so a miss costs the same as a wrong password
export const DUMMY_HASH = bcrypt.hashSync('wayfare-dummy-password', 12)

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!)
const MAX_AGE = 7 * 86400
const cookie = (v: string, age: number) => `s=${v}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`

export async function sessionCookie(uid: number) {
  const jwt = await new SignJWT({}).setSubject(String(uid)).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(secret())
  return cookie(jwt, MAX_AGE)
}
export const clearCookie = () => cookie('', 0)

/** Signed-in user, or null. A password change invalidates every older session. */
export async function currentUser(req: Request) {
  const t = /(?:^|;\s*)s=([^;]+)/.exec(req.headers.get('cookie') ?? '')?.[1]
  if (!t) return null
  try {
    const { payload } = await jwtVerify(t, secret())
    const u = (await sql`SELECT id, email, email_verified, pw_changed_at FROM wf_users WHERE id = ${Number(payload.sub)}`)[0]
    if (!u || !u.email_verified || (payload.iat ?? 0) * 1000 < new Date(u.pw_changed_at).getTime() - 1000) return null
    return { id: u.id as number, email: u.email as string }
  } catch {
    return null
  }
}

/** CSRF: state-changing calls must come from this site (Origin host == Host). The cookie is also SameSite=Lax. */
export function guard(req: Request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return null
  let ok = false
  try { ok = new URL(req.headers.get('origin') ?? '').host === req.headers.get('host') } catch { /* no origin */ }
  return ok ? null : json({ error: 'Bad origin' }, 403)
}

/** Fixed-window limit per IP, kept in Postgres. Returns a 429 response when exceeded. */
export async function limit(req: Request, name: string, max: number, sec: number) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const bucket = Math.floor(Date.now() / 1000 / sec)
  const n = (await sql`
    INSERT INTO wf_rate (key, bucket, n) VALUES (${name + ':' + ip}, ${bucket}, 1)
    ON CONFLICT (key, bucket) DO UPDATE SET n = wf_rate.n + 1 RETURNING n`)[0].n as number
  if (Math.random() < 0.02) await sql`DELETE FROM wf_rate WHERE bucket < ${bucket - 2}`.catch(() => {}) // housekeeping; ponytail: ok while traffic is tiny
  return n > max ? json({ error: 'Too many attempts. Try again later.' }, 429) : null
}

export async function sendMail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) return console.log(`[mail not configured] to=${to} subject=${subject}\n${text}`)
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to, subject, text }),
  })
  if (!res.ok) console.error('mail failed', res.status, await res.text())
}

export const appUrl = () => (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
