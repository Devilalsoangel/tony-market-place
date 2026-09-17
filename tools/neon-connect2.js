// neon-connect2.js - click the top-right Connect button
(() => {
  const btns = Array.from(document.querySelectorAll('button, [role="button"]')).map((b) => ({
    txt: b.textContent.trim().replace(/\s+/g, ' ').slice(0, 40),
    cls: (b.className || '').toString().slice(0, 60),
  }));
  const btn = Array.from(document.querySelectorAll('button, [role="button"]')).find((b) => {
    const t = b.textContent.trim().toLowerCase();
    return t === 'connect' || t.startsWith('connect ');
  });
  let clicked = false;
  if (btn) { btn.click(); clicked = true; }
  return { clicked, buttons: btns.slice(0, 30) };
})()