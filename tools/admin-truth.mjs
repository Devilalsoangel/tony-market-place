// tools/admin-truth.mjs — admin login (password + 2FA) then read live Postgres truth via /api/data/*
// Usage: node tools/admin-truth.mjs [resource1 resource2 ...]   (default: core counts)
const BASE = "http://127.0.0.1:3000";
const ID = "alexrivera";
const PASS = "Admin@123";
const TFA = "123456";
let cookie = "";
async function j(method, p, body) {
  const res = await fetch(BASE + p, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  console.log(`[${p}] status=${res.status} set-cookie=${JSON.stringify(res.headers.getSetCookie ? res.headers.getSetCookie() : [])}`);
  for (const c of res.headers.getSetCookie ? res.headers.getSetCookie() : []) {
    const kv = c.split(";")[0];
    const [k] = kv.split("=");
    if (/session|challenge|admin/i.test(k)) cookie = cookie.split(";").filter(x => !x.trim().startsWith(k + "=")).join(";") + ";" + kv;
  }
  let d = null; try { d = await res.json(); } catch { d = await res.text(); }
  console.log(`[${p}] body=${JSON.stringify(d)?.slice?.(0, 200)}`);
  return { status: res.status, data: d };
}
const r1 = await j("POST", "/api/login", { loginId: ID, password: PASS });
if (r1.data?.twoFactor) {
  console.log("ADMIN LOGIN: password OK, 2FA required -> verifying");
  const r2 = await j("POST", "/api/login/verify-2fa", { code: TFA });
  console.log(`ADMIN 2FA: status=${r2.status} token=${r2.data?.token ? "yes" : "no"}`);
  if (r2.status !== 200 || !r2.data?.token) process.exit(1);
} else if (r1.status === 200) {
  console.log(`ADMIN LOGIN: OK (no 2FA) token=${r1.data?.token ? "yes" : "no"}`);
  if (!r1.data?.token) process.exit(1);
} else {
  console.log(`ADMIN LOGIN FAILED: status=${r1.status} ${r1.data?.error || ""}`);
  process.exit(1);
}
console.log("cookie after full login:", cookie.slice(0, 60) + "...");
const resources = process.argv.slice(2).length ? process.argv.slice(2) : ["users", "posts", "products", "orders", "sellers", "reviews", "wallet-transactions"];
for (const r of resources) {
  const { status, data } = await j("GET", "/api/data/" + r);
  const rows = Array.isArray(data?.rows) ? data.rows.length : data?.rows ? Object.keys(data.rows).length : 0;
  console.log(`${r}: status=${status} rows=${rows}` + (rows > 0 && r === "users" ? ` first=${data.rows[0]?.username || data.rows[0]?.loginId || data.rows[0]?.name || ""}` : ""));
}