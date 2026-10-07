// One-off, idempotent: copies verified Wayfare accounts (wf_users) and their synced trips (wf_sync) into the unified
// users / trip_sync tables, matching on email. An email that already has a Flight Finder account keeps that account's
// password and gains the trips. The wf_* tables are left untouched so this can be re-run or rolled back.
// Run after `npm run migrate`: node --env-file=.env.local scripts/import-wayfare.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const users = await sql`
  INSERT INTO users (email, password_hash, email_verified, created_at)
  SELECT email, password_hash, TRUE, created_at FROM wf_users WHERE email_verified
  ON CONFLICT (email) DO NOTHING RETURNING id`;
const trips = await sql`
  INSERT INTO trip_sync (user_id, rev, doc, updated_at)
  SELECT u.id, s.rev, s.doc, s.updated_at
  FROM wf_sync s JOIN wf_users w ON w.id = s.user_id AND w.email_verified JOIN users u ON u.email = w.email
  ON CONFLICT (user_id) DO NOTHING RETURNING user_id`;
console.log(`imported ${users.length} new users, ${trips.length} trip documents`);
console.log("REMINDER: rotate JWT_SECRET at cutover. Old Wayfare session cookies carry wf_users ids, which are different people in `users`.");
