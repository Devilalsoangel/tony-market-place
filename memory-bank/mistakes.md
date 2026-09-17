# Mistake Log (never repeat)

| Trap | What goes wrong | Prevention |
|---|---|---|
| PS Get-Content UTF8 mojibake | Double-encoding corrupts files with non-ASCII | [IO.File]::ReadAllText / WriteAllText always |
| PS Set-Content UTF8 writes BOM | prisma validate breaks silently | strip BOM via UTF8Encoding($false) |
| Regex Groups are STRINGS in PS | "222"+"817"="222817" concat instead of sum | cast [int] before arithmetic/coords |
| node -e inline quoting hell | Escaping eats minutes | write temp .mjs file, node tmp.mjs |
| Select-String on Metro/dist bundles | Silent miss on multi-MB single lines | Node miner readFileSync+indexOf |
| Deep links mid-cold-start | Wedges splash spinner | plain am start + in-app taps until warm |
| uiautomator stale dumps | Byte-identical dumps during shimmer/animation | scroll nudge first; pixel-scan fallback |
| Keyboard covers submit buttons | Tap does nothing | keyevent 111 first |
| input text digit drops | OTP boxes half-filled | type per box; %s for spaces |
| fractional tap coords | Silent miss | always [math]::Round |
| adb reverse cleared on restart | remote-update wedge loops | re-run BOTH reverses after ANY reconnect |
| Turbopack .next corruption | All nested API routes HTML-404 | rm .next + restart admin |
| Cline hB guard analogue: plan-mode command guard | (n/a here) | (n/a) |
| Claiming fixes without rerun | Other agent's stale log blamed | NEVER trust foreign logs; rerun yourself |
| className prop on expo-linear-gradient/rn-web edge components | Positioning/clip silently fail | explicit style props |
| Editing without grep-first | Rebuild what existed; duplicate drift | grep name/id/pattern first |
| Photos of real IG as build source | IP + pixel-cloning regression | own practical design (Aug 25 order) |
| Figma literal cloning | Brainstorm artifacts enter app | three-source rebuild method |
