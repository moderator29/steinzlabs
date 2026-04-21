# Quick sanity check — is the auth token valid?
# Lists your webhooks. If this succeeds, auth is fine and the issue is
# the update-webhook-addresses endpoint specifically.

if (-not $env:ALCHEMY_NOTIFY_TOKEN) {
    Write-Host "ERROR: set env:ALCHEMY_NOTIFY_TOKEN first" -ForegroundColor Red
    exit 1
}

$tokenPreview = $env:ALCHEMY_NOTIFY_TOKEN.Substring(0, 8)
Write-Host ("Testing token: {0}..." -f $tokenPreview) -ForegroundColor Cyan

Write-Host ""
Write-Host "TEST: list webhooks via GET /api/team-webhooks"

try {
    $r = Invoke-RestMethod -Uri "https://dashboard.alchemy.com/api/team-webhooks" -Headers @{ "X-Alchemy-Token" = $env:ALCHEMY_NOTIFY_TOKEN }
    Write-Host "  SUCCESS" -ForegroundColor Green
    if ($r.data) {
        Write-Host ("  Found {0} webhook(s)" -f $r.data.Count)
        $r.data | Select-Object id, network, webhook_url | Format-Table
    } else {
        $r | ConvertTo-Json -Depth 4 | Write-Host
    }
} catch {
    $msg = $_.Exception.Message
    Write-Host ("  FAILED: {0}" -f $msg) -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host ("  Body: {0}" -f $_.ErrorDetails.Message)
    }
}
