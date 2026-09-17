import fs from "fs";
import path from "path";

// Scan Frontend for admin-route references + role semantics
const roots = [
  "C:/Users/TONI/projects/social-commerce/Frontend/app",
  "C:/Users/TONI/projects/social-commerce/Frontend/utils",
  "C:/Users/TONI/projects/social-commerce/Frontend/contexts",
  "C:/Users/TONI/projects/social-commerce/Frontend/components",
];
const hits = [];
const walk = (d) => {
  let entries;
  try { entries = fs.readdirSync(d); } catch { return; }
  for (const f of entries) {
    const fp = path.join(d, f);
    let st;
    try { st = fs.statSync(fp); } catch { continue; }
    if (st.isDirectory()) walk(fp);
    else if (/\.(tsx?|jsx?)$/.test(f)) {
      const c = fs.readFileSync(fp, "utf8");
      const l = c.split(/\r?\n/);
      l.forEach((x, i) => {
        if (/['"`]\/?admin\//.test(x) || /role\s*===?\s*['"`]admin/.test(x) || /isAdmin/.test(x)) {
          hits.push(fp.replace(/.*social-commerce./, "") + ":" + (i + 1) + ": " + x.trim().slice(0, 120));
        }
      });
    }
  }
};
roots.forEach(walk);
console.log(hits.slice(0, 50).join("\n") || "(no hits)");

// Scan admin panel app-auth for role field shape
console.log("\n=== app-auth.ts ===");
const auth = fs.readFileSync("C:/Users/TONI/projects/social-commerce/susej-admin-panel/src/lib/app-auth.ts", "utf8");
console.log(auth.slice(0, 2600));
