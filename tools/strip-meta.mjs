// strip-meta.mjs - remove psql \restrict/\unrestrict meta-command lines from a dump (keep \. COPY terminators)
import fs from 'fs';
const src = process.argv[2];
const dst = process.argv[3];
const srcTxt = fs.readFileSync(src, 'utf8');
const out = srcTxt
  .split(/\r?\n/)
  .filter((l) => !/^\\(?:un)?restrict\s/.test(l))
  .join('\n');
fs.writeFileSync(dst, out, 'utf8');
console.log('wrote ' + dst + ' (' + srcTxt.length + ' -> ' + out.length + ' bytes)');