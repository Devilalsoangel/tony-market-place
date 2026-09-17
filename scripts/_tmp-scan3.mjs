import fs from "fs";
import path from "path";

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
        if (/role\s*[:=]/.test(x) || /verification\s*[:=]\s*['"]/.test(x)) {
          hits.push(fp.replace(/.*api.app./, "") + ":" + (i + 1) + ": " + x.trim().slice(0, 120));
        }
      });
    }
  }
};
walk(d);
console.log(hits.join("\n") || "(no hits)");
