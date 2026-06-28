-- Canonicalize EVM whale addresses to lowercase so exact-match lookups
-- (.in/.eq on whales.address) line up with the codebase's normalizeAddress
-- convention. 252/329 EVM whales were stored checksummed, so the Alchemy
-- ADDRESS_ACTIVITY webhook (.in('address', [normalized])) and the feed /
-- top-today label+PnL enrichment silently missed ~77% of EVM whales.
--
-- The unique key whales_address_chain_key(address, chain) means a blanket
-- lower() would collide on 7 address pairs that were seeded TWICE with
-- different checksum casings (same on-chain wallet, conflicting CEX labels,
-- zero user follows). Merge each pair first — keep the highest-scored row —
-- then lowercase the survivors. whale_activity rows attribute by string and
-- re-associate to the survivor through the read-path's normalizeAddress map,
-- so no activity is orphaned.

-- 1) Delete duplicate rows that only differ by checksum casing, keeping the
--    strongest (highest whale_score, then most-recently updated).
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY chain, lower(address)
           ORDER BY whale_score DESC NULLS LAST, updated_at DESC NULLS LAST, id
         ) AS rn
  FROM whales
  WHERE chain <> 'solana'
)
DELETE FROM whales w
USING ranked r
WHERE w.id = r.id
  AND r.rn > 1;

-- 2) Lowercase every remaining EVM address. No collisions remain after step 1.
UPDATE whales
SET address = lower(address)
WHERE chain <> 'solana'
  AND address <> lower(address);
