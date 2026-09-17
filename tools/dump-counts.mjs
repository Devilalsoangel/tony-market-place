// dump-counts.mjs - count COPY rows per table in a pg_dump plain SQL file (arg: path)
import fs from 'fs';
const p = process.argv[2];
const src = fs.readFileSync(p, 'utf8');
const lines = src.split(/\r?\n/);
const tableCounts = {};
let curTable = null;
let inCopy = false;
let cols = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const cm = l.match(/^COPY public\.([^ ]+) \((.*)\) FROM stdin;$/);
  if (cm) {
    curTable = cm[1];
    cols = cm[2].split(',').length;
    inCopy = true;
    tableCounts[curTable] = 0;
    // figure out if the copy uses data rows or \N -> just count lines until \.
  }
  if (inCopy && curTable) {
    if (l.trim() === '\\.') { inCopy = false; curTable = null; continue; }
    // count only data lines that are not meta; COPY rows are tab-separated, so require tabs when cols>1
    if (cols > 1) { if (l.includes('\t')) tableCounts[curTable]++; }
    else if (l.trim() !== '') tableCounts[curTable]++;
  }
}
const entries = Object.entries(tableCounts).sort((a, b) => b[1] - a[1]);
console.log('TO_TABLE COUNTS (dump):');
for (const [t, c] of entries) console.log('  ' + t.padEnd(30) + c);
console.log('tables total:', entries.length);