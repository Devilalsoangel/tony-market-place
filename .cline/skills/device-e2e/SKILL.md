---
name: device-e2e
description: Android device walkthrough protocol for this Expo app. Use when testing screens end-to-end on the physical device, taking captures for GPT vision verdicts, verifying gestures/pixels, or driving real flows like orders and wizard steps.
---

# Device E2E (drive like a real user)

## Preconditions (verify every time, short timeouts only)
```powershell
adb devices                        # serial ready; strict timeout, NO retry loops
adb reverse tcp:8081 tcp:8081      # BOTH reverses after every reconnect
adb reverse tcp:3000 tcp:3000
```
Stack: Metro /status 200 on 8081, admin /api/v1/config 200.

## Driving rules
- Navigation by TAPS/GESTURES ONLY on-screen; deep links forbidden except user
  says otherwise; plain `am start host.exp.exponent` relaunch allowed.
- Dumps go STALE during shimmer/animations: send tiny scroll nudge, re-dump;
  "could not get idle state" = shimmer-loop, switch to screencap pixel scan.
- Screenshots via `adb exec-out screencap -p` captured as bytes (PowerShell pipe
  corrupts PNG - redirect via cmd or capture from Node spawn buffer).
- Money on dumps gets rupee-glyph-mangled: cross-check digits vs DB/API truth.
- Keyboard: keyevent 111 before submit taps; type per-box for digits.
- Coordinates: bounds center rounded with [math]::Round; y below 2100 misses on
  camera shutter ( Vivo offset known ).

## Captures for GPT vision
Save under %TEMP%\opencode\ with intent-name prefix, verify size >60KB else
re-enter route once; record dump text alongside the PNG for the reviewer chat.

## After walkthrough
Log findings by severity; dead taps/trust damage are HIGH; note honest empty/
loading/error presence; update memory-bank activeContext.md state so sessions
can resume exactly (which screen, which account, which step).
