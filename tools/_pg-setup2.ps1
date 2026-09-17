$ErrorActionPreference = "Continue"
$root = "C:\Users\TONI\projects\social-commerce\tools"
$pgRoot = "C:\pg16"
$pgData = "C:\pgdata"
$log = Join-Path $root "_pg-native.log"
function L($m) { "$(Get-Date -Format HH:mm:ss) $m" | Out-File $log -Append }

L "=== step 1: extract ==="
if (Test-Path $pgRoot) { Remove-Item $pgRoot -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $pgRoot -Force | Out-Null
Expand-Archive -Path (Join-Path $root "pg-binaries.zip") -DestinationPath $pgRoot -Force
if (-not (Test-Path "$pgRoot\bin\postgres.exe")) {
  $inner = Get-ChildItem $pgRoot -Directory | Select-Object -First 1
  if ($inner) {
    Get-ChildItem (Join-Path $pgRoot $inner.Name) | Move-Item -Destination $pgRoot -Force
    Remove-Item (Join-Path $pgRoot $inner.Name) -Recurse -Force -ErrorAction SilentlyContinue
  }
}
if (Test-Path "$pgRoot\bin\postgres.exe") { L "extract OK" } else { L "extract FAILED"; exit 1 }

L "=== step 2: initdb ==="
if (-not (Test-Path "$pgData\PG_VERSION")) {
  New-Item -ItemType Directory -Path $pgData -Force | Out-Null
  "postgres" | Out-File "$root\_pgpw.txt" -Encoding ASCII
  & "$pgRoot\bin\initdb.exe" -D $pgData -U postgres --pwfile="$root\_pgpw.txt" -E UTF8 --locale=C --auth=trust 2>&1 | Select-Object -Last 3 | Out-File $log -Append
  Remove-Item "$root\_pgpw.txt" -Force
  if (Test-Path "$pgData\PG_VERSION") { L "initdb OK" } else { L "initdb FAILED"; exit 1 }
} else { L "initdb skipped (exists)" }

L "=== step 3: start server ==="
$pgProc = Get-Process postgres -ErrorAction SilentlyContinue
if (-not $pgProc) {
  $pgLog = "$pgData\log.txt"
  Start-Process "$pgRoot\bin\pg_ctl.exe" -ArgumentList "-D `"$pgData`"","-l `"$pgLog`"","start" -Wait -WindowStyle Hidden
  Start-Sleep 3
}
$ready = & "$pgRoot\bin\pg_isready.exe" -h 127.0.0.1 -p 5432
L "ready: $ready"

L "=== step 4: create db + restore ==="
$env:PGPASSWORD = "postgres"
& "$pgRoot\bin\psql.exe" -h 127.0.0.1 -U postgres -c "CREATE DATABASE susej" 2>&1 | Out-File $log -Append
& "$pgRoot\bin\psql.exe" -h 127.0.0.1 -U postgres -d susej -f (Join-Path $root "susej-dump.sql") 2>&1 | Select-Object -Last 5 | Out-File $log -Append
L "=== DONE ==="