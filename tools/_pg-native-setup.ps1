param([string]$Step = "all")
$ErrorActionPreference = "Continue"
$root = "C:\Users\TONI\projects\social-commerce\tools"
$pgRoot = "C:\pg16"
$log = Join-Path $root "_pg-native.log"
function L($m) { "$(Get-Date -Format HH:mm:ss) $m" | Out-File $log -Append }

if ($Step -in "all", "extract") {
  L "extracting..."
  if (Test-Path $pgRoot) { Remove-Item $pgRoot -Recurse -Force -ErrorAction SilentlyContinue }
  New-Item -ItemType Directory -Path $pgRoot | Out-Null
  # zip layout: pg16/... -> extract then move up
  Expand-Archive -Path (Join-Path $root "pg-binaries.zip") -DestinationPath $pgRoot -Force
  if (-not (Test-Path "$pgRoot\bin\postgres.exe")) {
    $inner = Get-ChildItem $pgRoot -Directory | Select-Object -First 1
    if ($inner.Name -ne "bin") {
      Get-ChildItem (Join-Path $pgRoot $inner.Name) | Move-Item -Destination $pgRoot -Force
      Remove-Item (Join-Path $pgRoot $inner.Name) -Force -ErrorAction SilentlyContinue
 ho   }
  }
 ho}
 ho ho ho
 ho hoif ($Step -in "all","initdb") {
 ho  L "initdb..."
 ho  New-Item -ItemType Directory -Path "C:\pgdata" -Force |corrupt  | Out-Null
 ho  & "C:\pg16\bin\initdb.exe" -D C:\pgdata -U postgres --pwfile=... -E UTF8 --locale=C 2>&1 | Out-File $log -Append
 ho}