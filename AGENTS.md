# susej - Social Commerce Marketplace
Instagram feed + OLX selling + Facebook communities. React Native / Expo SDK 57 / TS + FastAPI backend.
App: `Frontend/` (66 routes: 32 Figma + 34 bonus) | Admin: `susej-admin-panel/` (Next.js 16, desktop-only 1024px+).
> Cleaned Sep 13 (user-ordered). Pre-cleanup full text unrecoverable after an external wipe (see MISTAKE LOG); this file now holds all live rules + state, re-verified.

## ACTIVE TASK
**P4 ADMIN DEEP AUDIT** — Home Management screen done Sep 13 (READ source + WALK via API lane, no device):
1. `home-sections` = 0 rows on prod -> "Show on home page" toggle crashes (`section!.id` on undefined).
2. `featured-posts` table is write-only: promo engine writes it, nothing reads it (`/api/v1/home` reads only topSeller/hotDeal/storefrontBanner). 2 active rows, 1 orphaned (no backing promo, empty dates).
3. Top-seller sales (12/9/15 = 36) don't reconcile with 14 orders (all unattributed, sellerName = "Seller").
Fixes NOT yet applied. Remaining: rest of P4 (44 screens), P5 crowd, P6 rush, P7 evidence.
Standing rules: intelligence guard (no real entity = must not exist in admin); per screen READ source -> WALK live -> GPT vision -> LOGICAL VERIFY (real DB vs mock, actions persist).

## LIVE SESSION CHECKPOINT (Sep 13)
- Neon prod DB ALIVE (URL in `backend/_imp_test.py:6`, `tools/neon-check.mjs`): users 19 / sellers 10 / products 29 / orders 14 / reviews 6 / posts 29.
- Admin boots locally vs Neon via process-level `DATABASE_URL` override + `npm run dev` (do NOT rewrite `.env`). Login alexrivera / Admin@123 + 2FA 123456 -> `susej_session` cookie. Logs `%TEMP%\opencode\admin-neon-*.log`. Probes: `%TEMP%\opencode\admin-neon-check.cjs`, `home-walk.cjs`, `home-cross.cjs`, `home-deep.cjs`.
- CDP `:9222` UP (Chrome 152), profile `Default` = numberbook999@gmail.com. Vercel + GitHub tabs open. Railway CLI 5.49.5 as mantonystalin08@gmail.com (different account than Chrome profile).
- Local PG gone, Metro down, no device attached — API-lane audit until phone/Metro back.

