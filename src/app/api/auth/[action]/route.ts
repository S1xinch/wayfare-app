import { checkPw, clearSession, DUMMY_HASH, hashPw, setSession } from "@/lib/auth";
import { sha, token } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { json, limit } from "@/lib/http";
import { sendMail } from "@/lib/mail";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");

  if (action === "logout") {
    await clearSession();
    return json({ ok: true });
  }

  const rl = await limit(req, `auth-${action}`, 8, 600);
  if (rl) return rl;

  if (action === "register") {
    if (!EMAIL.test(email)) return json({ error: "Enter a valid email." }, 400);
    if (password.length < 10) return json({ error: "Password must be at least 10 characters." }, 400);
    if (password.length > 72) return json({ error: "Password must be 72 characters or fewer." }, 400); // bcrypt ignores bytes past 72
    const t = token();
    // A verified account is never touched. An unverified one is re-issued a token and the latest password, so a lost
    // or never-sent verification email can be retried by registering again.
    const rows = await sql`
      INSERT INTO users (email, password_hash, verify_hash) VALUES (${email}, ${await hashPw(password)}, ${sha(t)})
      ON CONFLICT (email) DO UPDATE SET verify_hash = EXCLUDED.verify_hash, password_hash = EXCLUDED.password_hash, updated_at = now()
      WHERE users.email_verified = FALSE
      RETURNING id`;
    // Same response whether or not the email exists, so registration can't be used to probe accounts.
    if (rows.length) await sendMail(email, "Verify your Wayfare email", `Confirm your email: ${appUrl()}/verify?token=${t}`);
    return json({ ok: true, message: "Check your email for a verification link." });
  }

  if (action === "login") {
    const u = (await sql`SELECT id, password_hash, email_verified FROM users WHERE email = ${email}`)[0];
    // Unknown emails are checked against a dummy hash so a miss costs the same as a wrong password.
    if (!(await checkPw(password, u?.password_hash ?? DUMMY_HASH)) || !u) return json({ error: "Wrong email or password." }, 401);
    if (!u.email_verified) return json({ error: "Verify your email first. Check your inbox." }, 403);
    await setSession(u.id);
    return json({ ok: true });
  }

  if (action === "forgot") {
    const t = token();
    const rows = await sql`
      UPDATE users SET reset_hash = ${sha(t)}, reset_expires = now() + interval '1 hour' WHERE email = ${email} RETURNING id`;
    if (rows.length) await sendMail(email, "Reset your Wayfare password", `Reset link (valid 1 hour): ${appUrl()}/reset?token=${t}`);
    return json({ ok: true, message: "If that email has an account, a reset link is on its way." });
  }

  if (action === "reset") {
    if (password.length < 10) return json({ error: "Password must be at least 10 characters." }, 400);
    if (password.length > 72) return json({ error: "Password must be 72 characters or fewer." }, 400); // bcrypt ignores bytes past 72
    const rows = await sql`
      UPDATE users SET password_hash = ${await hashPw(password)}, reset_hash = NULL, reset_expires = NULL, updated_at = now()
      WHERE reset_hash = ${sha(String(b.token ?? ""))} AND reset_expires > now() RETURNING id`;
    if (!rows.length) return json({ error: "This reset link is invalid or expired." }, 400);
    return json({ ok: true });
  }

  return json({ error: "Not found" }, 404);
}
