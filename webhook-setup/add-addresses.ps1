# Native PowerShell version of add-addresses.sh. Windows default shells
# don't have bash available; this uses Invoke-RestMethod to hit Alchemy's
# Notify API directly.
#
# PREREQ:
#   $env:ALCHEMY_NOTIFY_TOKEN="dQkmP8A9I..."  # your auth token
#
# USAGE (from repo root):
#   .\webhook-setup\add-addresses.ps1

if (-not $env:ALCHEMY_NOTIFY_TOKEN) {
    Write-Host "ERROR: set `$env:ALCHEMY_NOTIFY_TOKEN first." -ForegroundColor Red
    exit 1
}

$webhooks = @(
    @{ chain = "ethereum"; id = "wh_lqusytlrh1bnslp8"; file = "webhook-setup\ethereum.txt" }
    @{ chain = "base";     id = "wh_xy2ur9az80x8xhrx"; file = "webhook-setup\base.txt" }
    @{ chain = "bsc";      id = "wh_oe0k7c1owoyhjjro"; file = "webhook-setup\bsc.txt" }
    @{ chain = "polygon";  id = "wh_wiv4iil3t9q5jvv2"; file = "webhook-setup\polygon.txt" }
    @{ chain = "arbitrum"; id = "wh_bytaoha5wvjmlrwu"; file = "webhook-setup\arbitrum.txt" }
)

foreach ($w in $webhooks) {
    Write-Host ""
    Write-Host "---- $($w.chain) -> $($w.id) ----" -ForegroundColor Cyan

    if (-not (Test-Path $w.file)) {
        Write-Host "  SKIP: $($w.file) not found" -ForegroundColor Yellow
        continue
    }

    $addresses = Get-Content $w.file | Where-Object { $_ -match '^0x[0-9a-fA-F]{40}$' }
    Write-Host "  Adding $($addresses.Count) addresses..."

    $body = @{
        webhook_id          = $w.id
        addresses_to_add    = $addresses
        addresses_to_remove = @()
    } | ConvertTo-Json -Compress

    try {
        $response = Invoke-RestMethod `
            -Uri "https://dashboard.alchemy.com/api/update-webhook-addresses" `
            -Method Patch `
            -Headers @{ "X-Alchemy-Token" = $env:ALCHEMY_NOTIFY_TOKEN; "Content-Type" = "application/json" } `
            -Body $body
        Write-Host "  SUCCESS" -ForegroundColor Green
        $response | ConvertTo-Json -Depth 4 | Out-String | Write-Host
    } catch {
        Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
    }
}

Write-Host ""
Write-Host "Done. Verify each webhook in the Alchemy dashboard." -ForegroundColor Green
