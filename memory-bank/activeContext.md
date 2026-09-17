# Active Context

> Refresh this file at session close; it is the primary resume point.

## NOW (2026-09-07 — REDESIGN BATCH 5 SHIPPED: PDP SELLER RATING + CART AVAILABLE OFFERS + OFFLINE BANNER; FE tsc EXIT 0; ADMIN tsc EXIT 0)
- Batch-5 (fifth "fix all" pass** shipped + VERIFIED — all three items use REAL data, zero fabrication:
  - product/[id].tsx: Amazon-style SELLER RATING trust row under the seller identity card — real `avgRating`/`reviewCount` via `serverApi.getUserProfile(sellerUsername)** (users route aggregates ALL delivered-order reviews**; star icon + score + "(N reviews**" + "See reviews" → /seller/[username]; HIDDEN entirely when seller has zero reviews (never a fabricated score**; silent on fetch failure (never blocks PDP**; per-postId reset + alive-guard.
  - cart.tsx: "AVAILABLE OFFERS" one-tap chips (Amazon/Flipkart pattern** — live admin coupons via `serverApi.getCoupons()` rendered ABOVE the promo input in ListHeaderComponent; tap = applies the code (applyPromo refactored to accept an `override` param, syncs the input**; chip shows Applied state via promo?.code match; hidden when no coupons or empty cart; label = percent/flat/free_delivery from REAL server coupon type.
  - OfflineBanner.tsx (NEW component** + _layout.tsx wiring: global no-internet strip (NetInfo v12, expo-pinned** above every screen when `!isConnected || isInternetReachable===false`; theme colors.error; pointerEvents=none; safe-area offset.
- VERIFIED: FE tsc exit 0, ADMIN tsc exit 0; netinfo in package.json; grep anchors all green; temp scripts removed.
- Batch-5 LESSONS: (1** inserting multi-sibling JSX inside an existing `cond ? (` ternary needs a fragment wrapper + the following bare `/* comment */` silently becomes literal text inside JSX children — convert to `{/* */}`; (2** PS console mojibake on em-dashes is DISPLAY-ONLY — confirm with node byte-read (codePoint dump** before "fixing" encoding; repo files are clean UTF-8 (em-dash/middot is the established style**.

## NOW (2026-09-07 — REDESIGN BATCH 4 SHIPPED: FAKE EMI REMOVED + HONEST PAY RAILS; FE tsc EXIT 0; ADMIN tsc EXIT 0)
- Batch-4 (fourth "fix all" pass — anti-fabrication sweep** shipped + VERIFIED:
  - checkout.tsx: FAKE EMI BLOCK DELETED (hardcoded "Flat 8% p.a. demo" interest math with no EMI partner = anti-fabrication violation**. Removed ALL 7 touchpoints: ClockIcon component + react-native-svg import, Switch import, emiOn/emiPlan state, emiAvailable/emiMonthly/emiPlanLabel/emiPaymentSuffix computeds, "Pay in installments" card (~lines 301-354** , `{emiOn && ...}` EMI row in Order Summary, `paymentText + emiPaymentSuffix` concat in placeOrders call. Checkout total = server truth (subtotal+delivery), zero invented financing.
  - payment-methods.tsx: PAYMENT RAILS RESTRICTED TO SERVER-SUPPORTED — dropped UPI/Card rows (server orders route.ts: wallet = atomic debit, COD = settle-on-delivery, UPI/Card have NO settlement path = fake rails**; list now Wallet (dynamic balance, prepended at line 71-73** + Cash on Delivery. Comment documents server truth + the wiring bar for re-adding UPI (deep-link intent + KYC'd merchant ID**.
  - seller-orders.tsx: status filter tabs got accessibilityRole="button" + accessibilityLabel (parity with buyer orders tabs from batch 3**.
- SERVER TRUTH CONFIRMED (read-only** : orders route lives at `susej-admin-panel/src/app/api/app/orders/route.ts` (app-plane** — not `api/orders`; paymentMethod normalized trim+lower; `isCodPayment` = cash on delivery/cod/cash; wallet debit + order row in ONE transaction w/ compare-and-set; seller credited NET of commission.
- VERIFIED: FE tsc exit 0, ADMIN tsc exit 0; grep 0 EMI/emi residue in checkout.tsx; `_fix-batch4.cjs` temp script removed (no _fix* leftovers**.
- Batch-4 LESSON: invisible-char mangling hit BOTH editor tool AND my inline scripts (broke syntax twice: `es + 2`, `) }` phantom space** — fix = short scripts, no digit-after-plus arithmetic in literals, `node --check` gate before every run, index-splice by unique line markers instead of long string anchors.

## NOW (2026-09-07 — REDESIGN BATCH 3 SHIPPED; FE tsc EXIT 0; ADMIN tsc EXIT 0)
- Batch-3 (third "fix all"/deeper-pass** shipped + VERIFIED:
  - explore.tsx: condition filter now TRUSTS structured `p.condition` when set (create-wizard stores it**; text-derivation demoted to legacy fallback for old posts** — fixes mislabeling of New/Used.
  - product/[id].tsx: delivery card is now MODE-AWARE + honest: pickup → "Pickup from {seller} · Arrange pickup with the seller"; shipping → "Ships from {seller} · Shipping ₹{fee}"(fee null → "calculated at checkout"**; local → "Local delivery in {area} · calculated at checkout"; fallback → old "Selling from / Deliver to your area". ZERO fake dates/fees.
  - orders.tsx: status filter tabs (All / In Progress / Delivered / Cancelled** — industry Flipkart/Amazon order history pattern; live filter over REAL rows; a11y labels per tab.
.
  - profile.tsx: Addresses + Payments quick tiles (→ /address-book, /payment-methods** — industry Amazon/Flipkart profile menu pattern; new AddressIcon+CardIcon inline svgs; fixed Circle import.
  - admin dashboard/page.tsx: latest-order rows now drill-down → /dashboard/orders/[id] (was list-only** — detail page exists (verified**.
- VERIFIED: FE exit 0, ADMIN exit 0; grep-verified 5/5 (explore:203, product:736-749, orders:28-62, profile:48-290, admin:167**.
- Batch-3 LESSON: PowerShell `-LiteralPath` needed for `[id]` bracket paths + `-SimpleMatch` kills regex alternation — both cost two false-empty greps this round.

## NOW (2026-09-07 — REDESIGN BATCH 2 DEEP PASS APPLIED; FE tsc EXIT 0; ADMIN tsc EXIT 0)
- Batch-2 ("fix all" repeated → deeper pass** shipped + VERIFIED:
  - PostContext.tsx: NEW `refresh()` — user-initiated server re-fetch + cache reconcile + liked-map merge (pull-to-refresh engine; cache wins on failure; `!user?.username` guard**.
  - feed.tsx: `RefreshControl` wired (`refreshing` state, `onRefresh` calls `refreshPosts`; tint colors.primaryContainer** — backlog item #1 CLOSED.
  - orders.tsx: whole order card now tappable → `/track-order` (was inner "View Details" only**; nested Rate/Details buttons use `e.stopPropagation()` + hitSlop + a11y labels.
- ALSO NOTE: admin dashboard/page.tsx was EXTERNALLY rewritten (summary endpoint `/api/data/summary` replaces 8 useDbResource pulls** — my batch-1 "View all orders →" link + clickable rows SURVIVED the rewrite (still work against new `recentOrders = summary?.recentOrders ?? []` shape**; admin tsc re-verified EXIT 0.
- LESSON logged: the editor's DISPLAY eats/mangles `)`/backticks in echoed diffs — when tsc reports subtle paren errors, dump raw charcodes (`node -e` with codepoints** to see byte-truth before fixing (this round: an extra `]` in `[...visible], ...localOnly` was invisible until charcodes).
- Remaining backlog (audit-flagged, triaged**): explore structured `condition` field (schema+create-wizard work**; PDP delivery pincode→date (delivery-zones config**; server-coupon list UI; offline NetInfo banner; seller avg-rating under price; ProductCard `id` required refactor; Buy-Now sticky bar = STANDING USER VETO (re-ask**. Range: honest triage — batch-3 candidates = server-coupon list + offline banner if user directs again.**

## NOW (2026-09-07 — INDUSTRY-STANDARD REDESIGN BATCH APPLIED; FE tsc EXIT 0; ADMIN tsc EXIT 0)
- User directive: "fix all" after a 3-surface audit (buyer vs IG/Meesho/Flipkart/Amazon/OLX patterns; seller vs OLX/Meesho-Supplier/Shopify-mobile; admin vs Shopify/Stripe/Vercel). Admin panel already near-industry-standard (command palette, modules sidebar, tanstack data-table w/ sort/filter/pagination/bulk+export, status badges, KPI cards) — shipped gap-fixes:
- BUYER — feed.tsx: cart-count badge on bag icon (CartContext-sourced), PostCardSkeleton x3 while `!feedLoaded` (uses PostContext `loaded`; honest skeleton vs blank flash); explore.tsx: header bell+bag-with-badge (was empty), "N items found" results count; cart.tsx: "Start shopping" empty-state CTA → /feed; 44px quantity steppers + save/move/remove hitSlop+a11y labels; ProductCard.tsx: accessibilityRole+labels on like/comment/share/save (save label landed; hitSlop stays 8 — editor whitespace-match fight, logged).
- SELLER — listings-manager.tsx: 4-cell toolbar (Top Deal/View/Sold/Delete) accessibilityRole+labels.

- ADMIN — dashboard/page.tsx: “View all orders →” link (next/link) + clickable order rows → /dashboard/orders.

- BACKLOG (audit-flagged, deliberately not shipped; honest triage): feed pull-to-refresh (needs PostContext `refresh()` exposed first]; explore structured `condition` field (deriveCondition text-parsing fragility]; PDP delivery pincode→date (needs delivery-zones config]; server-sourced coupon list UI; offline NetInfo banner; seller avg-rating under product price;; Buy-Now sticky bar = STANDING user veto (Aug-28; re-ask first]; ProductCard optional `id` Math.random default (make required + fix callers]。

## NOW (as of Aug 27 2026 - ALL INTEGRATION WIRES WARMED UP)
Standing mission unchanged = END-TO-END TESTER CAMPAIGN P0->P7 with GPT vision
per screen (currently P0 stack-up + P1.1 splash/welcome re-walk zone).
WARM-UP EVIDENCE (all captured, exit codes/logs in %TEMP%\opencode):
- Stack: PG18 :5432 listening (start-pg.js PID), admin :3000 /api/v1/config
  200 real commission/promo JSON, Metro :8081 /status 200, CDP Chrome 151
  alive @127.0.0.1:9222 (profile C:\Temp\chrome-cdp logged into ChatGPT).
- Phone: 100.70.190.103:5555 device READY over Tailscale; adb reverse
  tcp:8081+tcp:3000 re-established; byte-safe screencap 282267B via
  Start-Process redirect (NOT PS pipe); foreground was com.openai.chatgpt.
- GPT-VISION PIPELINE FROM CLINE (opencode Playwright MCP not exposed here ->
  equivalent raw CDP driver written): gpt-warmup.mjs + warmup2.mjs +
  probe-state.mjs kept as tooling. Proof: (a) mechanical roundtrip - attach OK
  (DOM.setFileInputFiles), upload indicator true, exact token returned
  VISION-WARMUP-OK-2026; (b) TRUE-VISION pass - model described attached
  screenshot naming app ChatGPT, cross-matched dumpsys ground truth.
- LESSON: abrupt client kills leave the PAGE's CDP runtime wedged -> any ev()
  await hangs forever. Rules adopted: EVERY await wrapped in T(timeout);
  recovery = /json/close wedged tab + /json/new fresh target (warmup2 S0).
  PATH node is v20.19.4 (no global WebSocket) -> createRequire('ws') from
  Frontend/node_modules. run_commands hard cap 30s -> detached Start-Process +
  log polling; sync sleeps >20s trip the cap harmlessly (child survives).
Device parked mid become-seller wizard (selfie step); confirm identity, redo
steps fresh. Next actions: cold relaunch susej, then P1.1 per-button splash/
welcome walk with UIAutomator-first + GPT-vision-second ordering.

## Immediately actionable next steps
1. Cold relaunch susej (plain am start; phone currently shows ChatGPT app).
2. P1.1 splash->welcome per-button walkthroughs capturing dump+screencap+
   verdict evidence; P1.2-P1.7 onward per todo ladder.
3. Any code fix en route -> tsc 0 BOTH projects -> update progress.md.
4. Optional glance: wallet screen math (server truth already verified).

## Open medium-priority logs (from prior sessions)
- In-memory state replaced by server refetch where purely-local contexts exist
  beyond cart/bookmarks/recents (identity purge done for the rest).
- Cosmetic mojibake sweep (x11 admin files), Prisma migration trio (SQLite
  dialect SQL files), double-spend unique constraint pending migration.

## Recently shipped (for orientation)
Cross-account draft/cache leak family fixed; immersive nav hides tab bar in
chat threads/community; chat header name resolution id+username guarded;
category lock+prefill on create wizard; promo pricing round-trip admin<->app.

## How we work right now
Rules -> skills -> MCP servers installed (docs/CLINE-TOOLKIT.md). Model must
read memory-bank first; prefer MCP tools for DB/API truth before claims.


## NOW (Aug 31 - fresh accounts + real listings for demo)
- Stack booted fresh: PG18 :5432 up (start-pg.js), admin :3000 up (/dashboard 200,
  login+2FA cookie flow verified), Metro :8081 up (packager-status:running, 13MB
  bundle served), phone connected via Tailscale 100.70.190.103:5555, adb reverse
  tcp:8081+tcp:3000 set, Expo Go launched exp://127.0.0.1:8081 (running under a
  Microsoft Teams call at handoff - do not drive device until call ends).
- NEW ACCOUNTS via REAL HTTP flow (create-accounts-2.mjs in %TEMP%\opencode):
  SELLER phone 9830000002 @riyasharma (Riya Sharma, businessName "Riya Threadz",
  category Fashion, KYC approved via admin sellers PATCH -> User row isSeller=true
  verification=approved) | BUYER phone 9840000002 @aaravkumar (Aarav Kumar, wallet
  ₹500 welcome bonus). Fresh OTPs were issued (devCode in app hint / accounts.txt).
- 3 REAL LISTINGS created via REAL POST /api/app/posts as riyasharma, images = REAL
  Figma product assets (Frontend/assets/images/screens/product/) copied to admin
  public/products/*.png and served over HTTP 127.0.0.1:3000/products/* (works on
  phone via adb reverse tcp:3000): Handloom Cotton Saree Rs1299, Cotton Kurti Set
  Rs899, Midi Dress Rs1599 - all verified=true, mirrored to admin Product rows
  (lst_* active), feed title = description first line (PATCH applied). Description
  format must keep Title\nBody (app renders card title from first line).
- IMPORTANT: I named the assets by guess (saree/kurta/dress) - the actual Figma
  product-detail gallery images (img-1-3250/51/52.png, 392x488) have NO code-level
  names; product titles may not match image content. Re-verify visually before
  shipping to user-facing demo.

## Immediately actionable next steps
1. After Teams call ends: bring Expo Go to front, log in as riyasharma (9830000002)
   or aaravkumar (9840000002) via phone OTP devCode, verify feed renders the 3
   listings with real images (adb reverse tcp:3000 already set so
   127.0.0.1:3000/products/* images load).
2. VISUAL VERIFY the 3 asset images actually match saree/kurta/dress claims
   (GPT vision or user) and rename product titles if mismatched.
3. Resume P4 admin deep-audit todo ladder when user directs.
