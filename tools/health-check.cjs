// health-check.cjs - verify Railway backend + Vercel admin endpoints
const https = require("https");
function get(url) {
  return new Promise(res => {
    const req = https.get(url, { timeout: 12000 }, r => {
      let d = ""; r.on("data", c => d += c); r.on("end", () => res({ code: r.statusCode, body: d.slice(0, 200) }));
    });
    req.on("error", e => res({ code: "ERR", body: e.message }));
    req.on("timeout", () => { req.destroy(); res({ code: "TIMEOUT", body: "" }); });
  });
}
(async () => {
  const B = "https://susej-backend-production.up.railway.app";
  const A = "https://susej-admin-panel.vercel.app";
  for (const [label, url] of [
    ["backend root", B + "/"],
    ["backend docs", B + "/docs"],
    ["backend openapi", B + "/openapi.json"],
    ["backend health", B + "/health"],
    ["backend api/health", B + "/api/health"],
    ["admin home", A + "/"],
    ["admin login", A + "/login"],
    ["admin data sellers (unauth)", A + "/api/data/sellers"],
  ]) {
    const r = await get(url);
    console.log(label.padEnd(28), r.code, "|", r.body.replace(/\n/g, " ").slice(0, 100));
  }
  process.exit(0);
})();