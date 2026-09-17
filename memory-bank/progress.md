# Progress Ledger

# Progress Ledger

# Progress Ledger

## 2026-09-07 — Batch 5 (fifth "fix all" — trust + offers + offline) — SHIPPED + VERIFIED (FE tsc exit 0; admin tsc exit 0)
- PDP seller-rating trust row (real avgRating/reviewCount from users route; hidden when zero reviews**; cart "Available offers" chips (live server coupons, one-tap apply via applyPromo override param**; global offline banner (new OfflineBanner component + NetInfo v12 + _layout wiring**.

## 2026-09-07 — Batch 4 (fourth "fix all" — anti-fabrication sweep) — SHIPPED + VERIFIED (FE tsc exit 0; admin tsc exit 0)
- checkout.tsx fake EMI block DELETED (7 touchpoints: ClockIcon+svg import, Switch import, emiOn/emiPlan state, 4 computeds, installments card, EMI summary row, paymentText suffix concat) — zero invented financing vs server truth. payment-methods.tsx rails restricted to Wallet+COD (UPI/Card dropped — server has no settlement path for them; comment records the wiring bar: UPI intent + KYC merchant). seller-orders.tsx status tabs got a11y role+label. Orders API location confirmed: `susej-admin-panel/src/app/api/app/orders/route.ts` (app-plane).

## 2026-09-07 — Batch 3 (third "fix all" deep pass) — SHIPPED + VERIFIED (FE tsc exit 0; admin tsc exit 0)
- explore.tsx trusts structured `p.condition` (create-wizard field** over fragile text-parsing; product/[id].tsx delivery card mode-aware + honest (pickup/ships-from/local with fee when known**; orders.tsx status filter tabs (All/In Progress/Delivered/Cancelled**; profile.tsx Addresses+Payments tiles; admin dashboard latest-orders drill-down → /dashboard/orders/[id].

## 2026-09-07 — Batch 2 deep pass (repeated "fix all") — SHIPPED + VERIFIED (FE tsc exit 0; admin tsc exit 0)
- PostContext `refresh()` (pull-to-refresh engine: server re-fetch + cache reconcile + liked merge**; feed.tsx RefreshControl wired (backlog #1 CLOSED**; orders.tsx whole-card tappable (View Details** + stopPropagation + a11y labels; admin dashboard externally rewritten to /api/data/summary — my batch-1 edits survived and still work.

## 2026-09-07 — Industry-standard redesign batch (user: "fix all" post 3-surface audit)
- SHIPPED + VERIFIED (FE tsc exit 0, admin tsc exit 0): buyer cart-count badges on feed+explore headers; feed skeleton-on-first-load (PostContext `loaded`); explore results-count row; cart empty-state "Start shopping" CTA + 44px steppers + a11y labels; ProductCard + listings-manager toolbar a11y roles/labels;; admin dashboard "View all orders" link + clickable rows.

## WORKING (verified previously - treat as stable unless regression seen)
- Onboarding: welcome carousel, phone OTP (devCode), profile-setup, location
  picker w/ Nominatim suggestions, interests gating.
- Feed: real DB posts, stories, category rails, For You personalization,
  spotlight pinning, drag-to-camera gesture, creator camera-first shell.
- Buying: product detail, cart, checkout w/ server totals + deliveryFee set
  {0,12,30}, payment-methods wallet balance gate, order placement (COD/wallet),
  strict-from-status tracking timeline, delivered review incl anonymous.
- Selling: 4-step become-seller (KYC payload, store map location, category
  lock), create-post wizard w/ optional listing location, dual-persona comments,
  storefront tabs (Products/Reviews/About), banner editor, theme accents.
- Chat: server threads, businessName header resolution, pinned chat SKU,
  immersive nav, persona composer pill.
- Admin: login+2FA, KYC approve propagation, orders lifecycle across 3 surfaces,
  promo pricing editable w/ config merge, users/sellers/products/reviews truth,
  category sort/count truth.
- Infra: PG18 flow-rebuilt dataset (users/sellers/posts/products/orders/reviews
  counts consistent; followerCounts exact to graph; wallets net-of-commission).

## IN FLIGHT
E2E tester campaign phases P1.2..P7 (details: activeContext.md).

- Aug 31: fresh demo accounts via REAL flows (seller riyasharma 9830000002 /
  buyer aaravkumar 9840000002) + 3 real listings w/ real asset images
  (Handloom Cotton Saree Rs1299, Cotton Kurti Set Rs899, Midi Dress Rs1599) via
  real POST /api/app/posts -> admin Product mirrors lst_* active. Asset images
  served from admin public/products (adb-reverse reachable on device).


## KNOWN ISSUES / logged-not-fixed (triage status in activeContext)
In-memory local contexts without server refetch still listable; admin mojibake
glyphs; legacy SQLite-dialect migrations; unique-constraint anti-double-spend;
web showcase quirks (avatar ring invisible, native-only degrade) documented.

## DORMANT/OPTIONAL backlog
map.tsx synthetic GPS positions for sellers (cosmetic), i18n rollout beyond
settings, maestro flow authoring, web-first showcase polish (Metro web bundles).
