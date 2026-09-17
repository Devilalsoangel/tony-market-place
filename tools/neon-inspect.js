// neon-inspect.js - dump useful state from the Neon console page
(() => {
  const txt = (sel) => {
    const el = Array.from(document.querySelectorAll(sel));
    return el.slice(0, 12).map((e) => e.textContent.trim().replace(/\s+/g, ' ').slice(0, 90));
  };
  return {
    url: location.href,
    title: document.title,
    bodyText: document.body ? document.body.innerText.slice(0, 2500) : '',
    buttonsNew: txt('button, [role="button"], a'),
    inputs: Array.from(document.querySelectorAll('input')).map((i) => ({ ph: i.placeholder, type: i.type, val: (i.value || '').slice(0, 30) })),
  };
})()