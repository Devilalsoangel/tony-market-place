// verify-invisible-clean.cjs - prove all invisible chars are gone from commit + build dir
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const bad = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF\u00AD]/;
let checked = 0, dirty = 0;
function check(p) {
  checked++;
  const c = fs.readFileSync(p, "utf8");
  if (bad.test(c)) { dirty++; console.log("STILL DIRTY:", p); }
}
// 1) files changed in the last commit (paths relative to repo root social-commerce)
try {
  const out = execSync("git diff-tree --no-commit-id --name-only -r HEAD", { cwd: "C:/Users/TONI/projects/social-commerce", encoding: "utf8" });
  for (const rel of out.split("\n").map(s => s.trim()).filter(Boolean)) {
    if (!/\.(ts|tsx|js|jsx|json)$/.test(rel)) continue;
    const p = path.join("C:/Users/TONI/projects/social-commerce", rel);
    if (fs.existsSync(p)) check(p);
  }
} catch (e) { console.log("git diff-tree failed:", e.message.slice(0, 100)); }
// 2) the standalone build dir EAS uploads
function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { if (!["node_modules", ".expo", "android", "ios", ".git"].includes(f.name)) walk(p); }
    else if (/\.(ts|tsx|js|jsx|json)$/.test(f.name)) check(p);
  }
}
walk("C:/Users/TONI/projects/social-commerce-build/app");
walk("C:/Users/TONI/projects/social-commerce-build/utils");
console.log(`checked ${checked} files, dirty: ${dirty}`);