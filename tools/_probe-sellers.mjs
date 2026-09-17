const BASE = "http://127.0.0.1:3000";
async function j(m, p, b, h) {
  const r = await fetch(BASE + p, { method: m, headers: { "Content-Type": "application/json", ...(h || {}) }, body: b ? JSON.stringify(b) : undefined });
  const txt = await r.text();
  let d = null; try { d = JSON.parse(txt); } catch {}
  return { status: r.status, data: d, txt: txt.slice(0, 300) };
}
(async () => {
  const o = await j("POST", "/api/app/auth", { phone: "9811110001" });
  console.log("OTP req:", o.status, o.txt);
  if (!o.data?.devCode) { console.log("STOP — no devCode"); return; }
  const v = await j("POST", "/api/app/auth/verify", { phone: "9811110001", code: o.data.devCode });
  console.log("Verify:", v.status, (v.txt || "").slice(0, 200));
  const T = v.data?.token;
  if (!T) { console.log("STOP — no token"); return; }
  const k = await j("POST", "/api/data/sellers", { businessName: "Riya Threadz", ownerName: "Riya Sharma", category: "Fashion", address: "Mumbai, India", documents: [] }, { "x-app-key": "dev-key", Authorization: `Bearer ${T}` });
  console.log("KYC POST:", k.status, (k.txt || "").slice(0, 600));
  console.log("FULL ERROR:", JSON.stringify(k.data?.detail || "").slice(0, 1500));
})();