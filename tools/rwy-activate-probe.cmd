@echo off
cd /d C:\Users\TONI\projects\social-commerce\tools
node cdp-eval-any.mjs "railway.com/activate" neon-inspect.js --out railway-activate.json > railway-activate.log 2>&1
