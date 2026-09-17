// dump-meta.mjs - inspect psql meta-commands in a dump file (arg: path)
import fs from 'fs';
const p = process.argv[2];
const src = fs.readFileSync(p, 'utf8');
const lines = src.split(/\r?\n/);
const meta = lines.filter((l) => l.startsWith('\\')).map((l) => l.trim());
const counts = {};
for (const m of meta) counts[m] = (counts[m] || 0) + 1;
console.log('total lines:', lines.length);
console.log(JSON.stringify(counts, null, 1));