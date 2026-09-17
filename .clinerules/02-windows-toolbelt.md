# Windows Toolbelt (learned the hard way - these recur)

## PowerShell 5.1 landmines
- NEVER `Get-Content` on UTF-8 with non-ASCII (mojibake double-encoding).
  Use `[IO.File]::ReadAllText/$WriteAllText(path, text)` or `-Encoding UTF8`.
- Regex Groups come back STRINGS: cast `[int]$m.Groups[1].Value` BEFORE arithmetic
  or coordinate concat ("222"+"817" becomes "222817").
- Set-Content UTF8 writes BOM in PS5.1: breaks prisma validate - strip BOM via
  `[IO.File]::WriteAllText($p,$t,(New-Object Text.UTF8Encoding $false))`.
- Inlining complex code into `node -e "..."` loses escaping battles: WRITE A TEMP
  `.mjs` FILE (e.g. `%TEMP%\opencode\tmp.mjs`) and run `node tmp.mjs`. Saves turns.

## Giant minified bundles (Metro / dist)
Select-String silently misses needles on multi-MB single-line bundles.
Use a Node miner: readFileSync utf8 + indexOf(pattern) + slice(context).

## Processes / servers
- Detached processes DIE if started with no console from some TUIs: use
  `Start-Process cmd '/c node srv.js > out.log 2>&1' -WindowStyleHidden`.
- Machine restart kills PG(:5432) + admin dev(:3000). Recovery: start-pg.js in
  %TEMP%\opencode\pgserver detached, then restart admin, then Metro.
- Never trust "it errored" claimed by ANOTHER agent's leftover log entry; rerun
  yourself.

## ADB / device (serial often USB or Tailscale)
- DEVICE CHECK = strict short-timeout command; NEVER long retry loops.
- `adb pull` is flaky/dead here - `adb exec-out` redirect via cmd, or `shell cat`
  for text/XML dumps. PNG pull path: `cmd /c "adb exec-out screencap -p > f.png"`.
- `adb reverse tcp:8081 tcp:8081` + `tcp:3000` re-run after EVERY reconnect; wrong
  remaps cause endless "Failed to download remote update" wedges.
- uiautomator dump goes STALE byte-identical when shimmer animates: force fresh
  with tiny scroll nudge, and treat "could not get idle state" as shimmer-loop.
- Keyboard covers buttons: `keyevent 111` before tapping submit targets.
- `input text` drops digits/spaces: type per-box / use %s; fractional tap coords
  silently miss - always `[math]::Round`.

## Net/GOTCHAs
- PS `curl.exe` + JSON -d quoting is broken: use node scripts or
  Invoke-RestMethod instead.
- Node 20 fetch getSetCookie() unreliable: parse raw set-cookie with
  split(/,(?=[^;]+?=)/g).
- Chrome CDP is SHARED infra (other agents): probe 127.0.0.1:9222/json/version
  before assuming; prefer API verification over browser vision.

## Verification loops that pay rent
- FE tsc:  `cd Frontend && npx tsc --noEmit`
- ADMIN:   `cd susej-admin-panel && npx tsc --noEmit`
- Always re-run the OTHER project's tsc too when you touched shared DTO shapes.
