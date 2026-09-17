// Analyze OTP input structure in UI dump
import fs from 'node:fs';
const xml = fs.readFileSync(process.argv[2] ?? 'tools/ui-test/ui.xml', 'utf8');

// Count EditTexts
const editTexts = xml.match(/class="android\.widget\.EditText"/g);
console.log('EditText count:', editTexts ? editTexts.length : 0);

// Find all EditText bounds
const re = /class="android\.widget\.EditText"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;
let m;
let i = 0;
while ((m = re.exec(xml))) {
  const [l, t, r, b] = m.slice(1).map(Number);
  console.log(`EditText ${i++}: [${l},${t}][${r},${b}] center=(${Math.round((l+r)/2)},${Math.round((t+b)/2)}) w=${r-l} h=${b-t}`);
}

// Also find any node with OTP-related content
const otpRe = /text="(Dev code|We've sent|Resend|Sign in)"/g;
console.log('\nOTP-related text nodes:');
while ((m = otpRe.exec(xml))) {
  console.log(`  ${m[1]}`);
}
