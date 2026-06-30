-- #66 OG mode (honest "first seen on Naka"). A true "first token ever for a
-- ticker" needs a global launch index we don't have; instead we surface the
-- earliest token WE'VE ingested per (chain, lower(symbol)). The UI labels it
-- "OG — first seen on Naka" so it's not misrepresented as first-ever.
create or replace view sniper_feed_og as
select distinct on (chain, lower(symbol)) *
from sniper_feed_tokens
where symbol is not null and symbol <> ''
order by chain, lower(symbol), first_seen_at asc;
