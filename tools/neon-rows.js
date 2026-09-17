// neon-rows.js - find the project list rows and their clickable URL info
(() => {
  const rows = Array.from(document.querySelectorAll('tr, [role="row"]'))
    .map((r) => {
      const txt = r.textContent.trim().replace(/\s+/g, ' ');
      const hrefs = Array.from(r.querySelectorAll('a[href]')).map((a) => a.getAttribute('href'));
      return { txt: txt.slice(0, 120), hrefs: hrefs.filter((h) => h && !h.startsWith('#')) };
    })
    .filter((r) => r.txt.length > 2 && /susej|project1|creator|storage|branch|active/i.test(r.txt));
  return { url: location.href, rows: rows.slice(0, 20) };
})()