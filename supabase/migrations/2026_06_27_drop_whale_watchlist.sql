-- Consolidate the duplicate watchlist table. lib/services/supabase.ts
-- getWhaleWatchlist was repointed to user_whale_follows (the one canonical
-- follow/watchlist table) and its two unused write helpers removed, so
-- whale_watchlist (0 rows) has no remaining references.
DROP TABLE IF EXISTS public.whale_watchlist RESTRICT;
