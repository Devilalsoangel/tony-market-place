# susej — Quick Start & Contributing Guide

**susej** is a social-commerce marketplace (Instagram feed + OLX selling + Facebook communities). React Native / **Expo SDK 57** / TypeScript / expo-router / NativeWind. App runs in **demo mode** — all state lives in React Context + AsyncStorage (`@susej_*` keys); the FastAPI backend is scaffolded but never called.

---

## 1. Prerequisites

- **Node 22.x** (system install: `C:\Program Files\nodejs`)
- **npm** (ships with Node)
- **Git**
- **Expo Go** (SDK 57-compatible) on an Android device, or an Android emulator
- **adb** — `C:\Users\TONI\platform-tools\adb.exe` (use full path, never rely on PATH)
- Python 3.10+ — only if you touch `Backend/`

## 2. Setup & Run

```bash
cd Frontend
npm install
npx expo start          # Metro on http://127.0.0.1:8081 (default)
```

On device:
- **USB**: `C:\Users\TONI\platform-tools\adb.exe reverse tcp:8081 tcp:8081`, then scan the QR with Expo Go
- **Wireless**: Expo Go → enter the LAN/Tailscale URL Metro prints (e.g. `exp://100.92.233.78:8081`)

Verify Metro is up before launching: `http://127.0.0.1:8081/status` must respond.

**Port rule:** if 8081 is taken, pick a free port (`C:\Users\TONI\.config\opencode\scripts\port-manager.ps1`) and pass `--port <N>` to Expo. Never kill an unknown process on a port.

## 3. Repo Map

```
social-commerce-template/
├── Frontend/
│   ├── app/            # 36 route files (expo-router): 3 layouts + 33 screens
│   │   ├── _layout.tsx # root: SafeAreaProvider + 9 contexts + Stack
│   │   ├── index.tsx   # Splash (2s) → redirect
│   │   ├── (onboarding)/  # 8 screens + own Stack
│   │   └── (tabs)/        # Feed · Explore · Create · Chat · Profile
│   ├── contexts/       # 9 providers: Auth, Follow, Bookmark, Post, Notification,
│   │                   #   Settings, Cart, Order, Community (persist @susej_* keys)
│   ├── components/     # 23 shared components (mostly unwired — see docs/08)
│   ├── utils/          # theme.ts (colors.* tokens), icons.tsx (Svg/Path),
│   │                   #   productImages.ts, storage.ts (+ 4 dead files)
│   └── assets/         # Figma exports: 143 SVGs + 158 PNGs
├── Backend/            # FastAPI scaffold (10 routers) — NOT called; utils/api.ts is dead
├── docs/               # 00–09 living reference series (start at 00-overview.md),
│                       #   FEATURE-SPECS.md (product spec), SUSEJ-REBUILD-PLAN.md,
│                       #   UI-PIXEL-PERFECT-REFERENCE.md (design)
└── AGENTS.md           # agent session memory (auto-loaded system file — do not delete)
```

## 4. Hard Rules (see docs/00 §5 for the full list)

- **No hardcoded colors** — every color from `colors.*` in `Frontend/utils/theme.ts` (Stitch tokens: `primary #4343d5`, `primaryContainer #5d5fef`, `surface #fcf8ff`, `surfaceContainerLow #f5f2ff`, `textPrimary #1a1a2e`, `outlineVariant #c7c4d7`). Exceptions: picsum/randomuser image URLs only.
- **Icons are Svg/Path components** from `utils/icons.tsx` — no MaterialCommunityIcons.
- **Font is Inter** everywhere (weights 400/500/600/700).
- **Safe-area-aware fixed bars** — headers `52 + insets.top`, tab bar `55 + insets.bottom`, via `useSafeAreaInsets`.
- **Image fallback chain** — `item.image ? {uri} : productImages[item.id]`.

## 5. Common Tasks

- **Add a screen** — create `app/<name>.tsx` (the filename IS the route), wire navigation with `router.push` / `Link`. Then: update the `Screen` type union if needed, register in any layout, run tsc, and update `docs/00-overview.md` tables if the screen is significant.
- **Verify nothing broke** — `npx tsc --noEmit` (expected noise: expo `TS6046` ES2025 warnings; must be 0 code errors).
- **Start backend locally (optional)** — `Backend/` has a FastAPI app + requirements; it is currently NOT wired into the app (api.ts hardcodes a LAN IP and is never called).

## 6. Contributing Workflow

1. One concern per branch; short descriptive commits.
2. Run `npx tsc --noEmit` before finishing — never leave a broken build.
3. No secrets/API keys in code (`.env.example` is the template; real values stay local).
4. Follow the hard rules in §4 and existing patterns in the file you touch.
5. Keep docs honest: when a screen's stage changes (`rebuilt` / `wired` / `stub`), update its row in `docs/00-overview.md` and its chapter.

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| Expo Go can't connect | Check `http://127.0.0.1:8081/status`; restart `npx expo start`; on USB re-run `adb reverse tcp:8081 tcp:8081` |
| adb hangs / device missing | `C:\Users\TONI\platform-tools\adb.exe kill-server`, wait 5–10s for daemon, retry |
| Port 8081 in use | Use `port-manager.ps1` to find a free port; start Metro with `--port <N>` |
| tsc errors after adding a screen | Check Screen type union + layout registration + prop names match (see AGENTS.md Mistake Log) |
| Styles not applying | `npx expo start --clear` |

## 8. Further Reading

- `docs/00-overview.md` — index, audit, master backlog (start here)
- `docs/FEATURE-SPECS.md` — product requirements (surviving spec)
- `docs/UI-PIXEL-PERFECT-REFERENCE.md` — Figma design tokens & typography
- `docs/SUSEJ-REBUILD-PLAN.md` — tech stack + pixel-perfect rebuild plan (completed)
