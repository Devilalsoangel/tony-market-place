// Real Google id_token catcher: OAuth in logged-in CDP Chrome -> localhost:9988 -> verify via tokeninfo
import http from 'node:http';
import crypto from 'node:crypto';
import { getBrowser, newTab } from './cdp-lib.mjs';

const CLIENT_ID = '587974931581-rnobfpase03ro9lu4df7grh7ueniajef.apps.googleusercontent.com';
const REDIRECT = 'http://localhost:9988/auth/google';
const nonce = crypto.randomBytes(16).toString('hex');
let done = false;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:9988');
  if (url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const id_token = url.searchParams.get('id_token');
  if (!id_token) {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<h3>No id_token in redirect</h3><pre>' + url.search + '</pre>');
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<h3>✓ id_token captured — you can close this tab</h3>');
  done = true;
  console.log('id_token captured, length', id_token.length);
  // verify via Google tokeninfo (same endpoint the backend uses)
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(id_token));
  const info = await r.json().catch(() => ({}));
  console.log('tokeninfo status:', r.status);
  console.log(JSON.stringify({ aud: info.aud, aud_ok: info.aud === CLIENT_ID, email: info.email, email_verified: info.email_verified, name: info.name, exp_in_secs: info.exp ? info.exp - Math.floor(Date.now() / 1000) : null, nonce_match: info.nonce === nonce }, null, 1));
  const fs = await import('node:fs');
  fs.writeFileSync(new URL('./google-id-token.txt', import.meta.url), id_token);
  server.close();
  process.exit(0);
});

server.listen(9988, () => {
  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth' +
    '?client_id=' + encodeURIComponent(CLIENT_ID) +
    '&redirect_uri=' + encodeURIComponent(REDIRECT) +
    '&response_type=id_token&scope=' + encodeURIComponent('openid email profile') +
    '&nonce=' + nonce + '&prompt=select_account';
  console.log('listening on 9988; opening Google OAuth via CDP HTTP API...');
  // open tab via plain HTTP (no playwright/websocket)
  fetch('http://127.0.0.1:9222/json/new?url=' + encodeURIComponent(authUrl), { method: 'PUT' })
    .then(r => r.json())
    .then(j => console.log('tab opened:', (j.url || '').slice(0, 60), 'id:', j.id))
    .catch(e => { console.error('tab open failed:', e.message); process.exit(1); });
});

setTimeout(() => { if (!done) { console.error('TIMEOUT waiting for redirect'); server.close(); process.exit(2); } }, 240000);
