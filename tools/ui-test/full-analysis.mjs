// COMPLETE analysis of ALL elements in a UI dump
import fs from 'node:fs';
const xml = fs.readFileSync(process.argv[2] ?? 'tools/ui-test/ui.xml', 'utf8');

console.log('========== ALL CLICKABLE ELEMENTS ==========');
const clickRe = /<node[^>]*?clickable="true"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?\/?>/g;
let m;
while ((m = clickRe.exec(xml))) {
  const [l, t, r, b] = m.slice(1).map(Number);
  const cx = Math.round((l+r)/2), cy = Math.round((t+b)/2);
  const nodeStr = m[0];
  const textMatch = nodeStr.match(/text="([^"]*)"/);
  const descMatch = nodeStr.match(/content-desc="([^"]*)"/);
  const text = textMatch ? textMatch[1] : '';
  const desc = descMatch ? descMatch[1] : '';
  console.log(`CLICK (${cx},${cy}) text="${text}" desc="${desc}"`);
}

console.log('\n========== ALL EDIT TEXT (INPUTS) ==========');
const editRe = /<node[^>]*?class="android\.widget\.EditText"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?\/?>/g;
let i = 0;
while ((m = editRe.exec(xml))) {
  const [l, t, r, b] = m.slice(1).map(Number);
  const cx = Math.round((l+r)/2), cy = Math.round((t+b)/2);
  const nodeStr = m[0];
  const textMatch = nodeStr.match(/text="([^"]*)"/);
  const hintMatch = nodeStr.match(/hint="([^"]*)"/);
  const text = textMatch ? textMatch[1] : '';
  const hint = hintMatch ? hintMatch[1] : '';
  console.log(`INPUT ${i++} (${cx},${cy}) text="${text}" hint="${hint}"`);
}

console.log('\n========== ALL TEXT ELEMENTS ==========');
const textRe = /<node[^>]*?text="([^"]{1,80})"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?\/?>/g;
const seen = new Set();
while ((m = textRe.exec(xml))) {
  const text = m[1];
  const [l, t, r, b] = m.slice(2).map(Number);
  const cx = Math.round((l+r)/2), cy = Math.round((t+b)/2);
  const key = `${cx},${cy},${text}`;
  if (!seen.has(key) && text.trim()) {
    seen.add(key);
    console.log(`TEXT (${cx},${cy}) "${text}"`);
  }
}
