// Harvest real id_token from the CDP tab URL fragment -> tokeninfo -> backend login
const CLIENT_ID = '587974931581-rnobfpase03ro9lu4df7grh7ueniajef.apps.googleusercontent.com';
const tabs = await (await fetch('http://127.0.0.1:9222/json')).json();
const tab = tabs.find(t => t.type === 'page' && (t.url || '').startsWith('http://localhost:9988/auth/google#'));
if (!tab) { console.error('NO redirect tab found'); process.exit(1); }
const m = tab.url.match(/id_token=([^&]+)/);
if (!m) { console.error('no id_token in fragment'); process.exit(1); }
const idToken = m[1];
console.log('id_token length:', idToken.length);
const fs = await import('node:fs');
fs.writeFileSync(new URL('./google-id-token.txt', import.meta.url), idToken);

// 1) Google tokeninfo verification (same endpoint the backend uses)
const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
const info = await r.json().catch(() => ({}));
console.log('tokeninfo:', JSON.stringify({ status: r.status, aud_ok: info.aud === CLIENT_ID, email: info.email, email_verified: info.email_verified, name: info.name }, null, 1));

// 2) backend real-path login with the REAL token
const b = await fetch('http://127.0.0.1:3000/api/app/auth/google', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idToken }),
});
const body = await b.json().catch(() => ({}));
console.log('BACKEND:', b.status, JSON.stringify({ user: body.user, token: body.token ? body.token.slice(0, 14) + '...' : undefined, error: body.error }, null, 1));
