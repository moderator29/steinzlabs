# Native PowerShell bulk-create.
# Creates 5 webhooks with ALL addresses in one POST per chain.
#
# PREREQUISITE:
#   1. Delete the existing 5 naka-whale-* webhooks in Alchemy dashboard
#      (trash icon on each).
#   2. export $env:ALCHEMY_NOTIFY_TOKEN="..."
#   3. Run this script from repo root.
#
# Output captures new signing keys → comma-joined block printed at end
# for easy paste into Vercel env ALCHEMY_WEBHOOK_SIGNING_KEYS.

if (-not $env:ALCHEMY_NOTIFY_TOKEN) {
    Write-Host "ERROR: set env:ALCHEMY_NOTIFY_TOKEN first" -ForegroundColor Red
    exit 1
}

$webhookUrl = "https://nakalabs.xyz/api/webhooks/alchemy-whale"

$chains = @(
    @{ name = "ethereum"; network = "ETH_MAINNET";   file = "webhook-setup\ethereum.txt" }
    @{ name = "base";     network = "BASE_MAINNET";  file = "webhook-setup\base.txt" }
    @{ name = "bsc";      network = "BNB_MAINNET";   file = "webhook-setup\bsc.txt" }
    @{ name = "polygon";  network = "MATIC_MAINNET"; file = "webhook-setup\polygon.txt" }
    @{ name = "arbitrum"; network = "ARB_MAINNET";   file = "webhook-setup\arbitrum.txt" }
)

$signingKeys = @()

foreach ($c in $chains) {
    Write-Host ""
    Write-Host ("---- creating naka-whale-{0} ({1}) ----" -f $c.name, $c.network) -ForegroundColor Cyan

    if (-not (Test-Path $c.file)) {
        Write-Host ("  SKIP: {0} not found" -f $c.file) -ForegroundColor Yellow
        continue
    }

    $addresses = Get-Content $c.file | Where-Object { $_ -match '^0x[0-9a-fA-F]{40}$' }
    Write-Host ("  addresses: {0}" -f $addresses.Count)

    $body = @{
        network      = $c.network
        webhook_type = "ADDRESS_ACTIVITY"
        webhook_url  = $webhookUrl
        addresses    = $addresses
    } | ConvertTo-Json -Compress

    try {
        $response = Invoke-RestMethod `
            -Uri "https://dashboard.alchemy.com/api/create-webhook" `
            -Method Post `
            -Headers @{ "X-Alchemy-Token" = $env:ALCHEMY_NOTIFY_TOKEN; "Content-Type" = "application/json" } `
            -Body $body
        $id = $response.data.id
        $key = $response.data.signing_key
        Write-Host ("  SUCCESS id={0} signing_key={1}..." -f $id, $key.Substring(0, 8)) -ForegroundColor Green
        $signingKeys += $key
    } catch {
        $msg = $_.Exception.Message
        Write-Host ("  FAILED: {0}" -f $msg) -ForegroundColor Red
        if ($_.ErrorDetails) { Write-Host ("  Body: {0}" -f $_.ErrorDetails.Message) }
    }
}

Write-Host ""
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "Paste this ENTIRE line into Vercel env ALCHEMY_WEBHOOK_SIGNING_KEYS:" -ForegroundColor Cyan
Write-Host ""
Write-Host ($signingKeys -join ",")
Write-Host ""
Write-Host "Then redeploy Vercel and you are done." -ForegroundColor Green
