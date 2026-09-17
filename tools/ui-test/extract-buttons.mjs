// Extract every tappable element per screen from Frontend/app/*.tsx
// Output: JSON { screen: [ {line, label, handler} ] } -> tools/ui-test/buttons.json
// Usage: node tools/ui-test/extract-buttons.mjs
import fs from 'node:fs';
import path from 'node:path';

const APP = path.join(process.cwd(), 'Frontend', 'app');
const OUT = path.join(process.cwd(), 'tools', 'ui-test', 'buttons.json');

const TAPPABLE = /(TouchableOpacity|Pressable|TouchableHighlight|TouchableWithoutFeedback|Ripple|Button)\b/;
const ONPRESS = /onPress=\{([^}]+)\}/;

function labelOf(lines, i) {
  // search forward+backward a few lines for visible text: <Text>...</Text> or label= / title= / accessibilityLabel
  const ctx = lines.slice(Math.max(0, i - 8), i + 10).join('\n');
  const acc = ctx.match(/accessibilityLabel=["'`{]?([^"'`}]{2,60})/);
  if (acc) return acc[1].trim();
  const texts = [...ctx.matchAll(/<Text[^>]*>\s*([^<{]{2,50})\s*</g)].map(m => m[1].trim());
  if (texts.length) return texts[0];
  const label = ctx.match(/\b(?:label|title)=["'`{]?([^"'`}]{2,50})/);
  if (label) return label[1].trim();
  return '(unlabeled)';
}

const result = {};
for (const dir of [APP]) {
  walk(dir);
}
function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { walk(p); continue; }
    if (!/\.(tsx|ts)$/.test(f.name)) continue;
    const rel = path.relative(APP, p).replace(/\\/g, '/');
    const src = fs.readFileSync(p, 'utf8');
    const lines = src.split('\n');
    const hits = [];
    lines.forEach((ln, idx) => {
      if (TAPPABLE.test(ln) || /onPress=/.test(ln)) {
        const h = ln.match(ONPRESS);
        hits.push({ line: idx + 1, label: labelOf(lines, idx), handler: h ? h[1].slice(0, 80) : '(composite)' });
      }
    });
    if (hits.length) result[rel] = hits;
  }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
const screens = Object.keys(result).length;
const buttons = Object.values(result).reduce((a, b) => a + b.length, 0);
console.log(`screens with buttons: ${screens}, total tappables: ${buttons}`);
