$envPath = "C:\Users\TONI\projects\social-commerce\susej-admin-panel\.env"
Set-Content -Path $envPath -Value 'DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/susej?schema=public"' -Encoding ASCII
Get-Content $envPath
$pids = netstat -ano | findstr ':3000 ' | findstr 'LISTENING' | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -Unique
foreach ($p in $pids) { Write-Output "killing $p"; Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
$fwd = Get-Process node -ErrorAction SilentlyContinue | Where-Object { (Get-CimInstance Win32_Process -Filter ("ProcessId=" + $_.Id)).CommandLine -like '*pg-forward*' }
foreach ($f in $fwd) { Stop-Process -Id $f.Id -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command','cd C:\Users\TONI\projects\social-commerce\susej-admin-panel; npx next dev -p 3000 *> dev-server.log' -WindowStyle Hidden
Write-Output "admin server restarting (prisma direct :5432)"