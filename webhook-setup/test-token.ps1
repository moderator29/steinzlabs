# Quick sanity check — is the auth token valid and the endpoint reachable?
# Lists your webhooks. If this fails the same way the add-addresses script
# does, the issue is not chunk size — it's auth or endpoint.

if (-not $env:ALCHEMY_NOTIFY_TOKEN) {
    Write-Host "ERROR: `$env:ALCHEMY_NOTIFY_TOKEN not set" -ForegroundColor Red
    exit 1
}

Write-Host "Testing token: $($env:ALCHEMY_NOTIFY_TOKEN.Substring(0, 8))..." -ForegroundColor Cyan

Write-Host ""
Write-Host "TEST 1: list webhooks (X-Alchemy-Token header)"
try {
    $r = Invoke-RestMethod `
        -Uri "https://dashboard.alchemy.com/api/team-webhooks" `
        -Headers @{ "X-Alchemy-Token" = $env:ALCHEMY_NOTIFY_TOKEN }
    Write-Host "  OK — found $($r.data.Count) webhook(s)" -ForegroundColor Green
    $r.data | Select-Object id, network, webhook_url | Format-Table
} catch {
    Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) { Write-Host "  Body: $($_.ErrorDetails.Message)" }
}
