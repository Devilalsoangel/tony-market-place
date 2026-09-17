# WORKER TASK 01 — Auth + Onboarding module (production-grade pass)

Project root: C:\Users\TONI\projects\social-commerce
- Mobile app (Expo RN): Frontend/  (screens in Frontend/app/, API helpers in Frontend/services/)
- Backend API (Next.js routes): susej-admin-panel/src/app/api/

SCOPE (only these): Frontend/app/index.tsx (onboarding), Frontend/app/login.tsx, any auth service/context files they import (Frontend/services/*, Frontend/contexts/*), and the matching backend routes in susej-admin-panel/src/app/api/**auth**/**.

GOAL: make auth + onboarding PRODUCTION-GRADE. Fix real issues with surgical edits. Do NOT redesign UI, do NOT touch other modules, do NOT change DB schema.

STEPS:
1. Read every scoped file AND the API endpoints they call. Build a wiring map: button -> handler -> endpoint -> DB.
2. For each screen verify: no dead buttons (every onPress does something real), no mock/fake data, no handlers that only console.log, no TODO-stubs.
3. FIX (must):
   - OTP login: request OTP -> verify -> persist token securely (expo-secure-store or existing storage util) -> redirect to home. Wrong OTP and network failure must show inline error text, never silent.
   - Every submit button gets a loading/disabled state to prevent double-submit.
   - Onboarding: the hero preview image is a blurred placeholder — replace with a proper local asset or clean gradient card with icon (no remote URL dependency).
   - Logout (if present in scope) must clear token + reset app state.
4. VERIFY: run `npx tsc --noEmit` inside Frontend/ (if tsconfig exists; else `npx expo export --help` level check is NOT enough — use tsc). It must pass, or be no worse than before your edits (run it BEFORE edits first to capture baseline).
5. REPORT: append to tools/worker-logs/01-report.md with sections: FILES CHANGED / WHAT WAS BROKEN / FIXES / VERIFY RESULT (tsc exit code before & after).

When finished, end your final message with exactly: DONE-01 <count> fixes
