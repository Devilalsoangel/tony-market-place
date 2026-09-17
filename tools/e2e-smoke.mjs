// tools/e2e-smoke.mjs — REAL-STACK FOUNDATION PROOF (the crowd-test base)
// Proves the production data path the app ACTUALLY uses:
//   app API (http://127.0.0.1:3000/api/app/*) -> Prisma -> Postgres
// Flow: fresh register (OTP devCode) -> verify -> token -> me -> wallet GET ->
//       topup -> wallet GET reflects -> feed GET -> categories.
// Usage: node tools/e2e-smoke.mjs [phone]
import fs from "node:fs";
import path from "node:path";
const BASE = "http://127.0.0.1:3000";
const phone = process.argv[2] || "9198000000" + String(process.pid).slice(-2);
let pass = 0, fail = 0;
const ok = (c, label, extra = "") => { console.log((c ? "PASS" : "FAIL") + " " + label + (extra ? " | " + extra : "")); c ? pass++ : fail++; };
async function j(method, p, body, headers = {}) {
  const res = await fetch(BASE + p, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}
// 1) request OTP
const otp = await j("POST", "/api/app/auth", { phone });
ok(otp.status === 200 && (otp.data?.devCode || otp.data?.ok), "AUTH: OTP request", `status=${otp.status} dev=${otp.data?.devCode ? "yes" : "no"}`);
const code = otp.data?.devCode || "";
// 2) verify OTP -> token
const ver = await j("POST", "/api/app/auth/verify", { phone, code: String(code) });
ok(ver.status === 200 && typeof ver.data?.token === "string", "AUTH: OTP verify -> token", `phone=${phone}`);
const token = ver.data?.token || "";
const H = { Authorization: `Bearer ${token}` };
// 3) me
const me = await j("GET", "/api/app/users/me", null, H);
ok(me.status === 200 && me.data?.user, "AUTH: /users/me", me.data?.user ? `user=${me.data.user.username}` : `status=${me.status}`);
// 4) wallet GET
const w1 = await j("GET", "/api/app/wallet", null, H);
ok(w1.status === 200 && typeof w1.data?.balance === "number", "WALLET: GET balance", `bal=${w1.data?.balance}`);
// 5) wallet topup (real ledger write)
const top = await j("POST", "/api/app/wallet", { amount: 100, type: "topup" }, H);
ok(top.status === 200 && typeof top.data?.balance === "number", "WALLET: topup 100", `newBal=${top.data?.balance}`);
const w2 = await j("GET", "/api/app/wallet", null, H);
ok(w2.status === 200 && w2.data?.balance === (w1.data?.balance ?? 0) + 100, "WALLET: balance increased by 100", `before=${w1.data?.balance} after=${w2.data?.balance}`);
// 6) feed
const feed = await j("GET", "/api/app/posts", null, H);
ok(feed.status === 200, "FEED: GET /posts", Array.isArray(feed.data?.posts) ? `posts=${feed.data.posts.length}` : (feed.data?.posts ? "posts key ok" : `status=${feed.status}`));
// 7) categories
const cat = await j("GET", "/api/app/categories", null, { "x-app-key": "dev-key" });
ok(cat.status === 200 && Array.isArray(cat.data?.categories), "CATEGORIES: GET (app-key)", Array.isArray(cat.data?.categories) ? `count=${cat.data.categories.length}` : `status=${cat.status}`);
// 8) 401 without token (honest auth gate)
const anon = await j("GET", "/api/app/wallet");
ok(anon.status === 401, "AUTH: wallet 401 without token", `status=${anon.status}`);
console.log(`\nE2E SMOKE: ${pass} passed, ${fail} failed (phone ${phone})`);
process.exitCode = fail ? 1 : 0;