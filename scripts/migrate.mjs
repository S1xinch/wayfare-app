// Applies db/schema.sql. Run: DATABASE_URL=... node scripts/migrate.mjs  (or npm run migrate with .env.local)
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'node:fs'

const sql = neon(process.env.DATABASE_URL)
const stmts = readFileSync('db/schema.sql', 'utf8').replace(/^--.*$/gm, '').split(/;\s*\n/).filter((s) => s.trim())
for (const s of stmts) await sql.query(s)
console.log('schema applied')
