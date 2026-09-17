import fs from "fs";

const schema = fs.readFileSync("C:/Users/TONI/projects/social-commerce/susej-admin-panel/prisma/schema.prisma", "utf8");
const lines = schema.split(/\r?\n/);
lines.forEach((x, i) => { if (/referral/i.test(x)) console.log((i + 1) + ": " + x); });
console.log("=== models ===");
lines.forEach((x) => { if (/^model /.test(x)) console.log(x); });

console.log("\n=== orders/[id]/route.ts money block ===");
const c = fs.readFileSync("C:/Users/TONI/projects/social-commerce/susej-admin-panel/src/app/api/app/orders/[id]/route.ts", "utf8");
const l = c.split(/\r?\n/);
for (let i = 95; i < 152; i++) console.log((i + 1) + ": " + l[i]);
