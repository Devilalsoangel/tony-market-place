import fs from 'fs';
import path from 'path';

const ROOT = 'C:/Users/TONI/projects/social-commerce';

function walk(d, out = []) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) { if (!/node_modules|\.expo|\.git/.test(p)) walk(p, out); }
    else if (/\.(tsx?|jsx?)$/.test(f)) out.push(p);
  }
  return out;
}

// 1. Who links into app/admin/*?
console.log('== LINKS INTO /admin/* ==');
for (const p of walk(path.join(ROOT, 'Frontend'))) {
  const c = fs.readFileSync(p, 'utf8');
  const lines = c.split(/\r?\n/);
  lines.forEach((l, i) => {
    if (/['"\/]admin\/(reports|verify)|router\.push\(['"`]\/admin/.test(l)) {
      console.log(p.replace(ROOT, '') + ':' + (i + 1) + ': ' + l.trim().slice(0, 110));
    }
  });
}

// 2. Referral fields anywhere in schema
console.log('\n== REFERRAL IN SCHEMA ==');
const schema = fs.readFileSync(path.join(ROOT, 'susej-admin-panel/prisma/schema.prisma'), 'utf8');
schema.split(/\r?\n/).forEach((l, i) => {
  if (/referral|Referral|referred/i.test(l)) console.log((i + 1) + ': ' + l.trim());
});

// 3. AuthContext referral context
console.log('\n== AUTHCONTEXT REFERRAL BLOCK ==');
const auth = fs.readFileSync(path.join(ROOT, 'Frontend/contexts/AuthContext.tsx'), 'utf8');
const al = auth.split(/\r?\n/);
for (let i = 175; i < Math.min(215, al.length); i++) console.log((i + 1) + ': ' + al[i]);

// 4. Commission admin save format
console.log('\n== COMMISSION ADMIN PAGE ==');
const comm = fs.readFileSync(path.join(ROOT, 'susej-admin-panel/src/app/dashboard/commission/page.tsx'), 'utf8');
comm.split(/\r?\n/).forEach((l, i) => {
  if (/commissionRate|percent|save|PUT|POST|/i.test(l) && /commissionRate|rate/i.test(l)) console.log((i + 1) + ': ' + l.trim().slice(0, 120));
});

// 5. orders/route.ts price computation region
console.log('\n== ORDERS ROUTE 100-282 ==');
const ord = fs.readFileSync(path.join(ROOT, 'susej-admin-panel/src/app/api/app/orders/route.ts'), 'utf8');
const ol = ord.split(/\r?\n/);
for (let i = 99; i < Math.min(282, ol.length); i++) console.log((i + 1) + ': ' + ol[i]);
