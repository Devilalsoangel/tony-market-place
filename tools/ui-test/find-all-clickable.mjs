// Find ALL clickable elements in notification screen
import fs from 'node:fs';
const xml = fs.readFileSync(process.argv[2] ?? 'tools/ui-test/ui.xml', 'utf8');

// Find ALL clickable nodes with their bounds and text/desc
const re = /<node[^>]*?clickable="true"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?\/?>/g;
let m;
console.log('=== ALL CLICKABLE ELEMENTS ===');
while ((m = re.exec(xml))) {
  const [l, t, r, b] = m.slice(1).map(Number);
  const cx = Math.round((l+r)/2), cy = Math.round((t+b)/2);
  // Extract text and content-desc from the node
  const nodeStr = m[0];
  const textMatch = nodeStr.match(/text="([^"]*)"/);
  const descMatch = nodeStr.match(/content-desc="([^"]*)"/);
  const text = textMatch ? textMatch[1] : '';
  const desc = descMatch ? descMatch[1] : '';
  console.log(`(${cx},${cy}) text="${text}" desc="${desc}"`);
}

// Also find the back button (usually a ChevronLeft or arrow)
const backRe = /<node[^>]*?(?:ChevronLeft|back|arrow|Back)[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?\/?>/gi;
console.log('\n=== BACK/BACK-LIKE ELEMENTS ===');
while ((m = backRe.exec(xml))) {
  const [l, t, r, b] = m.slice(1).map(Number);
  console.log(`back-like at (${Math.round((l+r)/2)},${Math.round((t+b)/2)})`);
}
