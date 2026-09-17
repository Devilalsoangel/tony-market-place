(() => ({ url: location.href.slice(0,150), txt: (document.body.innerText||'').slice(0,300).replace(/\n/g,' | ') }))()
