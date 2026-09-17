$out = "C:\Users\TONI\projects\social-commerce\tools\_winnat.log"
"winnat restart $(Get-Date -Format o)" | Out-File $out
try {
  net stop winnat 2>&1 | Out-File $out -Append
  Start-Sleep -Seconds 2
  net start winnat 2>&1 | Out-File $out -Append
  "DONE" | Out-File $out -Append
} catch {
  $_.Exception.Message | Out-File $out -Append
}