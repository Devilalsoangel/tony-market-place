// neon-grab-conn.js - extract connection string from the connect modal
(() => {
  const inputs = Array.from(document.querySelectorAll('input')).map((i) => ({
    val: i.value, ph: i.placeholder, type: i.type,
  }));
  const codes = Array.from(document.querySelectorAll('code, pre, [class*="code"], [class*="code-block"], [class*="snippet"]'))
    .map((c) => c.textContent.trim().slice(0, 300))
    .filter((t) => t.length > 10);
  const body = document.body ? document.body.innerText : '';
  const psqlMatch = body.match(/postgres(?:ql)?:\/\/[^\s"'\\]+/g);
  return { inputs, codes: codes.slice(0, 20), psqlMatches: psqlMatch ? [...new Set(psqlMatch)].slice(0, 10) : [] };
})()