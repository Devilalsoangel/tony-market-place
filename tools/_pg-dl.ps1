$zip = "C:\Users\TONI\projects\social-commerce\tools\pg-binaries.zip"
$log = "C:\Users\TONI\projects\social-commerce\tools\_pg-dl.log"
"start $(Get-Date -Format o)" | Out-File $log
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$urls = @(
  "https://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64-binaries.zip",
  "http://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64-binaries.zip"
)
foreach ($u in $urls) {
  try {
    "trying $u" | Out-File $log -Append
    Invoke-WebRequest -Uri $u -OutFile $zip -UseBasicParsing -TimeoutSec 900
    "OK $((Get-Item $zip).Length) bytes" | Out-File $log -Append
    break
  } catch {
    "ERR: $($_.Exception.Message)" | Out-File $log -Append
  }
}