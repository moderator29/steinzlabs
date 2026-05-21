-- §3 P1-D.5: rug_contract_signatures — curated bytecode-hash registry of
-- known rug / honeypot / scam contracts. The bytecode similarity scanner
-- hashes a target contract's runtime bytecode against this set and flags
-- exact matches (and, in a follow-up, k-shingle Jaccard similarity for
-- near-matches that share opcode structure with known rugs).
--
-- Seed data is curated manually and grows over time from on-chain
-- post-mortems + the reputation feedback loop (P2-E).

CREATE TABLE IF NOT EXISTS public.rug_contract_signatures (
  id              bigserial PRIMARY KEY,
  chain           text NOT NULL,
  address         text NOT NULL,
  bytecode_hash   text NOT NULL,            -- sha256 of the runtime bytecode
  bytecode_length int  NOT NULL,
  category        text NOT NULL CHECK (category IN ('rug', 'honeypot', 'scam', 'phishing', 'mev_bot')),
  source          text,                     -- 'manual', 'reputation_loop', 'community_report'
  notes           text,
  added_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rug_contract_signatures_chain_addr_uniq
  ON public.rug_contract_signatures (chain, address);

CREATE INDEX IF NOT EXISTS rug_contract_signatures_hash_idx
  ON public.rug_contract_signatures (bytecode_hash);

ALTER TABLE public.rug_contract_signatures ENABLE ROW LEVEL SECURITY;

-- Service-role only; the scanner endpoint reads it server-side.
