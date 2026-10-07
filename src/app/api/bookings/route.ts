import { userId } from "@/lib/auth";
import { dec, enc } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { json } from "@/lib/http";

export async function GET() {
  const uid = await userId();
  if (!uid) return json({ error: "Sign in required" }, 401);
  const rows = await sql`
    SELECT id, flight_data, confirmation_number, total_price::float8 AS total_price, booked_at
    FROM bookings WHERE user_id = ${uid} ORDER BY booked_at DESC`;
  return json(
    rows.flatMap((r) => {
      try {
        return [{ id: r.id, ...JSON.parse(dec(r.flight_data)), confirmation: dec(r.confirmation_number), totalPrice: r.total_price, bookedAt: r.booked_at }];
      } catch (e) {
        // e.g. the row was encrypted with a different ENCRYPTION_KEY: skip it so one bad record cannot break the whole list
        console.error(`booking ${r.id} could not be decrypted`, e);
        return [];
      }
    }),
  );
}

/** Users record bookings they made on partner sites. Flight details and confirmation are encrypted at rest. */
export async function POST(req: Request) {
  const uid = await userId();
  if (!uid) return json({ error: "Sign in required" }, 401);
  const b = await req.json().catch(() => ({}));
  const confirmation = String(b.confirmation ?? "").trim().slice(0, 40);
  const airline = String(b.airline ?? "").trim().slice(0, 80);
  const route = String(b.route ?? "").trim().slice(0, 80);
  const date = String(b.date ?? "").slice(0, 10);
  const total = b.totalPrice === "" || b.totalPrice == null ? null : Number(b.totalPrice);
  if (!confirmation || !airline || !route) return json({ error: "Confirmation number, airline and route are required." }, 400);
  if (total !== null && !(total >= 0)) return json({ error: "Total price must be a number." }, 400);
  await sql`
    INSERT INTO bookings (user_id, flight_data, confirmation_number, total_price)
    VALUES (${uid}, ${enc(JSON.stringify({ airline, route, date }))}, ${enc(confirmation)}, ${total})`;
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  const uid = await userId();
  if (!uid) return json({ error: "Sign in required" }, 401);
  await sql`DELETE FROM bookings WHERE id = ${Number(new URL(req.url).searchParams.get("id"))} AND user_id = ${uid}`;
  return json({ ok: true });
}
