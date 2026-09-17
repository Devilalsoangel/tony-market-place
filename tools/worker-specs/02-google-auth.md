# WORKER TASK 02 — Real Google Sign-In (backend + frontend)

Project root: C:\Users\TONI\projects\social-commerce
Current "Continue with Google" is a PLACEHOLDER — make it REAL, end to end.

PATTERNS TO MIRROR (read these first):
- Token minting + user shape: susej-admin-panel/src/app/api/app/auth/verify/route.ts (uses createAppSession / findUserByPhone / toAppUser from "@/lib/app-auth")
- Email auth route for request/validation style: susej-admin-panel/src/app/api/app/auth/email/route.ts
- Frontend login methods: Frontend/contexts/AuthContext.tsx (serverLogin, serverEmailLogin)
- Google button screen: Frontend/app/(onboarding)/auth.tsx

## STEP 1 — Backend: new file susej-admin-panel/src/app/api/app/auth/google/route.ts
POST body: { idToken?: string; devBypass?: boolean; email?: string; name?: string }
Logic, in order:
1. DEV BYPASS: if body.devBypass === true AND process.env.GOOGLE_AUTH_DEV_BYPASS !== "off":
   use body.email (required, validate format) and body.name (default: email prefix). Skip token verification. This exists ONLY for dev testing before OAuth client IDs are configured.
2. REAL PATH: verify idToken by GET https://oauth2.googleapis.com/tokeninfo?id_token=<idToken>
   - Non-200 or error in response -> 401 { error: "Invalid Google token" }
   - aud must equal process.env.GOOGLE_CLIENT_ID; if GOOGLE_CLIENT_ID unset -> 503 { error: "Google login not configured" }
   - email_verified must be true -> else 403 { error: "Google email not verified" }
   - Extract email, name, picture, sub.
3. FIND/PROVISION USER: prisma.user.findFirst({ where: { email } }).
   If none: auto-provision via prisma.user.create:
   - username: email prefix, sanitized to [a-z0-9_]; if taken, append a short numeric suffix (loop or random).
   - name: Google name; email; password: null (or an unmatchable random hash if schema requires non-null — CHECK schema.prisma first); phone: whatever the schema allows for absence (nullable or "").
   - Set role/defaults consistent with how the OTP flow creates users (copy the same defaults).
4. SESSION: const token = await createAppSession(user.id, user.username!); refetch fresh user row; return 200 { token, user: toAppUser(fresh ?? user) }.
Error shape everywhere: { error: string }. No stack traces, no raw prisma errors.

## STEP 2 — Frontend deps
In Frontend/: npm install expo-auth-session expo-crypto --save
(If npm RAM pressure kills it, retry once; these are pure-JS/JC-safe packages.)

## STEP 3 — Frontend wiring
1. Frontend/app.json: inside "extra" add "googleClientId": "" (placeholder for Tony's OAuth Web Client ID; leave empty).
2. Frontend/contexts/AuthContext.tsx: ADD a new method serverGoogleLogin(idToken: string): Promise<{ ok: boolean; error?: string }> to the interface + provider.
   Implementation: POST /api/app/auth/google with { idToken } using the same fetch helper pattern serverLogin uses; on 200 + { token, user }: persist EXACTLY like serverLogin does (same sessionStorage calls, setUser, setIsLoggedIn, bump sessionSeq and tokenSeq), return { ok: true }. Any failure returns { ok: false, error }. Do NOT refactor existing methods — additive only.
3. Frontend/app/(onboarding)/auth.tsx: replace the placeholder Google handler with REAL logic:
   - useAuthRequest from expo-auth-session, issuer "https://accounts.google.com", clientId from Constants.expoConfig?.extra?.googleClientId, scopes ["openid","email","profile"], responseType ResponseType.IdToken, redirectUri = makeRedirectUri({ native: "susej://auth/google" }).
   - On response success: setGoogleBusy(true) -> serverGoogleLogin(response.params.id_token) -> on ok navigate exactly where successful OTP login navigates. On fail show the same inline error UI pattern the screen already uses for phone/email errors.
   - Button behavior: disabled + "Signing in..." while busy; never double-fire.
   - DEV escape hatch: when __DEV__ and extra.googleClientId is empty, ALSO render a small low-emphasis text button "Dev: test Google (bypass)" that calls serverGoogleLogin with a devBypass POST — implement via a new optional param serverGoogleLogin(idToken: string, devBypass?: { email: string; name?: string }) that posts { devBypass: true, email, name } when devBypass provided. Use a simple Alert.prompt-style input (TextInput in a Modal or Alert with prompt on iOS is fine on Android: use a tiny inline TextInput row) to ask for an email. This lets us test the full session path today without real OAuth IDs. It must render ONLY when __DEV__.
   - useAuthRequest effect: when response.type === "success", run the login; on "error"/"dismiss" clear busy and show error.

## STEP 4 — VERIFY (all must pass, capture exit codes):
a. cd susej-admin-panel; npx tsc --noEmit
b. cd Frontend; npx tsc --noEmit
c. Live API test (admin dev server runs on http://127.0.0.1:3000):
   curl -s -X POST http://127.0.0.1:3000/api/app/auth/google -H "Content-Type: application/json" -d "{\"devBypass\":true,\"email\":\"g.tester@susej.dev\",\"name\":\"G Tester\"}"
   Expect 200 with { token: "susej_N_...", user: {...} }. Run it TWICE: second call must return the SAME user id (idempotent provisioning, no duplicate).
   Also test negative: devBypass true without email -> 400; devBypass with GOOGLE_AUTH_DEV_BYPASS unset is allowed (default on) but with "off" must 401 — if you cannot set env for the running server, note it in the report instead of failing.
d. Real Google path (no devBypass) with a garbage idToken -> expect 401 (if GOOGLE_CLIENT_ID unset you may get 503; report which).

## STEP 5 — Report: append tools/worker-logs/02-report.md
FILES CHANGED / WHAT WAS PLACEHOLDER / FIXES / VERIFY RESULTS (all exit codes + curl outputs) / KNOWN LIMITS.
End your final message with exactly: DONE-02 <count> fixes
