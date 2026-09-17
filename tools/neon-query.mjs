#!/usr/bin/env node
// neon-query.mjs - run SQL against Neon (env NEON_URL or arg 2), print rows as JSON
import pg from 'pg';
const url = process.env.NEON_URL || process.argv[2];
const sql = process.argv[3] || 'select 1 as ok';
if (!url) { console.error('usage: NEON_URL=... node neon-query.mjs "<sql>"'); process.exit(4); }
const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  const r = await client.query(sql);
  console.log(JSON.stringify(r.rows, null, 1));
  await client.end();
  process.exit(0);
} catch (e) {
  console.error('DB FAIL: ' + (e.message || e).slice(0, 400));
  try { await client.end(); } catch {}
  process.exit(1);
}