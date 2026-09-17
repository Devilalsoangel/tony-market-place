---
name: verify-first
description: Mandatory evidence-gate pass BEFORE claiming any code change done/fixed/passing in this repo. Use whenever a change to Frontend/, susej-admin-panel/, backend/, or shared DTOs was made, or when about to claim success. Runs tsc gates, stack health probes, and forces an evidence class on every claim.
---

# Verify First (evidence gate)

Run these in order; do not skip; do not paraphrase results away.

## 1. Compile gate
```powershell
cd Frontend ; npx tsc --noEmit          # expect exit 0
cd ..\susej-admin-panel ; npx tsc --noEmit   # expect exit 0 if admin/shared touched
```
If you touched shared DTO shapes (types used by BOTH apps), BOTH must be green.
Report the exit codes verbatim. Non-zero -> you are NOT done; fix, do not narrate.

## 2. Stack health (only for claims involving live data/API/device)
```powershell
curl.exe -s http://localhost:3000/api/v1/config    # expect 200 + JSON catalog
netstat -ano | findstr :5432                        # PG listening
netstat -ano | findstr :8081                        # Metro (device claims only)
```

## 3. Evidence classes (attach to every claim)
| Claim type | Valid evidence |
|---|---|
| Code compiles | exit code 0 pasted |
| API behaves | HTTP status + response body (verbatim JSON) |
| DB row changed | row content via SELECT/pg probe |
| UI renders correctly | device dump section AND/OR screencap pixel values |
No evidence class attached => say `UNVERIFIED` explicitly and keep the task open.

## 4. When blocked
State the blocker plainly ("PG down", "device gone") rather than silently
skipping gates. Partial work reported > hidden breakage.
