-- Feed post topic tags + 1MB image media bucket (applied live via MCP, mirrored
-- here). tags text[] powers the catalogue filters; the wire-media bucket is
-- public-read via CDN, images only, 1MB cap, owner-scoped writes (uid/ folder),
-- no broad SELECT policy so it does not trip the object-listing advisory.
alter table public.wire_posts add column if not exists tags text[] not null default '{}';
create index if not exists wire_posts_tags_gin on public.wire_posts using gin (tags);
-- bucket + owner-scoped storage policies: see migration feed_post_tags_and_media_bucket
