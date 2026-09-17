# Project Dossier: susej marketplace (social-commerce-template)

Instagram-style social commerce: product posts + follows feed + communities +
chat negotiation + storefronts. Three surfaces, one PostgreSQL.

## Layout (absolute)
- `Frontend/`         React Native Expo SDK 57 (TypeScript, expo-router ~66 routes,
                      NativeWind, tokens in utils/theme.ts). Node 22.
- `susej-admin-panel/` Next.js admin (:3000) + Prisma + ALL `/api/app/*` and
                       `/api/data/*` routes (single server serves both roles).
- `backend/`          legacy FastAPI reference (mostly inactive in current cycles).
- DB: PostgreSQL 18 at %TEMP%\opencode\pgserver\data via `node start-pg.js`
      (port 5432, user/pass postgres/postgres, database susej).
      NEVER point prisma at the old LOCALAPPDATA postgres16 snapshot dir.

## Ports / identity
8081 Metro (bind WITHOUT --localhost so IPv4 reverse works) | 3000 admin | 9222 CDP chrome.
Admin auth: POST /api/login {loginId,password} -> {twoFactor:true} ->
POST /api/login/verify-2fa {code:123456} -> cookie **susej_session**
(NOT auth-token). Wrong path /api/verify-2fa = silent 404.
App auth: OTP flow mints Bearer token starting `susej_` sent in Authorization.
Admin data plane GET needs cookie; writes accept `x-app-key` limited allowlist.

## Data truths (R-series rebuilt through REAL flows - protect this invariant)
Users/sellers/posts/products/orders are created via REAL app HTTP calls
(register OTP -> profile -> become-seller -> create post), never via mass SQL
seeding. Mirrors exist: Post<-Product (lst_<postId>), sellers PATCH propagates
to User rows by phone. Category counts are COMPUTED live, not stored fiction.
seed.ts is CONFIG-ONLY + NON-DESTRUCTIVE (never re-add entity seeding).
seed-app.ts historically DESTRUCTIVE - do not resurrect.

## Verification commands
FE: cd Frontend && npx tsc --noEmit        ADMIN: cd susej-admin-panel && npx tsc --noEmit
DB probe: curl http://localhost:3000/api/v1/config (must be 200 json)
Stack health: Metro /status on 8081; admin /dashboard SSR; netstat 5432.

## Recovery playbook
- All nested /api/app routes HTML-404 -> Turbopack .next corrupted: rm -rf
  susej-admin-panel/.next && restart admin.
- Expo white-screen wedge: re-run BOTH reverses + force-stop host.exp.exponent,
  relaunch plain `am start` (no deep link into subroutes while cold).
- Stale bundle on device despite fresh Metro: pm clear host.exp.exponent.

## Design tokens quickset
primary #4343d5, primaryContainer #5d5fef, surfaces #fcf8ff/#f5f2ff/#efecff/#fff,
outlineVariant #c7c4d7, inverseSurface #2f2e43, error #ba1a1a. Inter font. NO
hardcoded colors outside theme.ts (picsum/randomuser URLs exempt). NO emoji in
code. Icons: inline SVG components.

## Where prior intelligence lives (read these before deep-dives)
docs/GPT-VISUAL-AUDIT-CONTEXT.md, FEATURE-SPECS.md, Frontend/utils/theme.ts,
Frontend/utils/serverApi.ts, susej-admin-panel/src/lib/app-auth.ts.
