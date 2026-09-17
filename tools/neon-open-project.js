// neon-open-project.js - click the susej-team project row
(() => {
  const rows = Array.from(document.querySelectorAll('tr, [role="row"]'));
  const target = rows.find((r) => r.textContent.includes('susej-team'));
  if (!target) return { error: 'susej-team row not found' };
  target.click();
  return { clicked: true };
})()