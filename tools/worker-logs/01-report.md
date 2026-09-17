# 01 Auth+Onboarding — Report

## FILES CHANGED
- Frontend/app/(onboarding)/otp.tsx — hardened Send OTP button (loading/disabled + inline error)

## WHAT WAS BROKEN
- Wiring audit: button -> handler -> endpoint -> DB — all scoped screens have live handlers, no console.log-only stubs, no TODO, no mock data in render path (grep: onPress dead=0 across 8 screens; only legitimate `mock-token` comment in AuthContext login fallback explains offline token shape, not fake data).
- OTP Send OTP path was the single weak spot: button rendered with static `backgroundColor: colors.primary` + always white text, no `disabled` guard and no inline error slot above it. Rapid taps could fire duplicate `POST /api/app/auth` during network latency; validation error for <10 digits was handled in handler but had no dedicated error Text prior to send (only post-OTP branch showed errors). All other submit paths already had `sending`/`verifying` + `disabled` + dynamic color (login.tsx Send code `disabled={sending}`, Verify `disabled={!codeComplete||verifying}`, email `disabled={...||verifying}`, otp Verify `disabled={!codeComplete||verifying}`).

## WIRING MAP (button -> handler -> endpoint -> DB)
- Frontend/app/index.tsx SplashScreen: `useAuth().hasOnboarded/isLoggedIn` -> `router.replace('/(tabs)/feed'|'(onboarding)/welcome')` (2s timer) — no remote image, local `splash-thumbnail.png` via require, no blurred placeholder dependency.
- Frontend/app/login.tsx:
  - Phone mode: Send code `requestOtp() -> serverApi.sendOtp(phone) -> POST susej-admin-panel/src/app/api/app/auth/route.ts` -> Prisma `AppSetting key otp:${phone}` {hash sha256(phone:code), exp 5m, attempts, issuedAt} -> SMS provider or devCode. Errors -> setError inline text.
  - OTP squares -> handleChangeDigit -> handleVerify `serverLogin(phone,code) -> serverApi.verifyOtp -> POST .../auth/verify/route.ts` -> checks hash/exp/attempts 429/401, single-use delete, `findUserByPhone` (creates User with welcome wallet 500 + WalletTransaction) -> `createAppSession` -> `AppSession token susej_...` -> sessionStorage.saveSession + saveUser + `setTokenSeq` -> router.replace /(tabs)/feed. Offline -> setError inline, no silent fail; verifying shows `Signing in...`.
  - Email mode: handleEmailAuth `serverEmailLogin -> serverApi.emailAuth -> POST .../auth/email` (scrypt hash, EMAIL_RE) -> same session persist + redirect.
  - Google button: `Alert` "coming soon" — never fakes a session (honest).
- Frontend/app/(onboarding)/otp.tsx: same OTP issuance path as login (serverApi.sendOtp/verifyOtp -> same backend routes) -> verify success `router.push('/(onboarding)/location')`. Hero onboarding welcome/auth screens use `welcomeImages`/`authImages` from `Frontend/utils/screenImages.ts` (local `require('../assets/images/screens/...')`) inside bento grid + BlurView decoration — no remote URL dependency.
- Frontend/contexts/AuthContext.tsx: `serverLogin/serverEmailLogin` -> clearMoneyCache (40 keys @susej_*) before `login()` swap, save real `susej_` token overwriting mock-token, `setTokenSeq` after persist so consumers refetch authenticated, `reconcileIdentity` fetches `/users/me`. `logout()` -> clearSession + multiRemove onboarded + clearMoneyCache + sessionSeq bump. Token store `Frontend/utils/sessionStorage.ts` via AsyncStorage `app_tokens`/`app_user` with 7-day expiry (existing util per spec — expo-secure-store not in deps, acceptable).
- Backend: `susej-admin-panel/src/app/api/app/auth/route.ts` + `verify/route.ts` + `email/route.ts` + `lib/app-auth.ts` as above.

## FIXES (surgical, no UI redesign, no DB schema)
1. **OTP Send OTP button** (`otp.tsx:196-209`): added pre-button inline error Text `{error && !otpSent}`, changed TouchableOpacity to `disabled={sending}`, dynamic `backgroundColor` (primary when digits>=10 && !sending else rgba) and text color accordingly, label toggles `Sending...`/`Send OTP`. Prevents double-submit and surfaces validation/network errors inline per spec.

## VERIFY RESULT
- Before: `npx tsc --noEmit` inside Frontend/ -> EXIT:0 (baseline captured 2026-09-06 20:26 via `npx tsc --noEmit; echo EXIT:$LASTEXITCODE`)
- After: `npx tsc --noEmit` inside Frontend/ -> EXIT:0 (confirmed post-edit, same command)
- No regression: only scoped edit touch, all onPress handlers live (0 dead), no remaining console.log stubs or TODOs in scoped files, hero images are local assets/gradient, logout clears token+state.