## DEPLOYED STACK (LOCKED Sep 13 — user order: hosted only, NO local builds)
- Backend API → Railway `https://susej-backend-production.up.railway.app` — VERIFIED Sep 13: `/` 200 UniHub API v4.0.0, `/docs` 200, `/openapi.json` 200 (no `/health` route; root 200 IS the health signal). Railway CLI 5.49.5 logged in as reeky@gmail.com.
- Admin panel → Vercel `https://susej-admin-panel.vercel.app` — VERIFIED Sep 13: `/login` 200, `/` 307 redirect, `/api/data/sellers` 401 unauth (auth gate holds).
- PROD SYNC FIX Sep 13 (live chain repaired): prod rejected the APK's `dev-key` (401 on every app-key route — home rails, promos, uploads, mirrors all dead on the deployed app). Fixed via dashboard: added `APP_API_KEY=dev-key` + `DATABASE_URL` (Neon direct; prod had NO database var — old deployment ran on baked-in build env) + created `main-manual` deploy hook + fresh git build (dyoi7opxz, root dir honored). VERIFIED on `https://susej-admin-panel-theta.vercel.app/api/v1/home`: 200, sellers 3 / deals 3 / banners 3, real Neon rows. Deploy-hook URL kept in Vercel (git page) for env-change rebuilds.
- DOMAIN CAVEAT Sep 13: bare `susej-admin-panel.vercel.app` is owned by ANOTHER Vercel scope (alias-in-use globally, absent from our alias list) and still serves the stale deployment (dev-key 401). Do NOT touch it. APK code (`DEFAULT_ADMIN_URL`, eas.json) still points at bare → needs app-side URL switch to `-theta` + APK rebuild once device is back. Until then the APK's server sync stays broken even though the backend is fixed.
- LOGIN FIX Sep 14 (user: password+2FA bounced back to login): root cause = NO `JWT_SECRET` on Vercel → `lib/auth.ts` falls back to an EPHEMERAL per-boot secret, so the verify step signs with secret A and the dashboard check verifies with secret B (serverless instances). API probing masked it (manual cookie forwarding). Fix: generated stable 64-hex `JWT_SECRET` via dashboard + redeploy. VERIFIED with wiped cookies: alexrivera/Admin@123 + 123456 → lands on `/dashboard`, session cookie set.
- Mobile app → APK builds (v1.1.0 on device Sep 11; 106MB `$apk` artifact in home dir). No local Metro builds for demos.
- APK v1.1.1 REBUILD Sep 13 (EAS preview, build f01c6a83): ONLY change = admin URL bare → `-theta` (bare scope is foreign/stale, rejects app key). tsc FE 0. Submitted to EAS cloud; install + on-device sync re-audit still pending at time of writing.
- APK BUILD FIX Sep 13: f01c6a83 ERRORED in 20s (Install dependencies) — `@expo/webpack-config@19` (dead web dep) peer-conflicts with SDK 57 and repo had no `.npmrc`. Fix: `Frontend/.npmrc` with `legacy-peer-deps=true` (resolution verified via dry-run). Resubmitted as build 313f70a6.
- APK SHIP CHANGE Sep 14: native rebuilds keep dying (gradlew UNKNOWN_ERROR; local repro hits expo-modules-core CMake ninja dirty-loop) while the change is JS-only → shipped as OTA instead: `eas update` branch preview, group 278fd350 ("admin URL bare-to-theta", runtimeVersion 1.0.0-compatible). Device must relaunch to pull it. Native rebuild still open if OTA doesn't take.
- Database → Neon prod, direct URL in `backend/_imp_test.py:6` (users 19 / sellers 10 / products 29 / orders 14 / reviews 6). Railway-attached DB dead — Neon direct is truth.
- LINKS: Neon console `https://console.neon.tech/app/projects/green-paper-44362813` (org page `.../app/org-long-sea-58955915/projects`, team project `.../susej-team` — direct connection string is truth, console project mapping UNVERIFIED). Admin prod `https://susej-admin-panel.vercel.app/login` (dashboards under `/dashboard/*`); local probe lane `http://127.0.0.1:3000` (Neon-backed, boot on demand only).
- STANLY = Tony's second working device (parallel workflow). Keep BOTH git remotes (`origin` = legacy susej-app, `stanly` = Stanly34/social-commerce-template); pushes to shared branches risk cross-device conflicts — pull/rebase before every push.
- RULE: all upcoming work targets hosted (Railway / Vercel / APK). Local `:3000`-vs-Neon boot is an audit PROBE lane only, never the demo stack. Never present localhost as the product.
- GIT↔VERCEL WIRED Sep 13: Vercel `susej-admin-panel` project → `Devilalsoangel/tony-market-place` (main), "Connected just now", Root Directory `susej-admin-panel/` (verified persisted — monorepo needs it). Push-to-deploy live from next push; end-to-end push→deploy NOT yet fired (needs a real push).
- REPO VERDICT Sep 13 (NOT dupes): `tony-market-place` = live monorepo (Frontend+admin+backend, main, pushed Sep 11); `susej-app` = legacy app-only layout (master, Sep 8, different history — compare 404 both ways). Local `origin` still points at legacy `susej-app` (STALE) with 168 dirty files uncommitted — repointing origin + pushing needs explicit user call (never commit unasked).
- SECURITY FLAG Sep 13: plaintext ghp tokens embedded in `.git/config` (origin + stanly remotes). Rotate the tokens + switch git to credential helper (`gh auth setup-git` covers github.com; stanly remote needs its owner's token).
- CLI ACCESS (logged Sep 13): `gh` 2.100.0 @ `C:\Users\TONI\bin\gh` (user PATH) authed as Devilalsoangel via GITHUB_TOKEN (scopes repo/packages; `repo list` proven; missing read:org — org ops need `gh auth refresh`); `railway` 5.49.5 logged in mantonystalin08@gmail.com; `vercel` 59.11.7 LOGGED IN as numberbook999-9985 scope (Sep 13, device-code flow auto-approved by the active browser session; note: run with `$env:NO_UPDATE_NOTIFIER='1'` — its update worker crashes the shell otherwise).

## PRIORITY MEMORY (NO COMPACT)
Protected from auto-trim (user-mandated): ACTIVE TASK, this section, PROJECT BRIEF, DECISIONS LOG, USER PREFERENCES, PROJECT STATE, SESSION HANDOFF, MISTAKE LOG, PROTOCOLS, Reference.
Standing intelligence rules: evidence-first (exit codes / API JSON / DB counts / screenshots, else UNVERIFIED); intelligence guard per screen; proactive error-hunt on every screen (dead taps, wrong sources, stale effects, fabricated identities, missing states, races); money must reconcile exactly; no dead taps, no fabricated data.

## SESSION HANDOFF - Next Steps
1. Apply P4-Home fixes (seed `home-sections`, resolve `featured-posts`, reconcile top-seller sales) -> verify via API -> tsc both.
2. Continue P4 remaining screens with READ -> WALK -> GPT -> VERIFY.
3. Commit batches only when user asks (many pending — never commit unasked).
4. Flow-first buyer journey re-verify once device/Metro back.

## USER PREFERENCES
- **PROACTIVE ERROR-HUNT ON EVERY SCREEN (Aug 24)**: own error-spot pass beyond reported issues; state findings explicitly.
- Wants everything visible in-app (demo first, no backend)
- Loves parallel agents - "use parallel agent to work all"
- Keep no-emoji rule in code
- Colors via tokens only; Inter; inline Svg icons (no new icon libs)
- Do NOT npm-install, do NOT commit unless asked
- TURN-DIRECTOR v3 (Aug 24): every new message = AMENDMENT to the standing plan (resume-first, SCOPE CHANGE note required to replace); NO done/fixed claim without captured evidence, else UNVERIFIED.
- Continuous mode: never stop, never ask, never end with a question
- **Only use GPT site for image/visual verdicts** (Aug 8)
- **Practical > pixel**: Figma is idea board; real apps have MORE content, scroll, states, working wiring

## HARD RULE: Continuous Mode - OVERRIDES default "ask before proceeding"
Time-budgeted instruction ("work X hours" / "keep going"): NEVER stop when a task finishes (pick the next immediately); NEVER ask permission; NEVER end with a question; EMPTY todo list = find more work (backlog -> review -> perf -> debt -> docs -> tests -> again). Stop only when: budget passed, truly blocked (state it, finish all unblocked), or user says stop. Session start: read ACTIVE TASK + backlog, build todo list, execute. Survives compaction.

## DECISIONS LOG
| Decision | Chosen | Reason | Tradeoff / Revisit If |
|---|---|---|---|
| Feature priority | Tiered batches of parallel agents | Fast delivery | Strict disjoint file ownership |
| New screens | Route-per-screen + Modal | Simpler, demo-visible | Unify later |
| Cross-screen state | Contexts (Auth, Post, Cart, Order, Follow, Notification, Chat, Community, RecentlyViewed, Hashtag, Bookmarks) | RN standard | Backend swap later |
| Persistence | AsyncStorage, load-merge-persist + loaded guard | Offline-first | Backend swap later |
| Money | `formatPrice` INR (utils/theme) - NOT $ | Indian marketplace | Backend swap later |
| Dark mode + i18n | ThemeContext + `t()` in Settings only; colors.* tokens everywhere | Token-safe | Roll out t() wider |
| Blocked users | @susej_blocked list; chat filters; unblock via /blocked | Existing pattern | Real backend later |
| Figma access | figma-console LOCAL BRIDGE ONLY | No rate limits, true 4x | - |
| Feed design | Figma 223:30 = idea; industry-practical rails + YOUR STORY first | User-mandated | - |
| Monetization (Aug 13) | SUBSCRIPTIONS REMOVED -> Promotions & Ads + Commission & Fees (8%) | User: study insta/olx/fb | Promo price UI via admin only |
| Memory durability (Aug 11) | PRIORITY MEMORY sections; injection cap 8000; compactor keeps newest 10 | Compaction must never shrink memory | Claude Code pattern |
| Skill auto-trigger (Aug 11) | skill-prioritizer: `priority:` frontmatter -> system-prompt index | Skills must auto-trigger | New skills default P80 |
| Audit method (Sep) | Industry-standard audit: all surfaces/modules/screens/buttons/db; fix misbuilds via CDP+USB | Team demos need real flows | ETA ~6h per cycle |

## PROJECT BRIEF (condensed)
**Rebuild = reference Figma, THINK, build what a REAL PRACTICAL app needs.** Figma is an idea board, not a spec: real apps have MORE (items, scroll, states, wiring). Brainstorm artifacts get removed without hesitation.
**THREE-SOURCE METHOD:** (1) Figma core (layout skeleton + must-have sections); (2) GPT practical industry idea via Playwright; (3) own judgment where they disagree.
**Per-screen protocol:** Figma ref -> read code (inventory core vs built) -> rebuild (Figma CORE + industry-functional) -> `tsc --noEmit` 0 errors -> device screenshot vs hi-res ref via GPT (>= 95% core) -> log result.
**FLOW-FIRST ORDER:** buyer journey first (Feed -> story -> product -> cart/checkout -> track -> review -> chat -> seller -> explore/search/category), THEN seller journey (become-seller -> create -> store/dashboard -> orders -> analytics).
**Design tokens:** seed #5d5fef; primary #4343d5; surface #fcf8ff / #f5f2ff / #efecff / #ffffff; text #1a1a2e / #464555; error #ba1a1a. NO hardcoded colors (use `colors.*`). Inter throughout RN. Screens: 5 tabs (Feed / Explore / Create / Chat / Profile). 17 industries (Fashion..Medical).

## PROJECT STATE
- **66 routes** (32 Figma + 34 bonus); tsc clean both projects (last green: Sep 10 B7+B8 + Sep 13 probes).
- Stack truth (Sep 13): Neon prod = source of truth (19/10/29/14/6); admin `:3000` booted locally vs Neon on demand; local PG dead; Metro `:8081` down; no device; CDP `:9222` up (Default profile).
- App contexts: Post / Order (serverId-aware) / Notification / Promotion / Community / Bookmark / Follow / Cart / RecentlyViewed / Hashtag. Server sync in `utils/serverApi.ts`, offline-first AsyncStorage fallback everywhere.
- Device (when back): toni-phone @ 100.70.190.103 (Tailscale, 10BD581KPP0006T), 1080x2400, Expo Go, Metro 8081, adb reverses 8081+3000. Vision: GPT site via CDP (model cannot see images — never Read PNGs).
- Audit reports: `docs/AUDIT-2026-09-10.md` (fold-proof), `%TEMP%\opencode\audit-findings.md` (findings log is LAW), `%TEMP%\opencode\audit-progress.md` (phase tracker).

## MISTAKE LOG (live lessons only)
| Mistake | Rule |
|---|---|
| GPT-site skill stale (browser_click timeouts, Enter no-submit, dedup "Something went wrong") | Evaluate-clicks only; rename EVERY file before upload; send via evaluate-click; poll stop-button |
| Device checks hang (20-30s stalls) | Serialize adb (ONE call at a time) + timeout guard (`adb-safe.mjs`); hang = kill-server/reconnect/retry ONE |
| Model cannot see images | NEVER Read PNGs; ALL visual verdicts via GPT site + CDP |
| PS 5.1 file mojibake | `[IO.File]::ReadAllText/WriteAllText` or `-Encoding UTF8`; `(?m)` anchors; Node `Buffer.from(t,'latin1').toString('utf8')` to recover |
| Plugin removal ghosts (running session keeps old tools) | Purge node_modules + regen lock + tell user to RESTART opencode; verify in fresh session |
| Blind Figma cloning | THREE-SOURCE method; practical question BEFORE code |
| Memory header drift breaks plugins | Exact headers: `## ACTIVE TASK`, `## CONVERSATION LOG`, `## DECISIONS LOG` (h2) |
| require() asset IDs in state crash RN | `Image.resolveAssetSource(asset).uri`; purge numeric image at load |
| adb quoting kills parens routes | PAREN-FREE links (`--/feed`); never URL-encode parens |
| Maestro decimal taps crash | INTEGER coords from hierarchy bounds; point taps |
| Parallel agents break build | `tsc --noEmit` after EVERY agent batch, both projects |
| AGENTS.md PowerShell slicing (2x wipe) | Routine edits append-only + verify line count (wholesale rewrite only on explicit user order) |
| **Sep 13 EXTERNAL WIPE**: root AGENTS.md (218KB) + its .bak truncated/deleted ~1 min after verified rewrite; no second opencode session; cause unconfirmed (suspect background memory-plugin cycle) | Keep off-repo copy `%TEMP%\opencode\AGENTS-clean-20260913.md`; re-verify mtime after every rewrite; NEVER keep sole backup inside repo |
| **Sep 14 FALSE-VERIFY (user-caught, deserved)**: claimed "admin syncs with DB" from API probes with hand-forwarded cookies while the real browser login was fully broken (ephemeral JWT) — the probe bypassed middleware, cookie jar, and instance affinity | VERIFY-THROUGH-REAL-SURFACE protocol (see PROTOCOLS): fresh-state real-browser proof for every user-facing claim; API probes support but never substitute; name the exact verification path in every done-claim |
| **Live gotchas**: admin cookie = `susej_session` (NOT auth-token); 2FA route = `/api/login/verify-2fa` (NOT /api/verify-2fa); PS `curl.exe` JSON quoting broken -> node scripts or Invoke-RestMethod; Node 20 `getSetCookie()` works (old unreliability note retired Sep 13); adb reverses CLEAR on daemon restart (re-run 8081+3000); uiautomator "could not get idle state" = shimmer loop -> screencap liveness + blind taps; fractional tap coords fail silently -> `[Math]::Round`; keyboard covers buttons -> keyevent 111 first; OTP digits drop -> type per-box; Turbopack `.next` corruption -> `rm .next` + restart; Prisma 7 nested-relation arrays need `{create:[...]}` normalize; Prisma validate breaks on UTF8 BOM; expo start needs watch-alive (non-CI) or serves stale bundles |

## PROTOCOLS
### GPT VISION UPLOAD (always follow)
1. Probe CDP (`/json/version`, 5s timeout) BEFORE every call. 2. Fresh chat `/?new=1`. 3. Rename EVERY file first (dedup). 4. Evaluate-click composer-plus -> span-exact 'Upload from computer' -> closest menu-item. 5. Upload -> verify Remove-file count. 6. Fill prompt (no Enter). 7. Send via evaluate-click send-button. 8. Poll stop-button (8s x10 max), read last assistant text. NEVER browser_click on chatgpt.com.
### DEVICE / ADB
One `adb shell` at a time with timeout guard; wedged = kill-server/start-server/devices, retry ONE. Reverses 8081+3000 after ANY reconnect. Prefer one long dump-read over many taps. `adb-run.ps1` max 40s; device check 5s hard timeout.
### GATES
`npx tsc --noEmit` exit 0 BOTH projects after every code batch. No evidence (exit code / API JSON / DB count / screenshot) = UNVERIFIED.
### VERIFY-THROUGH-REAL-SURFACE (Sep 14, user-mandated correction)
API probes with hand-forwarded cookies/headers NEVER prove a user flow works — they bypass middleware, cookie jars, and serverless instance affinity (this exact gap masked a fully broken admin login behind a 200+token API success). Rules: (1) user-facing claims require fresh-state real-surface proof — wiped cookies/storage, real browser via CDP/Playwright, full click path to the landing page; (2) every done-claim names its exact verification path ("fresh-cookie browser login → /dashboard", not "login works"); (3) after any VERIFIED, ask what the probe bypassed (middleware? cookies? RBAC? cold vs warm instance?) and close it before claiming; (4) server-state flows get verified twice across time (cold vs warm instance).

## Reference - Architecture & Design
- 5 tabs: Feed (IG product posts) / Explore (search, categories, map, communities) / Create (seller-only) / Chat (DMs + negotiation) / Profile (account hub; posts live only in store view).
- 17 industries; differentiators: product posts, seller follow + feed algo, community + commerce, map + social, chat negotiation, verification tick, local-first.
- Figma: file ZaRKwIZnGxM4kVAZgOWwd, 32 screens; hi-res refs `Frontend/assets/screens/hi-res/`; registries `Frontend/utils/screenImages.ts`; maps: METADATA-REFERENCE.ts, UI-PIXEL-PERFECT-REFERENCE.md, FEATURE-SPECS.md, docs/CATEGORY-AWARE-UI.md, docs/GPT-VISUAL-AUDIT-CONTEXT.md.
- Env: Node v20.19.4 (host), Expo SDK 57, ADB `C:\Users\TONI\platform-tools\adb.exe`, Metro 8081, admin 3000, PG 5432 (local dead — Neon is truth), CDP 9222.
- Cross-project memory (opencode brain): proxy 8096, panel 8125 — see global ~/AGENTS.md; `~/.config/opencode/brainfolder` (recall.mjs / learn.mjs).

## SESSION LOG - Sep 15 night full-production audit+rework (append-only)
- 4 parallel explorers (buyer/seller/admin/money) vs IG+OLX+FB+Amazon, OTP-bypass excluded, ~70 gaps. Hosted verified: Railway `/` 200 UniHub v4, theta `/api/v1/home` 401-no-key (fail-closed holds) + 200-with-key (3/3/3 real rows), Vercel `/login` 200. No device/Metro/CDP — static+tsc+hosted-probe verification only.
- Fixed batches 22-37, tsc FE0+Admin0 after EVERY batch (evidence: exit codes): buyer money (price guard, service-fee 0 x3 surfaces, subtotal round, debit idempotency both sides, coupon server-mirror preview in cart/checkout/receipts, cart badge qty, dead /feed route, offer double-tap guard); seller (addPost rollback+variant/subCat parity both sides, qty-0 honored, stockLeft/variant decrement in order tx, decline path server+UI, case-insensitive identity x4, withdraw gates, UPI copy, checklist locks, hub pencil); admin (HomeSection hs-name id, money-PATCH 400 lock, orphan expiry sweep+serve filter, 6 desks take:100+totalCount, commission upsert+windows, loyalty reason required, seller-delete identity reset, patch/revert+toast x4, summary aggregates, dispute exact-split+shipping ledger, transactions copy, ?id= single-row detail pages, proxy.ts verified as edge auth P1-1-stale).
- Money closed: placement shipping leg + COD fee/shipping split (double-entry balances); promo P0-1 downgraded (purchase-row→feed chain is the prod path); wallet P1-6 + oversell P0-3 + P1-1 + featured-write-only closed as stale/already-fixed with file:line evidence.
- NOT in this session (needs explicit user call): git commit/push (never commit unasked — many files dirty), Vercel/Railway deploy (local fixes NOT live until push→deploy), Neon db push (no schema change was made — all fixes migration-free by design), on-device/Metro re-verify, 2nd zero-finding re-audit pass.
- Full findings LAW: `%TEMP%\opencode\audit-findings.md` (tail: batches 22-37 + NOTED list with reasons).
- Night-2 hostile passes: pass-1 (10 claims) forced batches 38-39 (commission id-poison, debit race, reserve-once, server fee, pro-rata split); pass-2 (9 claims) forced batch40 (ref-truncation, book-service rewire). tsc FE0+Admin0 after every batch; hosted baselines re-verified (Railway 200, theta 401, login 200); local fixes await push→deploy (uncommitted, unasked).
