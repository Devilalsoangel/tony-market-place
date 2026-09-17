(() => { const btn = [...document.querySelectorAll('button, a')].find(b => (b.innerText||'').includes('toni_stann7')); if (btn) { btn.click(); return 'CLICKED'; } return 'NO'; })()
