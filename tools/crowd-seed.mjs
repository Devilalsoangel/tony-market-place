// tools/crowd-seed.mjs — REAL-FLOW MARKETPLACE SEED (the crowd-test baseline)
// Creates, through the app's own HTTP APIs: 1 seller (OTP+profile+listing)
// + 1 buyer (OTP+wallet topup) + 1 published post + mirrors to admin Product.
// Also verifies the same data is visible via admin session (cross-surface truth).
// Usage: node tools/crowd-seed.mjs
const BASE = "http://127.0.0.1:3000";
const PHONE_S = "9811110001";   // seller
const PHONE_B = "9822220002";   // buyer
const ADMIN_ID = "alexrivera", ADMIN_PASS = "Admin@123", ADMIN_TFA = "123456";
let pass = 0, fail = 0;
const ok = (c, label, extra = "") => { console.log((c ? "PASS" : "FAIL") + " " + label + (extra ? " | " + extra : "")); c ? pass++ : fail++; };
async function jsonReq(method, p, body, headers = {}, withRedirect = false) {
  const res = await fetch(BASE + p, {
    method, redirect: withRedirect ? "follow" : "manual",
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let d = null; try { d = await res.json(); } catch { d = null; }
  return { status: res.status, data: d, headers: res.headers };
}
async function appLogin(phone) {
  const o = await jsonReq("POST", "/api/app/auth", { phone });
  if (o.status !== 200 || !o.data?.devCode) return null;
  const v = await jsonReq("POST", "/api/app/auth/verify", { phone, code: o.data.devCode });
  return v.data?.token || null;
}
// ---- ADMIN SESSION (password + 2FA, full real flow) ----
let cookie = "";
async function adminReq(method, p, body) {
  const res = await fetch(BASE + p, {
    method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  for (const c of res.headers.getSetCookie ? res.headers.getSetCookie() : []) {
    const kv = c.split(";")[0]; const [k] = kv.split("=");
    if (/session|challenge/.test(k)) cookie = (cookie.split(";").filter(x => !x.trim().startsWith(k + "=")).join(";")) + ";" + kv;
  }
  let d = null; try { d = await res.json(); } catch {}
  return { status: res.status, data: d };
}
const a1 = await adminReq("POST", "/api/login", { loginId: ADMIN_ID, password: ADMIN_PASS });
if (a1.data?.twoFactor) await adminReq("POST", "/api/login/verify-2fa", { code: ADMIN_TFA });
ok(Boolean(cookie.includes("susej_session")), "ADMIN: login + 2FA session");
// --- SELLER (3-act: register -> KYC application -> admin approval) ---
const tS = await appLogin(PHONE_S);
ok(Boolean(tS), "AUTH: seller login", `phone=${PHONE_S}`);
const HS = { Authorization: `Bearer ${tS}` };
const meS = await jsonReq("GET", "/api/app/users/me", null, HS);
const unameS = meS.data?.user?.username || `s_${Date.now() % 1e6}`;
await jsonReq("PATCH", "/api/app/users/me", { name: "Riya Sharma", username: unameS, location: "Mumbai, India", businessName: "Riya Threadz", category: "Fashion", phone: PHONE_S }, HS);
// ACT 2: KYC application via the app-key sync surface (server forces kycStatus: pending;
// requires BOTH x-app-key and Bearer token; Seller required fields are defaulted server-side)
const kyc = await jsonReq("POST", "/api/data/sellers", {
  businessName: "Riya Threadz", ownerName: "Riya Sharma",
  category: "Fashion", address: "Mumbai, India",
}, { "x-app-key": "dev-key", Authorization: `Bearer ${tS}` });
const sellerId = kyc.data?.row?.id || "";
ok(kyc.status === 200 && Boolean(sellerId), "SELLER: KYC application submitted (server forces pending)", `id=${sellerId} status=${kyc.status}`);
// ACT 3: ADMIN approves the KYC application (the ONLY path that grants seller;
// server propagates verification+isSeller+role to the User row via phone link)
let approved = false;
if (sellerId) {
  const ap = await adminReq("PATCH", "/api/data/sellers", { id: sellerId, data: { kycStatus: "approved" } });
  approved = ap.status === 200;
  if (!approved) console.log("  approve-detail:", JSON.stringify(ap.data).slice(0, 200));
}
ok(approved, "ADMIN: KYC approved (grants seller)");
// RE-CHECK seller now sees isSeller
const meS2 = await jsonReq("GET", "/api/app/users/me", null, HS);
ok(meS2.data?.user?.isSeller === true, "SELLER: isSeller now true (admin grant reflected)");
// ACT 4: listing
const post = await jsonReq("POST", "/api/app/posts", {
  title: "Handloom Cotton Saree",
  description: "Authentic handloom cotton saree. Soft, breathable, everyday wear.",
  price: 1299, mrp: 1599, category: "Fashion",
  images: ["http://127.0.0.1:3000/products/saree-handloom.png"],
  type: "product", stockLeft: 10, condition: "New",
}, HS);
ok(post.status === 201 && post.data?.post?.id, "SELLER: listing created", `id=${post.data?.post?.id || ""}`);
const postId = post.data?.post?.id || "";
// --- BUYER ---
const tB = await appLogin(PHONE_B);
ok(Boolean(tB), "AUTH: buyer login", `phone=${PHONE_B}`);
const HB = { Authorization: `Bearer ${tB}` };
const top = await jsonReq("POST", "/api/app/wallet", { amount: 500, type: "topup" }, HB);
ok(top.status === 200, "BUYER: wallet topup 500", `bal=${top.data?.balance}`);
// --- CROSS-SURFACE TRUTH ---
const adminUsers = await adminReq("GET", "/api/data/users");
const adminPosts = await adminReq("GET", "/api/data/posts");
const adminProds = await adminReq("GET", "/api/data/products");
ok(adminUsers.status === 200 && (adminUsers.data?.rows || []).some((u) => u.username === unameS && u.isSeller === true), "ADMIN: user cross-sync isSeller=true", `users=${(adminUsers.data?.rows || []).length}`);
ok(adminPosts.status === 200 && (adminPosts.data?.rows || []).some((p) => p.id === postId), "ADMIN: post cross-sync", `posts=${(adminPosts.data?.rows || []).length}`);
ok(adminProds.status === 200 && (adminProds.data?.rows || []).some((p) => p.id === `lst_${postId}`), "ADMIN: product mirror (lst_*)", `products=${(adminProds.data?.rows || []).length}`);
console.log(`\nCROWD-SEED: ${pass} passed, ${fail} failed  | seller=${unameS} post=${postId}`);
process.exitCode = fail ? 1 : 0;