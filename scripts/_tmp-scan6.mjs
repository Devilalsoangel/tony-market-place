import fs from "fs";
import path from "path";

const schema = fs.readFileSync("C:/Users/TONI/projects/social-commerce/susej-admin-panel/prisma/schema.prisma", "utf8");
const oi = schema.indexOf("model Order ");
console.log("=== Order model ===");
console.log(schema.slice(oi, oi + 1300));

console.log("\n=== toAppUser ===");
const auth = fs.readFileSync("C:/Users/TONI/projects/social-commerce/susej-admin-panel/src/lib/app-auth.ts", "utf8");
const ai = auth.indexOf("export function toAppUser");
console.log(auth.slice(ai, ai + 1400));

console.log("\n=== findUserByPhone callers ===");
const d = "C:/Users/TONI/projects/social-commerce/susej-admin-panel/src";
const hits = [];
const walk = (dir) => {
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    const st = fs.statSync(fp);
    if (st.isDirectory()) walk(fp);
    else if (/\.(ts|tsx)$/.test(f)) {
      const c = fs.readFileSync(fp, "utf8");
      const l = c.split(/\r?\n/);
      l.forEach((x, i) => {
        if (/findUserByPhone/.test(x)) hits.push(fp.replace(/.*src./, "") + ":" + (i + 1) + ": " + x.trim().slice(0, 110));
      });
    }
  }
};
walk(d);
console.log(hits.join("\n") || "(none)");
