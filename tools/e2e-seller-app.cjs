// e2e-seller-app.cjs - E2E: app-session -> POST seller app w/ docs -> deployed admin -> DB ground truth
// Uses raw `pg` (the generated Prisma client is TS-only; pg is a direct dep of the admin panel).
const ADMIN_DIR = "C:/Users/TONI/projects/social-commerce/susej-admin-panel";
const envText = require("fs").readFileSync(ADMIN_DIR + "/.env", "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { Client } = require(ADMIN_DIR + "/node_modules/pg");
const prisma = new Client({ connectionString: process.env.DATABASE_URL });
const q = (text, values) => prisma.query(text, values);
const https = require("https");

const ADMIN = "https://susej-admin-panel.vercel.app";
const APP_KEY = process.env.E2E_APP_KEY || "dev-key";
const USERNAME = "e2e_seller_" + Date.now().toString(36);
const USER_ID = "e2e-user-" + Date.now().toString(36);
const SELLER_ROW_ID = `app_${USERNAME}`;

function post(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data), ...headers },
      timeout: 20000,
    }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => resolve({ status: res.statusCode, body: d.slice(0, 500) }));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.write(data); req.end();
  });
}

(async () => {
  try {
    await prisma.connect();
    // 1) create a real app user + session in the admin DB (mirrors app OTP login)
    const phone = "9999" + String(Date.now()).slice(-6);
    const email = `${USERNAME}@e2e.test`;
    const u = await q(
      `INSERT INTO "User" (id, name, email, role, status, phone, username, "walletBalance", "loyaltyPoints")
       VALUES ($1,$2,$3,'buyer','active',$4,$5,0,0) RETURNING id, phone`,
      [USER_ID, "E2E Seller Test", email, phone, USERNAME]
    );
    const user = u.rows[0];
    console.log("1. user row:", user.id, USERNAME);

    const token = `susej_e2e_${require("crypto").randomBytes(24).toString("base64url")}`;
    await q(
      `INSERT INTO "AppSession" (id, token, "userId", username, "expiresAt")
       VALUES ($1,$2,$3,$4,$5)`,
      ["e2e-sess-" + Date.now().toString(36), token, user.id, USERNAME, new Date(Date.now() + 86400000)]
    );
    console.log("2. app session created (token ..." + token.slice(-8) + ")");

    // 2) EXACT app payload from adminSync.syncSellerApplicant
    const payload = {
      id: SELLER_ROW_ID,
      businessName: "E2E Test Store",
      ownerName: "E2E Seller Test",
      logo: "",
      email,
      phone,
      address: "",
      category: "Grocery",
      storeLat: 12.9716, storeLng: 77.5946, storeAddress: "MG Road, Bengaluru",
      taxId: "",
      kycStatus: "pending",
      gstStatus: "pending",
      score: 0,
      productsCount: 0,
      joinedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      documents: [
        { id: `doc_${Date.now()}_0`, type: "government_id", label: "Aadhaar front", fileName: "aadhaar.jpg", url: "https://susej-admin-panel.vercel.app/uploads/e2e-aadhaar.jpg", uploadedAt: new Date().toISOString(), verified: false },
        { id: `doc_${Date.now()}_1`, type: "store_logo", label: "Store logo", fileName: "logo.png", url: "https://susej-admin-panel.vercel.app/uploads/e2e-logo.png", uploadedAt: new Date().toISOString(), verified: false },
      ],
      auditLogs: [],
    };

    // 3) POST to the deployed admin panel like the app does
    const res = await post(`${ADMIN}/api/data/sellers`, {
      "x-app-key": APP_KEY,
      "Authorization": `Bearer ${token}`,
    }, payload);
    console.log("3. deployed POST /api/data/sellers ->", res.status, res.body.slice(0, 200));

    // 4) DB ground truth (Neon) - did the row + documents land?
    const r = await q(
      `SELECT s.id, s."kycStatus", s."gstStatus",
              (SELECT count(*) FROM "SellerDocument" d WHERE d."sellerId" = s.id) AS docs
       FROM "Seller" s WHERE s.id = $1`,
      [SELLER_ROW_ID]
    );
    const row = r.rows[0];
    if (row) {
      console.log(`4. DB: seller row EXISTS | kycStatus=${row.kycStatus} | documents=${row.docs}`);
      const docs = await q(`SELECT type, "fileName", url FROM "SellerDocument" WHERE "sellerId" = $1`, [SELLER_ROW_ID]);
      docs.rows.forEach(d => console.log(`   doc: ${d.type} | ${d.fileName} | ${String(d.url).slice(0, 60)}`));
    } else {
      console.log("4. DB: seller row NOT found (POST did not persist)");
    }

    // 5) cleanup test rows (keep DB clean) unless KEEP env set
    if (!process.env.E2E_KEEP) {
      await q(`DELETE FROM "SellerDocument" WHERE "sellerId" = $1`, [SELLER_ROW_ID]).catch(() => {});
      await q(`DELETE FROM "Seller" WHERE id = $1`, [SELLER_ROW_ID]).catch(() => {});
      await q(`DELETE FROM "AppSession" WHERE "userId" = $1`, [user.id]).catch(() => {});
      await q(`DELETE FROM "User" WHERE id = $1`, [user.id]).catch(() => {});
      console.log("5. cleanup done (set E2E_KEEP=1 to keep rows)");
    } else {
      console.log("5. rows kept for manual inspection (E2E_KEEP=1)");
    }
    await prisma.end();
    process.exit(row && Number(row.docs) > 0 ? 0 : 2);
  } catch (e) {
    console.error("E2E ERROR:", e.message);
    process.exit(1);
  }
})();