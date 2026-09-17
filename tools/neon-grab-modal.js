// neon-grab-modal.js - extract everything from the open connect modal
(() => {
  const body = document.body ? document.body.innerText : '';
  const psqlMatches = body.match(/postgres(?:ql)?:\/\/[^\s"'\\]+/g);
  const allInputs = Array.from(document.querySelectorAll('input')).map((i) => ({ val: i.value.slice ? i.value.slice(0, 200) : i.value, ph: i.placeholder, type: i.type })).filter((i) => i.val || i.ph);
  const textareas = Array.from(document.querySelectorAll('textarea')).map((t) => t.value.slice(0, 300)).filter((t) => t);
  const codeBlocks = Array.from(document.querySelectorAll('[class*="code"], code, pre')).map((c) => c.textContent.trim().slice(0, 200)).filter((t) => t.length > 8);
  return {
    url: location.href,
    bodyText: body.slice(0, 3000),
    psqlMatches: psqlMatches ? [...new Set(psqlMatches)] : [],
    allInputs, textareas, codeBlocks: codeBlocks.slice(0, 20),
  };
})()