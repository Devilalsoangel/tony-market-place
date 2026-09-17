// tools/db-truth.mjs — live Postgres truth through the admin data API (same surface the app syncs to)
// Usage: node tools/db-truth.mjs [resource]   (default: core table counts)
import fs from "node:fs";
import path from "node:path";
const BASE = "http://127.0.0.1:3000";
const KEY = "dev-key";
const resource = process.argv[2] || "counts";
async function get(r) {
  const res = await fetch(`${BASE}/api/data/${r}`, { headers: { "x-app-key": KEY } });
  let d = null; try { d = await res.json(); } catch {}
  return { status: res.status, data: d };
}
if (resource === "counts") {
  for (const r of ["users", "posts", "products", "orders", "sellers", "reviews", "wallet-transactions"]) {
    const { status, data } = await get(r);
    const rows = Array.isArray(data?.rows) ? data.rows.length : data?.rows ? Object.keys(data.rows).length : 0;
    console.log(`${r}: status=${status} rows=${rows}`);
  }
} else {
  const { status, data } = await get(resource);
  console.log(JSON.stringify(data, null, 1)?.slice?.(0, 1500) || `status=${status}`);
  console.log(`\nrows=${Array.isArray(data?.rows) ? data.rows.length : "n/a"}`);
}