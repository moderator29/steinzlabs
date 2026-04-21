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
    Write-Host "  $($addresses.Count) addresses total, chunking into batches of 50..."

    # Alchemy Notify returns 503 when the PATCH body exceeds ~50 addresses
    # (ETH with 199 failed; Base with 5 succeeded). Chunk + retry strategy.
    $chunkSize = 50
    $ok = 0
    $failed = 0

    for ($i = 0; $i -lt $addresses.Count; $i += $chunkSize) {
        $end = [Math]::Min($i + $chunkSize - 1, $addresses.Count - 1)
        $chunk = $addresses[$i..$end]
        $body = @{
            webhook_id          = $w.id
            addresses_to_add    = $chunk
            addresses_to_remove = @()
        } | ConvertTo-Json -Compress

        $attempt = 0
        $success = $false
        while ($attempt -lt 3 -and -not $success) {
            $attempt++
            try {
                Invoke-RestMethod `
                    -Uri "https://dashboard.alchemy.com/api/update-webhook-addresses" `
                    -Method Patch `
                    -Headers @{ "X-Alchemy-Token" = $env:ALCHEMY_NOTIFY_TOKEN; "Content-Type" = "application/json" } `
                    -Body $body | Out-Null
                $success = $true
                $ok += $chunk.Count
                Write-Host "    chunk $($i+1)..$($end+1) OK" -ForegroundColor Green
            } catch {
                if ($attempt -lt 3) {
                    Start-Sleep -Seconds 2
                } else {
                    $failed += $chunk.Count
                    Write-Host "    chunk $($i+1)..$($end+1) FAILED after 3 tries: $($_.Exception.Message)" -ForegroundColor Red
                    if ($_.ErrorDetails) { Write-Host "    $($_.ErrorDetails.Message)" }
                }
            }
        }
        Start-Sleep -Milliseconds 500  # small gap between chunks
    }

    Write-Host "  [$($w.chain)] added=$ok failed=$failed" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Done. Verify each webhook in the Alchemy dashboard." -ForegroundColor Green
