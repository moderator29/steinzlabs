-- Telegram Generate-Code bug: user_telegram_links.telegram_chat_id was
-- NOT NULL UNIQUE, and the /api/telegram/link-code POST inserted a
-- placeholder value of 0 for users who hadn't yet linked. The first user
-- to click "Generate Code" populated chat_id=0. Every subsequent user
-- then collided on the UNIQUE constraint and got silent 500s — the
-- button looked broken because the client only checked res.ok.
--
-- Fix: chat_id is the *outcome* of linking, not a precondition. It should
-- be NULL until the bot confirms via /link. Postgres UNIQUE already allows
-- multiple NULLs (treats them as distinct), so the constraint stays.

ALTER TABLE user_telegram_links
  ALTER COLUMN telegram_chat_id DROP NOT NULL;

-- Clean up any stale placeholder rows left over from the bug so new users
-- can start clean. Only touches rows that never successfully linked
-- (chat_id=0 is never a real Telegram chat id).
UPDATE user_telegram_links
SET telegram_chat_id = NULL
WHERE telegram_chat_id = 0;
