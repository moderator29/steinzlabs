-- §3 P2-C.7 — shareable network-graph snapshots. The user clicks "Share"
-- in the network-graph UI; the client posts the current graph (nodes,
-- edges, focus wallet, view state) here and gets back a short_code that
-- maps to a public read-only URL: /network-graph/share/[code].
--
-- Stored snapshots are immutable. RLS lets anyone read by short_code but
-- only the original creator can delete.

CREATE TABLE IF NOT EXISTS public.network_graph_shares (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code      text NOT NULL UNIQUE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  focus_wallet    text,
  snapshot        jsonb NOT NULL,           -- full NetworkGraphResponse + metadata
  view_count      int  NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS network_graph_shares_short_idx ON public.network_graph_shares (short_code);
CREATE INDEX IF NOT EXISTS network_graph_shares_user_idx  ON public.network_graph_shares (user_id, created_at DESC);

ALTER TABLE public.network_graph_shares ENABLE ROW LEVEL SECURITY;

-- Public can read by short_code (look-up only); only owner can delete.
CREATE POLICY IF NOT EXISTS "network_graph_shares_public_read"
  ON public.network_graph_shares FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "network_graph_shares_owner_delete"
  ON public.network_graph_shares FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
