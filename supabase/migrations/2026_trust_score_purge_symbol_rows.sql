-- Purge the fabricated symbol-keyed naka_trust_scores rows.
--
-- These rows ("USDC"/solana, "usdc"/bsc, "usdc"/avalanche, "pepe"/ethereum)
-- were created when the trust-score route accepted free-text symbols instead
-- of on-chain token addresses. A symbol never resolves on GoPlus/DexScreener,
-- so every scoring layer degraded to neutral and the route persisted an
-- identical constant ~41 "Caution" score with null security/liquidity sources
-- against a ticker — a fabricated number on a trading surface.
--
-- The route now validates address format and returns 400 on non-address input
-- (app/api/trust-score/[chain]/[address]/route.ts), so these cannot reappear.
-- Keep only rows whose token_address is a well-formed EVM (0x + 40 hex) or
-- Solana base58 (32-44 chars) address.
DELETE FROM naka_trust_scores
WHERE token_address !~ '^0x[0-9a-fA-F]{40}$'
  AND token_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$';
