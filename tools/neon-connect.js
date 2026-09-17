// neon-connect.js - click the Connect button to reveal connection string
(() => {
  const btn = Array.from(document.querySelectorAll('button, [role="button"]')).find((b) =>
    b.textContent.trim().toLowerCase() === 'connect' || b.textContent.includes('Connect'));
  if (btn) btn.click();
  return { clicked: !!btn };
})()