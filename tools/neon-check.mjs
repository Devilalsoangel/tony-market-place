// neon-check.mjs - inspect Neon susej schema via pg
import { createRequire } from 'module';
const require = createRequire('C:/Users/TONI/projects/social-commerce/susej-admin-panel/package.json');
const { Client } = require('pg');

const url = 'postgresql://neondb_owner:npg_v8puCj2MZPIW@ep-gentle-haze-b31gtn74-pooler.c-4.ap-southeast-1.aws.neon.tech/susej?sslmode=require';
const c = new Client({ connectionString: url });
await c.connect();
const t = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
console.log('TABLES:', t.rows.map((r) => r.table_name).join(', '));
for (const [label, q] of [
  ['Admin', 'SELECT COUNT(*)::int AS n FROM "Admin"'],
  ['PrismaUser', 'SELECT COUNT(*)::int AS n FROM "User"'],
  ['apiUsers', 'SELECT COUNT(*)::int AS n FROM users'],
]) {
  try { const r = await c.query(q); console.log(label + ':', r.rows[0].n); }
  catch (e) { console.log(label + ': ERR ' + e.message.slice(0, 60)); }
}
await c.end();