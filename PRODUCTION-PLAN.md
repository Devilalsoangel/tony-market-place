# SUSEJ PRODUCTION MASTER PLAN (work-order registry)
_Last updated: 2026-09-06 by Cline. Status legend: TODO / IN-PROGRESS / BLOCKED / PASS (verified real flow) / FAIL (broken, needs fix)_

## OPERATING MODEL
- Cline (me) = architect/QA-lead: designs work orders, reviews every diff, runs real-flow verification.
- opencode = junior worker: receives exact work orders (file paths + contracts + acceptance tests). Never hands over blindly — verify everything it touches.
- GPT Vision (phone :5559 via adb, or CDP :9222 browser) = UI/UX reviewer: screenshot every screen, catch visual/interaction bugs the API tests cannot see.
- Every module closes only when: API real-flow test PASS + Vision review clean + code reviewed.

## INFRA (was broken, now fixed)
- **Postgres lives in WSL Ubuntu; WSL2 NAT networking is UNSTABLE on this box** (dies after VM cycles; winnat restart + wsl --shutdown + re-register only briefly fixes). PERMANENT FIX IN FLIGHT: native Windows PostgreSQL (portable, C:\pg16 + C:\pgdata) with data restored from `tools/susej-dump.sql`. When native PG is up, admin .env points to 127.0.0.1:5432 natively — no WSL in the path.
- Admin server: `npx next dev -p 3000` (log: tools/dev-server.log). Metro: :8081. Phone tunnel: `adb connect 127.0.0.1:5559`.
- Working creds: admin `alexrivera` / `Admin@123` / 2FA `123456`. App OTP: dev mode returns devCode.
- **App-key alone is NOT enough for /api/data/* writes — Bearer token + x-app-key together** (parseWriteSession).
- KYC contract: app POST /api/data/sellers {businessName, ownerName, category, ...} (server forces kycStatus=pending, id=app_<username>); admin PATCH /api/data/sellers {id, data:{kycStatus:approved, verification:approved, isSeller:true}} is the ONLY seller grant path. users/me PATCH deliberately ignores isSeller/verification (server-side only).

## PHASE 0 — INFRA STABILITY (IN-PROGRESS)
- [x] DB dump captured (tools/susej-dump.sql, 81KB — 7 users, admin data)
- [ ] Native Windows PG 16 on :5432 (C:\pg16, C:\pgdata) ← running now
- [ ] Restore dump + verify counts (User=7, sellers, etc.)
- [ ] Admin server green on native DB (OTP register + admin login via API)
- [ ] crowd-seed.mjs full PASS (buyer+seller+KYC+listing+cross-surface truth)
- [ ] Metro + phone tunnel verified with real screen load

## PHASE 1 — CROWD SEED + REAL-FLOW BASELINE
- [x] tools/e2e-smoke.mjs 9/9 (auth/wallet/feed/401 gate) — re-verify after PG migration
- [x] tools/admin-truth.mjs (admin session + data reads)
- [ ] tools/crowd-seed.mjs (seller KYC 3-act flow + buyer + listing + admin mirror)
- [ ] buyer purchase real flow: cart → checkout → order placed → admin sees order → seller order status flow
- [ ] 3 sellers + 6 listings + 2 buyers seeded for realistic UI review

## PHASE 2 — VISION PIPELINE PROOF
- [ ] adb screencap phone → png; gpt-see.mjs review → verdict + issues list (proof on Feed screen)
- [ ] CDP :9222 browser screenshot of admin panel → gpt-see review (proof on P4 dashboard)
- [ ] Work-order template for opencode: (goal, files, contracts, acceptance test, vision steps)

## PHASE 3 — MODULE-BY-MODULE PRODUCTION PASS (66 screens)
Each module: audit → fix via opencode work order → verify API + vision → mark PASS. Priority order (user-facing value first):
- [ ] M1 Auth+OTP (splash, onboarding, login, verify, role gate)
- [ ] M2 Feed+Post detail (home, post detail, like/comment/share real persistence)
- [ ] M3 Marketplace+Product (listing grid, filters, product detail, seller mini-profile)
- [ ] M4 Cart+Checkout+Orders (add/remove, totals, wallet payment, order tracking)
- [ ] M5 Seller console (become-seller, add listing, my listings, order management)
- [ ] M6 Wallet+Topup+Withdraw (balance, history, withdraw request → admin approval)
- [ ] M7 Profile+Settings (edit profile, interests, blue-tick display, logout)
- [ ] M8 Admin: users/sellers KYC approval real flow (approve/reject propagates)
- [ ] M9 Admin: products moderation + banners + promotions + withdrawals
- [ ] M10 Admin: orders lifecycle + analytics truth
- [ ] M11 Chat/messages if wired
- [ ] M12 Edge: 401 gates, empty states, error toasts, offline
(Enumerate each of the 66 screens inside its module as sub-items as we go.)

## RULES
- No mock/demo data shortcuts — every fix must work through real HTTP + real DB.
- Screenshots for every "looks right" claim (vision loop).
- One module IN-PROGRESS at a time; registry stays current after each.
- Token efficiency: batch API probes; delegate well-scoped fixes to opencode; never re-read whole files when grep suffices.