import { clearSession, userId } from "@/lib/auth";
import { dec } from "@/lib/crypto";
import { CURRENCIES } from "@/lib/currencies";
import { sql } from "@/lib/db";
import { json } from "@/lib/http";
import { parseTheme } from "@/lib/theme-core";

/** GDPR export: everything stored about the signed-in user. */
export async function GET(req: Request) {
  const uid = await userId();
  if (!uid) return json({ error: "Sign in required" }, 401);
  const [user] = await sql`SELECT email, email_verified, email_alerts, currency, theme, created_at FROM users WHERE id = ${uid}`;
  if (!user) return json({ error: "Not found" }, 404);
  if (!new URL(req.url).searchParams.has("export")) return json({ email: user.email, emailAlerts: user.email_alerts, currency: user.currency, theme: user.theme });
  const searches = await sql`SELECT origin, destination, departure_date, return_date, passengers, cabin, created_at FROM saved_searches WHERE user_id = ${uid}`;
  const alerts = await sql`
    SELECT r.origin, r.destination, r.depart_date, r.return_date, a.drop_pct, a.price_threshold, a.frequency, a.alert_status, a.created_at
    FROM price_alerts a JOIN routes r ON r.id = a.route_id WHERE a.user_id = ${uid}`;
  const bookings = (await sql`SELECT flight_data, confirmation_number, total_price, booked_at FROM bookings WHERE user_id = ${uid}`).flatMap((r) => {
    try {
      return [{ ...JSON.parse(dec(r.flight_data)), confirmation: dec(r.confirmation_number), total_price: r.total_price, booked_at: r.booked_at }];
    } catch (e) {
      console.error("booking could not be decrypted for export", e); // e.g. encrypted with a different ENCRYPTION_KEY
      return [];
    }
  });
  const savedFlights = await sql`
    SELECT origin, destination, depart_date, return_date, passengers, cabin, flight, saved_price, currency, created_at
    FROM saved_flights WHERE user_id = ${uid}`;
  return new Response(JSON.stringify({ user, searches, alerts, bookings, savedFlights }, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="wayfare-data.json"' },
  });
}

export async function PATCH(req: Request) {
  const uid = await userId();
  if (!uid) return json({ error: "Sign in required" }, 401);
  const b = await req.json().catch(() => ({}));
  // Only the fields that were sent change (null keeps the stored value).
  const emailAlerts = typeof b.emailAlerts === "boolean" ? b.emailAlerts : null;
  const currency = typeof b.currency === "string" && CURRENCIES.includes(b.currency) ? b.currency : null;
  if (b.currency !== undefined && !currency) return json({ error: "Unknown currency." }, 400);
  const theme = parseTheme(b.theme);
  if (b.theme !== undefined && !theme) return json({ error: "Unknown theme." }, 400);
  await sql`UPDATE users SET email_alerts = COALESCE(${emailAlerts}, email_alerts), currency = COALESCE(${currency}, currency), theme = COALESCE(${theme}, theme), updated_at = now() WHERE id = ${uid}`;
  return json({ ok: true });
}

/** GDPR erasure: cascades to searches, alerts and bookings. */
export async function DELETE() {
  const uid = await userId();
  if (!uid) return json({ error: "Sign in required" }, 401);
  await sql`DELETE FROM users WHERE id = ${uid}`;
  await clearSession();
  return json({ ok: true });
}
