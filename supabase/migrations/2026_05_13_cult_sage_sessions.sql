-- Phase F: Oracle / VTX Sage.
--
-- A cult-only chat persona separate from the general /dashboard/vtx-ai
-- surface. The Sage is voice-first (ink-writing tone, sigil avatar) and
-- intentionally not tool-augmented — it's a conversation, not an agent.
-- One rolling message log per user keeps the schema flat; the route
-- trims context to the last N turns when calling Anthropic so the prompt
-- stays bounded.

CREATE TABLE IF NOT EXISTS cult_sage_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text NOT NULL CHECK (length(content) BETWEEN 1 AND 16000),
  model       text,
  input_tokens  integer,
  output_tokens integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cult_sage_messages_user_idx
  ON cult_sage_messages (user_id, created_at DESC);

ALTER TABLE cult_sage_messages ENABLE ROW LEVEL SECURITY;

-- Read/write: only the message owner. The Sage is private to each cult
-- member; nobody else sees their conversation.
DROP POLICY IF EXISTS cult_sage_messages_own ON cult_sage_messages;
CREATE POLICY cult_sage_messages_own ON cult_sage_messages
  FOR ALL USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tier = 'naka_cult'
    )
  ) WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.tier = 'naka_cult'
    )
  );
