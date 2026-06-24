-- §3.4 Appearance settings — applied to prod via MCP on 2026-06-23.
-- Reuses the existing user_display_preferences table (already holds
-- `language` for i18n and `compact_mode` for density). Adds the remaining
-- appearance controls. Idempotent so it is safe to re-run.
ALTER TABLE public.user_display_preferences
  ADD COLUMN IF NOT EXISTS theme           text    NOT NULL DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS accent          text    NOT NULL DEFAULT 'blue',
  ADD COLUMN IF NOT EXISTS glass_intensity text    NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS text_size       text    NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS reduced_motion  boolean NOT NULL DEFAULT false;
