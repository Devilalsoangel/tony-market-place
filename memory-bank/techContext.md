# Tech Context

## Stack
| Layer | Tech | Notes |
|---|---|---|
| Mobile | Expo SDK 57, React Native, TypeScript, expo-router (~66 routes), NativeWind, AsyncStorage contexts | Node v22.16.0 required |
| Admin/API | Next.js dev server :3000, Prisma ORM -> PostgreSQL, server routes under src/app/api/** | single origin serves admin UI + all APIs |
| Database | PostgreSQL 18 embedded at %TEMP%\opencode\pgserver\data (start-pg.js), port 5432 susej/postgres | never use pg16 snapshot |
| Legacy ref | backend/ FastAPI | mostly idle; pytest suite exists |

## Paths to remember
- Windows global npm cline CLI at %APPDATA%\npm\cline.ps1.
- ADB at C:\Users\TONI\platform-tools. Devices via USB/Tailscale wireless.
- Figma hi-res refs: Frontend/assets/screens/hi-res/*.png.
- Design tokens: Frontend/utils/theme.ts.

## Common commands
```
cd Frontend && npx tsc --noEmit          # FE gate
cd susej-admin-panel && npx tsc --noEmit # ADMIN gate
node start-pg.js                          # inside %TEMP%\opencode\pgserver (detached!)
set EXPO_NO_TELEMETRY=1&& cd Frontend && npx expo start --offline --port 8081 --clear
adb reverse tcp:8081 tcp:8081 ; adb reverse tcp:3000 tcp:3000   # after every reconnect
```

## Environment constraints
- Windows PowerShell 5.1 shell quirks (see .clinerules/02-windows-toolbelt.md).
- Turbopack .next corruption breaks nested API routes -> rm .next + restart.
- Machine restart kills PG + admin silently; check before any E2E attempt.
- Never `npx install` new deps without asking; commit only when user says.

## Config/knowhow files
docs/GPT-VISUAL-AUDIT-CONTEXT.md (vision audit contract) · utils/serverApi.ts
(app->server client) · src/lib/app-auth.ts (admin-side auth+OTP logic).
