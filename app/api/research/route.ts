import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '195656';

// ---------- types ----------
interface ResearchPost {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  image_url: string | null;
  tags: string[];
  published_at: string;
  created_at: string;
  source?: string;
  url?: string;
}

// ---------- helpers ----------
function mapCategory(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('defi') || r.includes('dex') || r.includes('swap') || r.includes('yield') || r.includes('liquidity')) return 'DeFi';
  if (r.includes('nft') || r.includes('collectible')) return 'NFT';
  if (r.includes('layer2') || r.includes('layer 2') || r.includes('l2') || r.includes('rollup') || r.includes('zk')) return 'Layer2';
  if (r.includes('meme') || r.includes('doge') || r.includes('pepe') || r.includes('shib')) return 'Meme';
  if (r.includes('bitcoin') || r.includes('btc')) return 'BTC';
  if (r.includes('ethereum') || r.includes('eth') || r.includes('erc')) return 'ETH';
  if (r.includes('solana') || r.includes('sol')) return 'SOL';
  if (r.includes('market') || r.includes('price') || r.includes('bullish') || r.includes('bearish')) return 'Market Analysis';
  if (r.includes('security') || r.includes('hack') || r.includes('exploit') || r.includes('audit')) return 'Security';
  if (r.includes('protocol') || r.includes('chain') || r.includes('network') || r.includes('bridge')) return 'Protocols';
  if (r.includes('whale') || r.includes('on-chain') || r.includes('onchain') || r.includes('analytics')) return 'On-Chain';
  return 'General';
}

function slugify(str: string, i: number): string {
  return `${str.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${i}`;
}

// ---------- CryptoPanic ----------
async function fetchCryptoPanic(): Promise<ResearchPost[]> {
  const key = process.env.CRYPTOPANIC_API_KEY;
  if (!key) return [];
  const url = `https://cryptopanic.com/api/v1/posts/?auth_token=${key}&public=true&kind=news&filter=hot`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  const json = await res.json();
  const results = json.results || [];
  return results.slice(0, 20).map((item: Record<string, unknown>, i: number) => {
    const title = String(item.title || '');
    const currencies = (item.currencies as Record<string, string>[] | undefined) || [];
    const currencyNames = currencies.map((c) => c.code || c.slug || '').join(' ');
    const cat = mapCategory(title + ' ' + currencyNames);
    return {
      id: String(item.id || slugify(title, i)),
      title,
      summary: String(item.title || ''),
      content: `${title}\n\nSource: ${(item.source as Record<string, string> | undefined)?.title || 'CryptoPanic'}\n\nPublished: ${String(item.published_at || '')}`,
      category: cat,
      image_url: null,
      tags: currencies.map((c) => c.code || '').filter(Boolean),
      published_at: String(item.published_at || new Date().toISOString()),
      created_at: String(item.published_at || new Date().toISOString()),
      source: (item.source as Record<string, string> | undefined)?.title || 'CryptoPanic',
      url: String(item.url || ''),
    } as ResearchPost;
  });
}

