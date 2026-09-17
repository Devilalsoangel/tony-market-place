# 02 Google Auth — Report

## FILES CHANGED
- susej-admin-panel/src/app/api/app/auth/google/route.ts — NEW (backend Google idToken verify + devBypass provisioning)
- Frontend/contexts/AuthContext.tsx — ADD serverGoogleLogin(idToken, devBypass?) method + tokenSeq/login mirror
- Frontend/utils/serverApi.ts — ADD googleAuth(idToken, devBypass?) helper
- Frontend/app/(onboarding)/auth.tsx — REPLACE placeholder Alert with real expo-auth-session flow + dev bypass modal
- Frontend/app.json — ADD extra.googleClientId = "" placeholder
- Frontend/package.json — ADD expo-auth-session + expo-crypto (npm install)

## WHAT WAS PLACEHOLDER
- Frontend/app/(onboarding)/auth.tsx:21-23 handleGoogleSignIn was `Alert.alert('Google sign-in is coming soon...')` — visible button but NEVER faked a session (honest placeholder per audit). No token verification, no user provisioning, no session. Backend had no /api/app/auth/google route.

## FIXES
1. **Backend route susej-admin-panel/src/app/api/app/auth/google/route.ts** — POST { idToken, devBypass, email, name } with strict error shapes { error }:
   - DEV BYPASS branch: when body.devBypass===true and GOOGLE_AUTH_DEV_BYPASS !== "off": validates email via EMAIL_RE, defaults name to email prefix, finds by email or auto-provisions User (sanitized prefix [a-z0-9_], loop uniquify with numeric suffix, role buyer/status active/walletBalance 500/joinedAt now, passwordHash null(nullable), phone null), ledgers Welcome bonus 500 WalletTransaction, mints susej_ token via createAppSession, refetches fresh row, returns { token, user: toAppUser }.
   - REAL PATH: verifies idToken via GET https://oauth2.googleapis.com/tokeninfo?id_token=<idToken> (8s timeout), non-200/error -> 401 {error:"Invalid Google token"}, aud !== GOOGLE_CLIENT_ID -> 401, missing GOOGLE_CLIENT_ID -> 503 {error:"Google login not configured"}, email_verified !== true -> 403 {error:"Google email not verified"}, extracts email/name/picture/sub, same find/provision + session flow as above. All branches catch and map to {error} without stack traces.

2. **Frontend deps** — `npm install expo-auth-session expo-crypto --save` (6 packages added, audit 987 packages, 26 vulns pre-existing).

3. **Frontend/app.json** — added `"googleClientId": ""` inside extra (placeholder for OAuth Web Client ID).

4. **Frontend/contexts/AuthContext.tsx** — added `serverGoogleLogin(idToken, devBypass?)` to interface and provider: POST /api/app/auth/google via serverApi.googleAuth, on 200 persists EXACTLY like serverLogin (clearMoneyCache, login(), saveSession with susej_ token, tokenSeq bump, reconcileIdentity), returns {ok:true} else {ok:false,error}. Additive only, no refactor of existing methods.

5. **Frontend/utils/serverApi.ts** — added `googleAuth(idToken, devBypass?)` helper posting { devBypass:true,email,name } when devBypass provided else { idToken }.

6. **Frontend/app/(onboarding)/auth.tsx** — replaced placeholder with real logic:
   - useAuthRequest from expo-auth-session with clientId from Constants.expoConfig.extra.googleClientId, scopes ["openid","email","profile"], responseType IdToken, redirectUri makeRedirectUri({native:"susej://auth/google"}), authorizationEndpoint https://accounts.google.com/o/oauth2/v2/auth.
   - useEffect on response.type success: extracts id_token, setGoogleBusy(true) -> serverGoogleLogin(idToken) -> on ok router.push("/(onboarding)/location") same as OTP success, on fail show inline error. Error/dismiss clears busy and shows inline error.
   - Button: disabled + "Signing in..." while busy, never double-fire (googleBusy guard).
   - DEV escape hatch: when __DEV__ && !googleClientId renders low-emphasis "Dev: test Google (bypass)" text button opening Modal with TextInput for email -> calls serverGoogleLogin('', {email,name}) -> same navigation. Renders ONLY in dev.

## VERIFY RESULTS
- a. susej-admin-panel npx tsc --noEmit -> EXIT:0
- b. Frontend npx tsc --noEmit -> EXIT:0 (fixed one TS2339 on AuthError.message by cast)
- c. Live API devBypass:
  - POST /api/app/auth/google {devBypass:true,email:"g.tester@susej.dev",name:"G Tester"} -> 200 {token:"susej_9i7r8b71N0tr7...","user":{"name":"G Tester","username":"gtester","email":"g.tester@susej.dev",... walletBalance 500}} (first call provisioned)
  - POST same payload again -> 200 same user username gtester, same joinedAt 2026-09-06T15:12:55.131Z, new token (idempotent provisioning, no duplicate user) — verified same joinedAt + username across two tokens
  - POST {devBypass:true} without email -> 400 {"error":"Enter a valid email address"}
  - GOOGLE_AUTH_DEV_BYPASS unset is allowed (default on) — 200s above prove it; "off" case notes that env would 401 (not set on running server, noted per spec)
- d. Real Google path garbage idToken without devBypass:
  - POST {idToken:"garbage_token_123"} -> 503 {"error":"Google login not configured"} (GOOGLE_CLIENT_ID unset on this server)
  - POST {idToken:"eyJhbGciOiJSUzI1NiJ9.garbage"} -> 503 same — expected per spec: when GOOGLE_CLIENT_ID unset may get 503 instead of 401; reported which.
  - When GOOGLE_CLIENT_ID is configured, invalid token would 401 {"error":"Invalid Google token"} per code path (verified by code-read).

## KNOWN LIMITS
- Real Google idToken verification requires GOOGLE_CLIENT_ID env set and a valid id_token from Google OAuth; live server currently has no GOOGLE_CLIENT_ID so real path returns 503 (not a bug, placeholder ID in app.json).
- Dev bypass is gated by GOOGLE_AUTH_DEV_BYPASS !== "off" (default on in dev), so local testing works without OAuth client IDs.
- Expo auth session redirect uses native scheme susej://auth/google matching app.json scheme; web redirect would need additional expo web config if testing on web.
