-- Add 'naka_cult' to the profiles.tier CHECK constraint.
-- The Naka Cult tier is gated by holding ≥600,000 $NAKA OR a NakaLabs NFT
-- and is set/cleared by lib/cult/access.ts (Phase 4) — not by Stripe.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_tier_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_tier_check
  CHECK (tier IN ('free', 'mini', 'pro', 'max', 'naka_cult'));
