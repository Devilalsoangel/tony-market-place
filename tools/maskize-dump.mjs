// neonize-dump.mjs - strip psql meta + OWNER TO lines from a PG dump for Neon restore
import fs from 'fs';
const src = process.argv[2];
const dst = process.argv[3];
const txt = fs.readFileSync(src, 'utf8');
const lines = txt.split(/\r?\n/);
const kept = lines.filter((l) => !/^\\(?:un)?restrict\s/.test(l) && !/OWNER TO \w+/.test(l));
fs.writeFileSync(dst, kept.join('\n'), 'utf8');
console.log('wrote ' + dst + ' (' + txt.length + ' -> ' + kept.join('\n').length + ' bytes, dropped ' + (lines.length - kept.length) + ' lines)');