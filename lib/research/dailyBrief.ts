import 'server-only';
import {
  getTopTokens,
  getGlobalMarketData,
  getTrendingTokens,
  type GlobalMarketData,
} from '@/lib/services/coingecko';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Daily Market Brief engine. Assembles the Research Labs daily post entirely
 * from REAL data — CoinGecko market data (top movers, market vibe, trending)
 * and the platform's own whale_activity feed (biggest on-chain moves). No
 * fabricated numbers: if a source is unavailable its section is simply omitted.
 *
 * Strict formatting rule for this product: NO hyphen-minus or em/en dashes in
 * any user-visible string. Negative changes are shown with a ▼ arrow and a
 * positive magnitude, never a leading "-".
 */

export interface BriefToken {
  symbol: string;
  name: string;
  image: string;
  price: number;
  changePct: number;
}

export interface BriefWhaleMove {
  label: string;
  action: 'buy' | 'sell' | 'transfer';
  tokenSymbol: string;
  valueUsd: number;
  chain: string;
  address: string;
}

export interface MarketVibe {
  label: string;
  emoji: string;
  color: string;
  blurb: string;
}

export interface DailyBrief {
  slug: string;
  title: string;
  summary: string;
  contentHtml: string;
  tags: string[];
  coverImage: string;
  readTime: number;
  dateLabel: string;
  global: GlobalMarketData | null;
  gainers: BriefToken[];
  losers: BriefToken[];
  trending: BriefToken[];
  whaleMoves: BriefWhaleMove[];
  vibe: MarketVibe;
}

// ─── Formatting (dash-free) ─────────────────────────────────────────────────