// ---------- DexScreener ----------
async function fetchDexScreener(): Promise<ResearchPost[]> {
  const res = await fetch('https://api.dexscreener.com/token-profiles/latest/v1', {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const json: unknown[] = await res.json();
  const tokens = Array.isArray(json) ? json : [];
  return tokens.slice(0, 20).map((item: unknown, i: number) => {
    const t = item as Record<string, unknown>;
    const symbol = String(t.tokenAddress || t.symbol || '').toUpperCase().slice(0, 8);
    const chainId = String(t.chainId || 'unknown');
    const desc = String(t.description || '');
    const title = `${symbol} — New Token Profile on ${chainId.charAt(0).toUpperCase() + chainId.slice(1)}`;
    const links = (t.links as Record<string, string>[] | undefined) || [];
    const website = links.find((l) => l.type === 'website')?.url || '';
    const iconUrl = String(t.icon || t.header || t.imageUrl || '');
    const cat = mapCategory(desc + ' ' + chainId);
    return {
      id: String(t.tokenAddress || slugify(title, i)),
      title,
      summary: desc || `Recently profiled token on DexScreener — ${chainId} chain.`,
      content: [
        title,
        '',
        desc ? `About: ${desc}` : '',
        `Chain: ${chainId}`,
        `Token Address: ${String(t.tokenAddress || 'N/A')}`,
        website ? `Website: ${website}` : '',
        '',
        'Data source: DexScreener Token Profiles',
      ]
        .filter((l) => l !== undefined)
        .join('\n'),
      category: cat,
      image_url: iconUrl || null,
      tags: [chainId, 'DexScreener', 'New Token'].filter(Boolean),
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      source: 'DexScreener',
      url: `https://dexscreener.com/${chainId}/${String(t.tokenAddress || '')}`,
    } as ResearchPost;
  });
}

// ---------- CoinGecko trending ----------
async function fetchCoinGeckoTrending(): Promise<ResearchPost[]> {
  const res = await fetch('https://api.coingecko.com/api/v3/search/trending', {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const json = await res.json();
  const coins: unknown[] = (json.coins || []).map((c: Record<string, unknown>) => c.item);
  return coins.slice(0, 15).map((item: unknown, i: number) => {
    const c = item as Record<string, unknown>;
    const name = String(c.name || '');
    const symbol = String(c.symbol || '').toUpperCase();
    const score = Number(c.score ?? 0);
    const marketCapRank = Number(c.market_cap_rank || 0);
    const desc = String((c.data as Record<string, string> | undefined)?.content || '');
    const priceChange = Number((c.data as Record<string, unknown> | undefined)?.price_change_percentage_24h?.usd ?? 0);
    const thumb = String(c.large || c.thumb || '');
    const title = `${name} (${symbol}) — Trending #${score + 1} on CoinGecko`;
    const cat = mapCategory(name + ' ' + symbol + ' ' + desc);
    const priceStr = priceChange >= 0 ? `+${priceChange.toFixed(2)}%` : `${priceChange.toFixed(2)}%`;
    return {
      id: String(c.id || slugify(title, i)),
      title,
      summary: desc || `${name} is trending on CoinGecko with a 24h price change of ${priceStr}.`,
      content: [
        title,
        '',
        desc || `${name} (${symbol}) is currently trending on CoinGecko.`,
        '',
        `24h Price Change: ${priceStr}`,
        marketCapRank ? `Market Cap Rank: #${marketCapRank}` : '',
        '',
        'Data source: CoinGecko Trending',
      ]
        .filter((l) => l !== undefined)
        .join('\n'),
      category: cat,
      image_url: thumb || null,
      tags: [symbol, 'Trending', 'CoinGecko'].filter(Boolean),
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      source: 'CoinGecko',
      url: `https://www.coingecko.com/en/coins/${String(c.id || '')}`,
    } as ResearchPost;
  });
}

// ---------- Supabase (manual posts) ----------
async function fetchSupabasePosts(category?: string | null): Promise<ResearchPost[]> {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabaseAdmin');
    const admin = getSupabaseAdmin();
    let query = admin
      .from('research_posts')
      .select('id, title, summary, content, category, image_url, tags, published_at, created_at')
      .eq('published', true)
      .order('published_at', { ascending: false })
      .limit(20);
    if (category) query = query.eq('category', category);
    const { data, error } = await query;
    if (error) return [];
    return (data || []) as ResearchPost[];
  } catch {
    return [];
  }
}

// ---------- GET ----------
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'));
  const category = searchParams.get('category') || null;
  const sort = searchParams.get('sort') || 'latest'; // latest | trending

  try {
    // Fetch from all sources concurrently
    const [supabasePosts, cryptoPanicPosts, dexPosts, cgPosts] = await Promise.allSettled([
      fetchSupabasePosts(category),
      fetchCryptoPanic(),
      fetchDexScreener(),
      fetchCoinGeckoTrending(),
    ]);

    const supabase = supabasePosts.status === 'fulfilled' ? supabasePosts.value : [];
    const cp = cryptoPanicPosts.status === 'fulfilled' ? cryptoPanicPosts.value : [];
    const dex = dexPosts.status === 'fulfilled' ? dexPosts.value : [];
    const cg = cgPosts.status === 'fulfilled' ? cgPosts.value : [];

    // Prioritize: supabase (manual) > cryptopanic > coingecko trending > dexscreener
    let all: ResearchPost[] = [...supabase, ...cp, ...cg, ...dex];

    // Deduplicate by id
    const seen = new Set<string>();
    all = all.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    // Filter by category
    if (category && category !== 'All') {
      all = all.filter((p) => p.category === category);
    }

    // Sort
    if (sort === 'trending') {
      // CoinGecko trending first, then CryptoPanic, then others
      all = all.sort((a, b) => {
        const order = ['CoinGecko', 'CryptoPanic', 'DexScreener'];
        const ai = order.indexOf(a.source || '');
        const bi = order.indexOf(b.source || '');
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
    } else {
      // Latest first
      all = all.sort(
        (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      );
    }

    const total = all.length;
    const start = (page - 1) * limit;
    const posts = all.slice(start, start + limit);

    return NextResponse.json({
      posts,
      total,
      page,
      limit,
      sources: {
        supabase: supabase.length,
        cryptopanic: cp.length,
        coingecko: cg.length,
        dexscreener: dex.length,
      },
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Research fetch error:', err);
    return NextResponse.json({ posts: [], total: 0, page: 1, limit: 10 });
  }
}

// ---------- POST (admin creates manual post) ----------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, title, summary, content, category, image_url, tags, published } = body;

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const { getSupabaseAdmin } = await import('@/lib/supabaseAdmin');
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('research_posts')
      .insert({
        title: title.trim(),
        summary: summary?.trim() || '',
        content: content.trim(),
        category: category?.trim() || 'General',
        image_url: image_url?.trim() || null,
        tags: Array.isArray(tags) ? tags : [],
        published: published !== false,
        published_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to save post: ' + error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, post: data });
  } catch (err) {
    console.error('Research post error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------- DELETE (admin) ----------
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const password = searchParams.get('password');

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!id) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 });
    }

    const { getSupabaseAdmin } = await import('@/lib/supabaseAdmin');
    const admin = getSupabaseAdmin();
    const { error } = await admin.from('research_posts').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Research delete error:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
