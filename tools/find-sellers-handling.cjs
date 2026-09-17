// find-sellers-handling.cjs - locate POST seller handling in the route
const fs = require("fs");
const c = fs.readFileSync("C:/Users/TONI/projects/social-commerce/susej-admin-panel/src/app/api/data/[resource]/route.ts", "utf8");
const lines = c.split("\n");
lines.forEach((l, i) => {
  if (/\bsellers\b|document/i.test(l)) console.log((i + 1) + ": " + l.trim().slice(0, 150));
});