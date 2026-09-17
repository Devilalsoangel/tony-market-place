// db-audit.mjs - audit sellers/documents + find fake data in Neon susej db
import { createRequire } from 'module';
const require = createRequire('C:/Users/TONI/projects/social-commerce/susej-admin-panel/package.json');
const { Client } = require('pg');

const url = 'postgresql://neondb_owner:npg_v8puCj2MZPIW@ep-gentle-haze-b31gtn74-pooler.c-4.ap-southeast-1.aws.neon.tech/susej?sslmode=disable';
const c = new Client({ connectionString: url, connectionTimeoutMs: 20000, sslmode: 'disable' });

async function q(label, sql) {
  try {
    const r = await c.query(sql);
    console.log(`\n=== ${label} ===`);
    console.log(JSON.stringify(r.rows, null, 1).slice(0, 4000));
  } catch (e) { console.log(`\n=== ${label} === ERR: ${e.message.slice(0,120)}`); }
}

try {
  await c.connect();
} catch (e) {
  console.log('CONNECT ERR: ' + e.message.slice(0, 300));
  process.exit(1);
}

await q('TABLES', `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);

await q('SELLERS rows', `SELECT id, "businessName", "ownerName", "kycStatus", "gstStatus", "productsCount", "joinedAt" FROM "Seller" ORDER BY "joinedAt" DESC LIMIT 20`);

await q('SELLER_DOCS count', `SELECT "sellerId", COUNT(*)::int AS docs, COUNT(*) FILTER (WHERE "verified")::int AS verified FROM "SellerDocument" GROUP BY "sellerId"`);

await q('Books/Services', `SELECT COUNT(*)::int AS n FROM "Booking"`);

await q('Orders', `SELECT COUNT(*)::int AS n FROM "Order"`);

await q('Users', `SELECT id, "fullName", "username", "isSeller", "createdAt" FROM "User" ORDER BY "createdAt" DESC LIMIT 25`);

await q('App users (api)', `SELECT id, name, username, email, "isSeller", verification, "createdAt" FROM users ORDER BY "createdAt" DESC LIMIT 25`);

await c.end();
process.exit(0);