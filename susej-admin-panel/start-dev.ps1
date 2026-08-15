$logFile = Join-Path (Get-Location) "dev-server.log"
$env:NODE_ENV = "development"
Start-Transcript -Path $logFile -Force
npx next dev -p 3000
Stop-Transcript