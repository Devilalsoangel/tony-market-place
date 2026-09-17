// find-invisible-chars.cjs - locate invisible/zero-width chars in a file
const fs = require("fs");
const file = process.argv[2] || "C:/Users/TONI/projects/social-commerce/Frontend/app/(tabs)/explore.tsx";
const src = fs.readFileSync(file, "utf8");
const lines = src.split("\n");
const bad = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF\u00AD]/;
let found = 0;
lines.forEach((l, i) => {
  const m = l.match(new RegExp(bad.source, "g"));
  if (m) {
    found += m.length;
    console.log(`line ${i + 1} col ${l.search(bad) + 1}: ${m.map(c => "U+" + c.codePointAt(0).toString(16)).join(",")} | ...${l.slice(Math.max(0, l.search(bad) - 40), l.search(bad) + 40)}...`);
  }
});
console.log("total invisible chars:", found);