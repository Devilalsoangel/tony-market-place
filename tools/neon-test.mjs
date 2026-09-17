#!/usr/bin/env node
// neon-test.mjs - verify Neon connectivity using the connection string (env NEON_URL or arg)
import pg from 'pg';
const url = process.env.NEON_URL || process.argv[2];
if (!url) { console.error('usage: node neon-test.mjs "<connection-string>"'); process.exit(4); }
const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  const r = await client.query('SELECT version() as v, current_database() as db, current_user() as u');
  console.log('NEON OK | ' + JSON.stringify(r.rows[0]));
  await client.end();
  process.exit(0);
} catch (e) {
  console.error('NEON FAIL: ' + (e.message || e).slice(0, 300));
  try { await client.end(); } catch {}
  process.exit(1);
}