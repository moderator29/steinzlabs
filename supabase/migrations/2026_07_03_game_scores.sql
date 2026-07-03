CREATE TABLE IF NOT EXISTS public.game_scores (
  id text PRIMARY KEY, username text NOT NULL, score integer NOT NULL DEFAULT 0,
  coins integer NOT NULL DEFAULT 0, distance integer NOT NULL DEFAULT 0,
  games_played integer NOT NULL DEFAULT 1, best_streak integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS game_scores_public_read ON public.game_scores;
CREATE POLICY game_scores_public_read ON public.game_scores FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS game_scores_score_idx ON public.game_scores (score DESC);
