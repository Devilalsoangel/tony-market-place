// Find OTP input boxes in UI dump
import fs from 'node:fs';
const xml = fs.readFileSync(process.argv[2] ?? 'tools/ui-test/ui.xml', 'utf8');

// Find all EditText nodes
const editRe = /<node[^>]*?class="android\.widget\.EditText"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;
let m;
console.log('=== EditText (input boxes) ===');
while ((m = editRe.exec(xml))) {
  const [l, t, r, b] = m.slice(1).map(Number);
  console.log(`box at [${l},${t}][${r},${b}] center=(${Math.round((l+r)/2)},${Math.round((t+b)/2)})`);
}

// Find all clickable nodes in OTP area
const clickRe = /<node[^>]*?clickable="true"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;
console.log('\n=== Clickable in OTP area (y=700-1100) ===');
while ((m = clickRe.exec(xml))) {
  const [l, t, r, b] = m.slice(1).map(Number);
  const cx = Math.round((l+r)/2), cy = Math.round((t+b)/2);
  if (cy > 700 && cy < 1100) console.log(`clickable at (${cx},${cy})`);
}
