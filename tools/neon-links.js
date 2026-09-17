// neon-links.js - dump internal links from the projects page
(() => {
  const links = Array.from(document.querySelectorAll('a[href]'))
    .map((a) => ({ href: a.getAttribute('href'), txt: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 60) }))
    .filter((l) => l.href && (l.href.includes('/projects/') || l.href.includes('/app/')));
  return { url: location.href, projectLinks: links.slice(0, 30) };
})()