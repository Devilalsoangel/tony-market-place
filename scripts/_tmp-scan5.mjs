import fs from "fs";
import path from "path";

const schema = fs.readFileSync("C:/Users/TONI/projects/social-commerce/susej-admin-panel/prisma/schema.prisma", "utf8");
const ai = schema.indexOf("model Auction ");
console.log(schema.slice(ai, ai + 900));

console.log("\n=== user.create sites in api/app ===");
const d = "C:/Users/TONI/projects/social-commerce/susej-admin-panel/src/app/api/app";
const hits = [];
const walk = (dir) => {
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    const st = fs.statSync(fp);
    if (st.isDirectory()) walk(fp);
    else if (f.endsWith(".ts")) {
      const c = fs.readFileSync(fp, "utf8");
      const l = c.split(/\r?\n/);
      l.forEach((x, i) => {
        if (/user\.create\(|\.user\.createMany/.test(x)) {
          hits.push(fp.replace(/.*api.app./, "") + ":" + (i + 1) + ": " + x.trim().slice(0, 110));
        }
      });
    }
  }
};
walk(d);
console.log(hits.join("\n") || "(none)");
