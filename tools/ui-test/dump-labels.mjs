// Read-only UI dump parser: lists text/desc/clickable/focusable nodes with tap centers.
// Usage: node dump-labels.mjs [path-to-ui.xml]
import fs from 'node:fs';
const file = process.argv[2] ?? new URL('./ui.xml', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const xml = fs.readFileSync(file, 'utf8');
const re = /<node[^>]*?\btext="([^"]*)"[^>]*?\bcontent-desc="([^"]*)"[^>]*?\bclickable="(true|false)"[^>]*?\bfocusable="(true|false)"[^>]*?\bbounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?\/?>/g;
let m;
const seen = new Set();
while ((m = re.exec(xml))) {
  const [, text, desc, clickable, focusable, l, t, r, b] = m;
  const label = (text || desc || '').trim();
  if (!label) continue;
  const cx = Math.round((Number(l) + Number(r)) / 2);
  const cy = Math.round((Number(t) + Number(b)) / 2);
  const tags = [];
  if (clickable === 'true') tags.push('CLICK');
  if (focusable === 'true') tags.push('FOCUS');
  if (desc) tags.push('DESC');
  const tag = tags.length ? tags.join('+') : '[text]';
  const key = tag + label;
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(`${tag} ${label} | tap(${cx},${cy})`);
}
if (!seen.size) console.log('NO-LABELED-NODES');
