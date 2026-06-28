-- Retire the dead moneyRadar follow store. followed_entities (0 rows) was
-- written only by the Arkham-backed /api/moneyRadar/follow route (Arkham is
-- gone; the route also wrote non-existent columns). Smart-money follows are now
-- persisted to the canonical user_whale_follows, and the dead lib/moneyRadar/*
-- (monitor, copyTrade, types) + /api/moneyRadar/copy are removed in the same
-- change.
DROP TABLE IF EXISTS public.followed_entities;