export function fmtUsdCompact(n: number): string {
  const v = Math.abs(n);
  if (v >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (v >= 1) return `$${n.toFixed(2)}`;
  if (v > 0) return `$${n.toPrecision(2)}`;
  return '$0';
}

/** A percentage with an up/down arrow instead of a sign, so no "-" ever shows. */
export function fmtPctArrow(n: number): { text: string; arrow: string; color: string } {
  const mag = Math.abs(n).toFixed(2);
  if (n > 0.0001) return { text: `${mag}%`, arrow: '▲', color: '#10B981' };
  if (n < -0.0001) return { text: `${mag}%`, arrow: '▼', color: '#EF4444' };
  return { text: `${mag}%`, arrow: '▬', color: '#94A3B8' };
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── Edition (12h cadence) ──────────────────────────────────────────────────
// Two editions per UTC day: Morning (published 00:00 UTC) and Evening (12:00
// UTC). The slug encodes the edition so both can coexist, and the same-edition
// idempotency guard still blocks a duplicate dispatch tick.

export interface BriefEdition { period: 'am' | 'pm'; label: string; slug: string; }

export function briefEdition(now: Date): BriefEdition {
  const period: 'am' | 'pm' = now.getUTCHours() < 12 ? 'am' : 'pm';
  const date = now.toISOString().slice(0, 10);
  return {
    period,
    label: period === 'am' ? 'Morning' : 'Evening',
    slug: `market-brief-${date}-${period}`,
  };
}

// ─── Market vibe from real global data ──────────────────────────────────────

function deriveVibe(global: GlobalMarketData | null): MarketVibe {
  const ch = global?.marketCapChange24hPercent ?? 0;
  if (ch >= 3) return { label: 'Risk On', emoji: '🟢', color: '#10B981', blurb: 'Broad strength across the market.' };
  if (ch >= 0.5) return { label: 'Leaning Green', emoji: '🟢', color: '#34D399', blurb: 'Buyers in control, momentum building.' };
  if (ch > -0.5) return { label: 'Choppy', emoji: '🟡', color: '#F59E0B', blurb: 'Range bound, no clear winner yet.' };
  if (ch > -3) return { label: 'Leaning Red', emoji: '🔴', color: '#F87171', blurb: 'Sellers pressing, stay selective.' };
  return { label: 'Risk Off', emoji: '🔴', color: '#EF4444', blurb: 'Broad weakness, capital rotating out.' };
}

// ─── Whale moves from the platform's own feed ───────────────────────────────

async function fetchWhaleMoves(): Promise<BriefWhaleMove[]> {
  try {
    const sb = getSupabaseAdmin();
    const sinceIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data } = await sb
      .from('whale_activity')
      .select('whale_address, chain, action, token_symbol, value_usd')
      .gt('timestamp', sinceIso)
      .not('value_usd', 'is', null)
      .order('value_usd', { ascending: false })
      .limit(6);
    const rows = (data ?? []) as Array<{ whale_address: string; chain: string; action: string; token_symbol: string | null; value_usd: number | null }>;
    if (rows.length === 0) return [];

    // Enrich with whale labels where we have them.
    const addrs = Array.from(new Set(rows.map(r => r.whale_address)));
    const labelByAddr = new Map<string, string>();
    const { data: whales } = await sb.from('whales').select('address, label').in('address', addrs);
    (whales ?? []).forEach((w: { address: string; label: string | null }) => {
      if (w.label) labelByAddr.set(w.address, w.label);
    });

    return rows.map(r => {
      const a = (r.action || '').toLowerCase();
      const action: BriefWhaleMove['action'] = a.includes('buy') ? 'buy' : a.includes('sell') ? 'sell' : 'transfer';
      return {
        label: labelByAddr.get(r.whale_address) || `${r.whale_address.slice(0, 6)}…${r.whale_address.slice(-4)}`,
        action,
        tokenSymbol: r.token_symbol || 'tokens',
        valueUsd: Number(r.value_usd ?? 0),
        chain: r.chain,
        address: r.whale_address,
      };
    });
  } catch {
    return [];
  }
}

// ─── HTML section builders (self-contained inline styles) ───────────────────

function moverRow(t: BriefToken): string {
  const p = fmtPctArrow(t.changePct);
  return `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,0.06)">
        <div style="display:flex;align-items:center;gap:10px">
          <img src="${esc(t.image)}" alt="" width="24" height="24" style="border-radius:50%;background:#0b0f1e"/>
          <div>
            <div style="color:#f1f5f9;font-weight:700;font-size:13px">${esc(t.symbol.toUpperCase())}</div>
            <div style="color:#64748b;font-size:11px">${esc(t.name)}</div>
          </div>
        </div>
      </td>
      <td style="padding:10px 8px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);color:#cbd5e1;font-size:13px;font-family:monospace">${fmtUsdCompact(t.price)}</td>
      <td style="padding:10px 8px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);font-weight:700;font-size:13px;color:${p.color};font-family:monospace">${p.arrow} ${p.text}</td>
    </tr>`;
}

function moversTable(title: string, accent: string, tokens: BriefToken[]): string {
  if (tokens.length === 0) return '';
  return `
    <h3 style="color:#f1f5f9;font-size:16px;margin:28px 0 8px;display:flex;align-items:center;gap:8px">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${accent}"></span>${esc(title)}
    </h3>
    <table style="width:100%;border-collapse:collapse;background:rgba(255,255,255,0.02);border-radius:12px;overflow:hidden">
      ${tokens.map(moverRow).join('')}
    </table>`;
}

function whaleSection(moves: BriefWhaleMove[]): string {
  if (moves.length === 0) return '';
  const verb = (a: BriefWhaleMove['action']) => a === 'buy' ? 'bought' : a === 'sell' ? 'sold' : 'moved';
  const color = (a: BriefWhaleMove['action']) => a === 'buy' ? '#10B981' : a === 'sell' ? '#EF4444' : '#6F7EFF';
  const rows = moves.map(m => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;margin-bottom:8px">
      <div style="min-width:0">
        <span style="color:#f1f5f9;font-weight:700;font-size:13px">${esc(m.label)}</span>
        <span style="color:#94a3b8;font-size:13px"> ${verb(m.action)} </span>
        <span style="color:${color(m.action)};font-weight:700;font-size:13px">$${esc(m.tokenSymbol.toUpperCase())}</span>
        <span style="color:#64748b;font-size:11px"> on ${esc(m.chain)}</span>
      </div>
      <div style="color:#cbd5e1;font-weight:800;font-size:14px;font-family:monospace;white-space:nowrap">${fmtUsdCompact(m.valueUsd)}</div>
    </div>`).join('');
  return `
    <h3 style="color:#f1f5f9;font-size:16px;margin:28px 0 8px;display:flex;align-items:center;gap:8px">
      <span>🐋</span> Biggest Whale Moves <span style="color:#64748b;font-size:12px;font-weight:400">last 24h</span>
    </h3>
    ${rows}`;
}

/** Decorative on-brand SVG cover (data URI) stamped with the date + vibe. */
function buildCover(dateLabel: string, vibe: MarketVibe, marketCap: number): string {
  const cap = marketCap > 0 ? fmtUsdCompact(marketCap) : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#05081E"/><stop offset="0.55" stop-color="#0A1238"/><stop offset="1" stop-color="#0066FF"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.8" cy="0.2" r="0.6">
        <stop offset="0" stop-color="${vibe.color}" stop-opacity="0.45"/><stop offset="1" stop-color="${vibe.color}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#g)"/>
    <rect width="1200" height="630" fill="url(#glow)"/>
    <text x="64" y="150" fill="#8FA3FF" font-family="Arial,sans-serif" font-size="26" font-weight="700" letter-spacing="3">NAKA LABS RESEARCH</text>
    <text x="64" y="300" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="92" font-weight="900">Daily Market Brief</text>
    <text x="64" y="380" fill="#C7D2FE" font-family="Arial,sans-serif" font-size="38" font-weight="600">${esc(dateLabel)}</text>
    <text x="64" y="560" fill="${vibe.color}" font-family="Arial,sans-serif" font-size="34" font-weight="800">${vibe.emoji} ${esc(vibe.label)}</text>
    ${cap ? `<text x="1136" y="560" text-anchor="end" fill="#94A3B8" font-family="monospace" font-size="30" font-weight="700">Mkt Cap ${esc(cap)}</text>` : ''}
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ─── Public builder ─────────────────────────────────────────────────────────

/** Build today's brief from live data. Returns null only if every data source
 *  failed (so we never publish an empty shell). */
export async function buildDailyBrief(now: Date): Promise<DailyBrief | null> {
  const [topRes, globalRes, trendingRes, whaleMoves] = await Promise.allSettled([
    getTopTokens(1, 100, false),
    getGlobalMarketData(),
    getTrendingTokens(),
    fetchWhaleMoves(),
  ]);

  const top = topRes.status === 'fulfilled' ? topRes.value : [];
  const global = globalRes.status === 'fulfilled' ? globalRes.value : null;
  const trendingRaw = trendingRes.status === 'fulfilled' ? trendingRes.value : [];
  const moves = whaleMoves.status === 'fulfilled' ? whaleMoves.value : [];

  // Need at least the market movers OR whale moves to have a real story.
  if (top.length === 0 && moves.length === 0) return null;

  const toBrief = (t: { symbol: string; name: string; image: string; current_price: number; price_change_percentage_24h: number }): BriefToken => ({
    symbol: t.symbol, name: t.name, image: t.image,
    price: t.current_price ?? 0, changePct: t.price_change_percentage_24h ?? 0,
  });

  const withChange = top.filter(t => typeof t.price_change_percentage_24h === 'number');
  const gainers = [...withChange].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
    .filter(t => t.price_change_percentage_24h > 0).slice(0, 5).map(toBrief);
  const losers = [...withChange].sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h)
    .filter(t => t.price_change_percentage_24h < 0).slice(0, 5).map(toBrief);

  const trending: BriefToken[] = trendingRaw.slice(0, 5).map(c => ({
    symbol: c.symbol, name: c.name, image: c.thumb,
    price: 0, changePct: c.data?.price_change_percentage_24h?.usd ?? 0,
  }));

  const vibe = deriveVibe(global);
  const edition = briefEdition(now);
  const dateLabel = `${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })} · ${edition.label} Edition`;
  const slug = edition.slug;

  // ── Summary (preview, dash-free) ──
  const topGain = gainers[0];
  const summaryBits: string[] = [`Market vibe is ${vibe.label.toLowerCase()} this ${edition.label.toLowerCase()}.`];
  if (global) summaryBits.push(`Total cap ${fmtUsdCompact(global.totalMarketCapUSD)} with BTC dominance ${global.btcDominancePercent.toFixed(1)}%.`);
  if (topGain) summaryBits.push(`${topGain.symbol.toUpperCase()} leads the gainers at ${fmtPctArrow(topGain.changePct).text} up.`);
  if (moves.length) summaryBits.push(`${moves.length} major whale moves tracked on chain.`);
  const summary = summaryBits.join(' ');

  // ── Full web story HTML ──
  const vibeBlock = `
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin:8px 0 4px">
      <div style="flex:1;min-width:140px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:16px">
        <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px">Market Vibe</div>
        <div style="color:${vibe.color};font-size:20px;font-weight:800;margin-top:4px">${vibe.emoji} ${esc(vibe.label)}</div>
        <div style="color:#94a3b8;font-size:12px;margin-top:4px">${esc(vibe.blurb)}</div>
      </div>
      ${global ? `
      <div style="flex:1;min-width:140px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:16px">
        <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px">Total Market Cap</div>
        <div style="color:#f1f5f9;font-size:20px;font-weight:800;margin-top:4px;font-family:monospace">${fmtUsdCompact(global.totalMarketCapUSD)}</div>
        <div style="color:${fmtPctArrow(global.marketCapChange24hPercent).color};font-size:12px;margin-top:4px;font-family:monospace">${fmtPctArrow(global.marketCapChange24hPercent).arrow} ${fmtPctArrow(global.marketCapChange24hPercent).text} 24h</div>
      </div>
      <div style="flex:1;min-width:140px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:16px">
        <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px">BTC Dominance</div>
        <div style="color:#f1f5f9;font-size:20px;font-weight:800;margin-top:4px;font-family:monospace">${global.btcDominancePercent.toFixed(1)}%</div>
        <div style="color:#94a3b8;font-size:12px;margin-top:4px">24h volume ${fmtUsdCompact(global.totalVolumeUSD)}</div>
      </div>` : ''}
    </div>`;

  const trendingBlock = trending.length ? `
    <h3 style="color:#f1f5f9;font-size:16px;margin:28px 0 8px">🔥 Trending Searches</h3>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${trending.map(t => `<span style="display:inline-flex;align-items:center;gap:6px;background:rgba(111,126,255,0.12);border:1px solid rgba(111,126,255,0.25);border-radius:999px;padding:6px 12px;color:#c7d2fe;font-size:13px;font-weight:600"><img src="${esc(t.image)}" width="16" height="16" style="border-radius:50%"/> ${esc(t.symbol.toUpperCase())}</span>`).join('')}
    </div>` : '';

  const contentHtml = `
    <p style="color:#cbd5e1;font-size:15px;line-height:1.8;margin:0 0 20px">
      Here is your on-chain and market read for <strong style="color:#f1f5f9">${esc(dateLabel)}</strong>, straight from the Naka Labs desk. Everything below is pulled live from market data and our own whale feed.
    </p>
    ${vibeBlock}
    ${moversTable('Top Gainers', '#10B981', gainers)}
    ${moversTable('Top Losers', '#EF4444', losers)}
    ${whaleSection(moves)}
    ${trendingBlock}
    <p style="color:#64748b;font-size:12px;line-height:1.7;margin:28px 0 0;border-top:1px solid rgba(255,255,255,0.07);padding-top:16px">
      Data sourced from CoinGecko and the Naka Labs whale tracker at publish time. Markets move fast; treat this as a starting point, not financial advice.
    </p>`;

  const readTime = Math.max(2, Math.round((gainers.length + losers.length + moves.length + trending.length) / 4) + 1);
  const coverImage = buildCover(dateLabel, vibe, global?.totalMarketCapUSD ?? 0);

  const title = `Market Brief · ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} ${edition.label}`;

  return {
    slug, title, summary, contentHtml,
    tags: ['Daily Brief', 'Market', vibe.label],
    coverImage, readTime, dateLabel,
    global, gainers, losers, trending, whaleMoves: moves, vibe,
  };
}

// ─── Email digest (preview + Read more) ─────────────────────────────────────

function emailMoverRow(t: BriefToken): string {
  const p = fmtPctArrow(t.changePct);
  return `<tr>
    <td style="padding:7px 6px;font-size:13px;color:#f1f5f9;font-weight:700">${esc(t.symbol.toUpperCase())}</td>
    <td style="padding:7px 6px;font-size:12px;color:#94a3b8;font-family:monospace;text-align:right">${fmtUsdCompact(t.price)}</td>
    <td style="padding:7px 6px;font-size:13px;font-weight:700;color:${p.color};font-family:monospace;text-align:right">${p.arrow} ${p.text}</td>
  </tr>`;
}

/**
 * Compact rich email digest: market vibe + a few real movers and whale moves as
 * a teaser, then a prominent button into the full web story. Dash-free.
 */
export function buildDigestEmailHtml(brief: DailyBrief, postUrl: string, firstName?: string | null): string {
  const hello = firstName ? `${esc(firstName)}, here` : 'Here';
  const gain = brief.gainers.slice(0, 3);
  const lose = brief.losers.slice(0, 3);
  const moves = brief.whaleMoves.slice(0, 3);
  const g = brief.global;

  const moversBlock = (label: string, accent: string, rows: BriefToken[]) => rows.length ? `
    <div style="flex:1;min-width:160px">
      <div style="color:${accent};font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${label}</div>
      <table style="width:100%;border-collapse:collapse">${rows.map(emailMoverRow).join('')}</table>
    </div>` : '';

  const whaleBlock = moves.length ? `
    <div style="margin-top:20px">
      <div style="color:#cbd5e1;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">🐋 Biggest whale moves</div>
      ${moves.map(m => {
        const verb = m.action === 'buy' ? 'bought' : m.action === 'sell' ? 'sold' : 'moved';
        const c = m.action === 'buy' ? '#10B981' : m.action === 'sell' ? '#EF4444' : '#6F7EFF';
        return `<div style="font-size:13px;color:#94a3b8;padding:5px 0">
          <span style="color:#f1f5f9;font-weight:700">${esc(m.label)}</span> ${verb}
          <span style="color:${c};font-weight:700">$${esc(m.tokenSymbol.toUpperCase())}</span>
          <span style="color:#cbd5e1;font-weight:700;font-family:monospace"> ${fmtUsdCompact(m.valueUsd)}</span></div>`;
      }).join('')}
    </div>` : '';

  return `
  <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;background:#0b0f1e;color:#f1f5f9;padding:0;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)">
    <div style="background:linear-gradient(135deg,#05081E,#0A1238 55%,#0066FF);padding:28px 28px 22px">
      <div style="color:#8FA3FF;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase">Naka Labs Research</div>
      <div style="color:#ffffff;font-size:24px;font-weight:900;margin-top:6px">Daily Market Brief</div>
      <div style="color:#C7D2FE;font-size:13px;margin-top:4px">${esc(brief.dateLabel)}</div>
      <div style="display:inline-block;margin-top:12px;background:rgba(0,0,0,0.25);border:1px solid ${brief.vibe.color}55;border-radius:999px;padding:5px 12px;color:${brief.vibe.color};font-size:13px;font-weight:800">${brief.vibe.emoji} ${esc(brief.vibe.label)}</div>
    </div>
    <div style="padding:24px 28px">
      <p style="color:#cbd5e1;font-size:14px;line-height:1.7;margin:0 0 18px">${hello} is your 60 second market read.${g ? ` Total cap sits at <strong style="color:#f1f5f9">${fmtUsdCompact(g.totalMarketCapUSD)}</strong> with BTC dominance ${g.btcDominancePercent.toFixed(1)}%.` : ''}</p>
      <div style="display:flex;flex-wrap:wrap;gap:20px">
        ${moversBlock('Top Gainers', '#10B981', gain)}
        ${moversBlock('Top Losers', '#EF4444', lose)}
      </div>
      ${whaleBlock}
      <div style="text-align:center;margin:26px 0 8px">
        <a href="${esc(postUrl)}" style="display:inline-block;background:#0066FF;color:#fff;padding:14px 30px;border-radius:12px;text-decoration:none;font-size:15px;font-weight:800">Read the full brief →</a>
      </div>
    </div>
    <div style="padding:16px 28px;border-top:1px solid rgba(255,255,255,0.07);text-align:center">
      <p style="font-size:11px;color:#475569;margin:0">Naka Labs Research · grounded in live on-chain data · <a href="${esc(postUrl.split('/research')[0])}/dashboard/settings" style="color:#6F7EFF">manage emails</a></p>
    </div>
  </div>`;
}
