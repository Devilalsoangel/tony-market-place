// Navigate to admin login, check seller applications
const result = {};

// First, check what page we're on
result.currentUrl = window.location.href;
result.title = document.title;

// Look for login elements
result.loginElements = Array.from(document.querySelectorAll('input[type="password"], input[type="email"], button[type="submit"]')).map(el => ({tag: el.tagName, type: el.type, name: el.name || '', placeholder: el.placeholder || '', id: el.id || ''}));

result.links = Array.from(document.querySelectorAll('a')).map(a => a.href);

result.buttons = Array.from(document.querySelectorAll('button')).slice(0, 20).map(b => b.textContent.trim());

JSON.stringify(result);