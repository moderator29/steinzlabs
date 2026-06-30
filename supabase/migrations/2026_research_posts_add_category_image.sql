-- Research subsystem code (admin + public routes, daily brief engine) reads and
-- writes research_posts.category and research_posts.image_url, but the live table
-- never had these columns, so every insert/select against them errored and the
-- table stayed empty. Add them additively so the whole subsystem works.
alter table public.research_posts
  add column if not exists category text not null default 'General',
  add column if not exists image_url text;

-- Index the category for the public list page's category filter.
create index if not exists research_posts_category_idx on public.research_posts (category);
create index if not exists research_posts_published_at_idx on public.research_posts (published_at desc);
