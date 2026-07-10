import 'server-only';
import {
  getTopTokens,
  getGlobalMarketData,
  getTrendingTokens,
  type GlobalMarketData,
  type CoinGeckoMarketToken,
} from '@/lib/services/coingecko';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { vtxAnalyze } from '@/lib/services/anthropic';

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
  // Extra REAL fields carried from CoinGecko /coins/markets. Optional because
  // trending coins (a lighter payload) do not include them; consumers render
  // them only when present.
  change1hPct?: number;
  change7dPct?: number;
  volume?: number;
  marketCap?: number;
  rank?: number;
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
  // Extra REAL aggregates computed from the same top-100 snapshot.
  majors: BriefToken[];
  volumeLeaders: BriefToken[];
  advancers: number;
  decliners: number;
  breadthUniverse: number;
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

function tokenCell(t: BriefToken): string {
  const rank = typeof t.rank === 'number' ? `<span style="color:#475569;font-size:10px;font-weight:600">#${t.rank}</span> ` : '';
  return `
    <td style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,0.06)">
      <div style="display:flex;align-items:center;gap:10px">
        <img src="${esc(t.image)}" alt="" width="24" height="24" style="border-radius:50%;background:#0b0f1e"/>
        <div>
          <div style="color:#f1f5f9;font-weight:700;font-size:13px">${esc(t.symbol.toUpperCase())}</div>
          <div style="color:#64748b;font-size:11px">${rank}${esc(t.name)}</div>
        </div>
      </div>
    </td>`;
}

function moverRow(t: BriefToken): string {
  const p = fmtPctArrow(t.changePct);
  // 1h and 7d changes are REAL (price_change_percentage_1h/7d_in_currency, both
  // requested from CoinGecko). Surfaced as a small secondary line for momentum
  // context, only when present: 1h reads near-term momentum, 7d the weekly trend.
  const p1 = typeof t.change1hPct === 'number' ? fmtPctArrow(t.change1hPct) : null;
  const p7 = typeof t.change7dPct === 'number' ? fmtPctArrow(t.change7dPct) : null;
  const sub = [
    p1 ? `1h ${p1.arrow} ${p1.text}` : '',
    p7 ? `7d ${p7.arrow} ${p7.text}` : '',
  ].filter(Boolean).join('  ·  ');
  return `
    <tr>
      ${tokenCell(t)}
      <td style="padding:10px 8px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);color:#cbd5e1;font-size:13px;font-family:monospace">${fmtUsdCompact(t.price)}</td>
      <td style="padding:10px 8px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);font-family:monospace">
        <div style="font-weight:700;font-size:13px;color:${p.color}">${p.arrow} ${p.text}</div>
        ${sub ? `<div style="color:#64748b;font-size:10px;font-weight:600">${sub}</div>` : ''}
      </td>
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

/** Most-traded assets by REAL 24h volume from the top-100 snapshot. */
function volumeRow(t: BriefToken): string {
  const p = fmtPctArrow(t.changePct);
  return `
    <tr>
      ${tokenCell(t)}
      <td style="padding:10px 8px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);color:#cbd5e1;font-size:13px;font-family:monospace">${typeof t.volume === 'number' ? fmtUsdCompact(t.volume) : ''}</td>
      <td style="padding:10px 8px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);font-weight:700;font-size:13px;color:${p.color};font-family:monospace">${p.arrow} ${p.text}</td>
    </tr>`;
}

function volumeTable(tokens: BriefToken[]): string {
  if (tokens.length === 0) return '';
  return `
    <h3 style="color:#f1f5f9;font-size:16px;margin:28px 0 8px;display:flex;align-items:center;gap:8px">
      <span>📊</span> Most Traded <span style="color:#64748b;font-size:12px;font-weight:400">24h volume</span>
    </h3>
    <table style="width:100%;border-collapse:collapse;background:rgba(255,255,255,0.02);border-radius:12px;overflow:hidden">
      ${tokens.map(volumeRow).join('')}
    </table>`;
}

/** Market breadth: REAL advancers vs decliners across the top-100 snapshot. */
function breadthBlock(adv: number, dec: number, universe: number): string {
  if (universe === 0) return '';
  const flat = Math.max(0, universe - adv - dec);
  const w = (n: number) => `${((n / universe) * 100).toFixed(1)}%`;
  return `
    <h3 style="color:#f1f5f9;font-size:16px;margin:28px 0 8px;display:flex;align-items:center;gap:8px">
      <span>⚖️</span> Market Breadth <span style="color:#64748b;font-size:12px;font-weight:400">top ${universe} by market cap</span>
    </h3>
    <div style="display:flex;height:12px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,0.06);margin-bottom:10px">
      <div style="width:${w(adv)};background:#10B981"></div>
      <div style="width:${w(flat)};background:#475569"></div>
      <div style="width:${w(dec)};background:#EF4444"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px">
      <span style="color:#10B981;font-weight:700">${adv} advancing</span>
      ${flat > 0 ? `<span style="color:#94a3b8">${flat} flat</span>` : ''}
      <span style="color:#EF4444;font-weight:700">${dec} declining</span>
    </div>`;
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
  // Total tracked flow across the surfaced moves — a REAL aggregate of the same
  // rows, so the reader sees scale at a glance without any fabricated figure.
  const totalFlow = moves.reduce((s, m) => s + (m.valueUsd || 0), 0);
  return `
    <h3 style="color:#f1f5f9;font-size:16px;margin:28px 0 8px;display:flex;align-items:center;gap:8px">
      <span>🐋</span> Biggest Whale Moves <span style="color:#64748b;font-size:12px;font-weight:400">last 24h · ${fmtUsdCompact(totalFlow)} tracked</span>
    </h3>
    ${rows}`;
}

/** Decorative on-brand SVG cover (data URI) stamped with the date + vibe. */
function buildCover(dateLabel: string, vibe: MarketVibe, marketCap: number): string {
  const cap = marketCap > 0 ? fmtUsdCompact(marketCap) : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#05081E"/><stop offset="0.55" stop-color="#0A1238"/><stop offset="1" stop-color="#0066FF"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.8" cy="0.2" r="0.6">
        <stop offset="0" stop-color="${vibe.color}" stop-opacity="0.45"/><stop offset="1" stop-color="${vibe.color}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="400" fill="url(#g)"/>
    <rect width="1200" height="400" fill="url(#glow)"/>
    <text x="64" y="96" fill="#8FA3FF" font-family="Arial,sans-serif" font-size="24" font-weight="700" letter-spacing="3">NAKA LABS RESEARCH</text>
    <text x="64" y="200" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="76" font-weight="900">Daily Market Brief</text>
    <text x="64" y="262" fill="#C7D2FE" font-family="Arial,sans-serif" font-size="34" font-weight="600">${esc(dateLabel)}</text>
    <text x="64" y="336" fill="${vibe.color}" font-family="Arial,sans-serif" font-size="32" font-weight="800">${vibe.emoji} ${esc(vibe.label)}</text>
    ${cap ? `<text x="1136" y="336" text-anchor="end" fill="#94A3B8" font-family="monospace" font-size="28" font-weight="700">Mkt Cap ${esc(cap)}</text>` : ''}
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ─── Public builder ─────────────────────────────────────────────────────────

// ─── AI Market Read (grounded narrative) ────────────────────────────────────

interface NarrativeInput {
  dateLabel: string;
  vibe: MarketVibe;
  global: GlobalMarketData | null;
  gainers: BriefToken[];
  losers: BriefToken[];
  moves: BriefWhaleMove[];
  trending: BriefToken[];
}

/**
 * Ask Claude to interpret the brief's REAL numbers into a short market read.
 * The model is given only the assembled real data and is forbidden from
 * inventing any token, number, or event. Returns an HTML block, or '' when the
 * model is unavailable / returns nothing (never a fabricated narrative).
 */
async function buildAiNarrative(input: NarrativeInput): Promise<string> {
  const { vibe, global, gainers, losers, moves, trending } = input;
  // Only build a narrative when there's real material to interpret.
  if (gainers.length === 0 && losers.length === 0 && moves.length === 0) return '';

  const lines: string[] = [`Market vibe: ${vibe.label} (${vibe.blurb})`];
  if (global) lines.push(`Total market cap: ${fmtUsdCompact(global.totalMarketCapUSD)} (${fmtPctArrow(global.marketCapChange24hPercent).arrow} ${fmtPctArrow(global.marketCapChange24hPercent).text} 24h). BTC dominance ${global.btcDominancePercent.toFixed(1)}%. 24h volume ${fmtUsdCompact(global.totalVolumeUSD)}.`);
  if (gainers.length) lines.push(`Top gainers (24h): ${gainers.map(g => `${g.symbol.toUpperCase()} up ${fmtPctArrow(g.changePct).text}`).join(', ')}.`);
  if (losers.length) lines.push(`Top losers (24h): ${losers.map(l => `${l.symbol.toUpperCase()} down ${fmtPctArrow(l.changePct).text}`).join(', ')}.`);
  if (moves.length) lines.push(`Biggest whale moves (last 24h): ${moves.map(m => `${m.label} ${m.action === 'buy' ? 'bought' : m.action === 'sell' ? 'sold' : 'moved'} ${fmtUsdCompact(m.valueUsd)} of ${m.tokenSymbol.toUpperCase()} on ${m.chain}`).join('; ')}.`);
  if (trending.length) lines.push(`Trending searches: ${trending.map(t => t.symbol.toUpperCase()).join(', ')}.`);

  const prompt = `You are the Naka Labs research desk writing a short crypto market read for today.

Here is the ONLY data you may use (all real, pulled live at publish time):
${lines.join('\n')}

Write 2 to 3 tight paragraphs (about 90 to 140 words total) interpreting THIS data: what the market is doing, what stands out among the movers, and what the whale flows suggest. Reference the actual tickers and figures above by name.

STRICT RULES:
- Use ONLY the tokens, numbers, and moves listed above. Do NOT invent any ticker, price, percentage, event, partnership, or statistic that is not in the data.
- No price predictions, no targets, no financial advice.
- Do not use the words "dash" or any "—"/"–"/"-" character as a separator; write plainly.
- Plain prose only. No markdown, no headings, no bullet points, no preamble like "Here is".
Return only the prose.`;

  try {
    const text = (await vtxAnalyze(prompt, 600))?.trim();
    if (!text || text.length < 40) return '';
    // Render as paragraphs; escape so the model's text can never inject markup.
    const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
      .map(p => `<p style="color:#cbd5e1;font-size:14px;line-height:1.8;margin:0 0 12px">${esc(p)}</p>`).join('');
    if (!paras) return '';
    return `
    <div style="background:rgba(111,126,255,0.06);border:1px solid rgba(111,126,255,0.2);border-radius:14px;padding:18px;margin:0 0 8px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:16px">⚡</span>
        <span style="color:#c7d2fe;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px">Naka AI Market Read</span>
      </div>
      ${paras}
    </div>`;
  } catch {
    return '';
  }
}

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

  const toBrief = (t: CoinGeckoMarketToken): BriefToken => ({
    symbol: t.symbol, name: t.name, image: t.image,
    price: t.current_price ?? 0, changePct: t.price_change_percentage_24h ?? 0,
    change1hPct: t.price_change_percentage_1h_in_currency,
    change7dPct: t.price_change_percentage_7d_in_currency,
    volume: typeof t.total_volume === 'number' ? t.total_volume : undefined,
    marketCap: typeof t.market_cap === 'number' ? t.market_cap : undefined,
    rank: typeof t.market_cap_rank === 'number' ? t.market_cap_rank : undefined,
  });

  const withChange = top.filter(t => typeof t.price_change_percentage_24h === 'number');
  const gainers = [...withChange].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
    .filter(t => t.price_change_percentage_24h > 0).slice(0, 5).map(toBrief);
  const losers = [...withChange].sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h)
    .filter(t => t.price_change_percentage_24h < 0).slice(0, 5).map(toBrief);

  // ── Market breadth (REAL advancers vs decliners across the top-100 snapshot) ──
  const advancers = withChange.filter(t => t.price_change_percentage_24h > 0).length;
  const decliners = withChange.filter(t => t.price_change_percentage_24h < 0).length;
  const breadthUniverse = withChange.length;

  // ── Benchmark majors present in the snapshot, in market-cap order (REAL) ──
  const MAJOR_SYMBOLS = ['btc', 'eth', 'sol', 'bnb', 'xrp', 'doge', 'ada', 'avax'];
  const majors = MAJOR_SYMBOLS
    .map(sym => top.find(t => (t.symbol || '').toLowerCase() === sym))
    .filter((t): t is CoinGeckoMarketToken => Boolean(t))
    .slice(0, 6)
    .map(toBrief);

  // ── Most traded by REAL 24h volume ──
  const volumeLeaders = [...top]
    .filter(t => typeof t.total_volume === 'number' && t.total_volume > 0)
    .sort((a, b) => (b.total_volume ?? 0) - (a.total_volume ?? 0))
    .slice(0, 5)
    .map(toBrief);

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
  const topLose = losers[0];
  const summaryBits: string[] = [`Market vibe is ${vibe.label.toLowerCase()} this ${edition.label.toLowerCase()}.`];
  if (global) summaryBits.push(`Total cap ${fmtUsdCompact(global.totalMarketCapUSD)} with BTC dominance ${global.btcDominancePercent.toFixed(1)}%.`);
  if (topGain) summaryBits.push(`${topGain.symbol.toUpperCase()} leads the gainers at ${fmtPctArrow(topGain.changePct).text} up.`);
  if (topLose) summaryBits.push(`${topLose.symbol.toUpperCase()} leads the losers at ${fmtPctArrow(topLose.changePct).text} down.`);
  if (breadthUniverse) summaryBits.push(`${advancers} of the top ${breadthUniverse} assets are green over 24h.`);
  if (moves.length) {
    const flow = moves.reduce((s, m) => s + (m.valueUsd || 0), 0);
    summaryBits.push(`${moves.length} major whale moves tracked on chain totaling ${fmtUsdCompact(flow)}.`);
  }
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
      </div>
      ${global.activeCryptocurrencies > 0 ? `
      <div style="flex:1;min-width:140px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:16px">
        <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px">Active Assets</div>
        <div style="color:#f1f5f9;font-size:20px;font-weight:800;margin-top:4px;font-family:monospace">${global.activeCryptocurrencies.toLocaleString('en-US')}</div>
        <div style="color:#94a3b8;font-size:12px;margin-top:4px">tracked across the market</div>
      </div>` : ''}` : ''}
    </div>`;

  // Trending pills carry the REAL 24h change CoinGecko returns for each trending
  // coin (data.price_change_percentage_24h.usd), shown as an arrowed chip when
  // non-zero so the pill says more than just a ticker.
  const trendingBlock = trending.length ? `
    <h3 style="color:#f1f5f9;font-size:16px;margin:28px 0 8px">🔥 Trending Searches</h3>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${trending.map(t => {
        const c = fmtPctArrow(t.changePct);
        const chg = Math.abs(t.changePct) > 0.0001
          ? ` <span style="color:${c.color};font-weight:700">${c.arrow} ${c.text}</span>`
          : '';
        return `<span style="display:inline-flex;align-items:center;gap:6px;background:rgba(111,126,255,0.12);border:1px solid rgba(111,126,255,0.25);border-radius:999px;padding:6px 12px;color:#c7d2fe;font-size:13px;font-weight:600"><img src="${esc(t.image)}" width="16" height="16" style="border-radius:50%"/> ${esc(t.symbol.toUpperCase())}${chg}</span>`;
      }).join('')}
    </div>` : '';

  // AI Market Read — Claude interprets ONLY the real numbers assembled above
  // into a grounded narrative. Fully omitted (no fabricated text) if the model
  // is unavailable or returns nothing. Numbers stay authoritative in the
  // structured sections below; the narrative may only reference what it's given.
  const aiNarrative = await buildAiNarrative({ dateLabel, vibe, global: global ?? null, gainers, losers, moves, trending });

  const contentHtml = `
    <p style="color:#cbd5e1;font-size:15px;line-height:1.8;margin:0 0 20px">
      Here is your on-chain and market read for <strong style="color:#f1f5f9">${esc(dateLabel)}</strong>, straight from the Naka Labs desk. Everything below is pulled live from market data and our own whale feed.
    </p>
    ${aiNarrative}
    ${vibeBlock}
    ${breadthBlock(advancers, decliners, breadthUniverse)}
    ${moversTable('Benchmark Majors', '#6F7EFF', majors)}
    ${moversTable('Top Gainers', '#10B981', gainers)}
    ${moversTable('Top Losers', '#EF4444', losers)}
    ${volumeTable(volumeLeaders)}
    ${whaleSection(moves)}
    ${trendingBlock}
    <p style="color:#64748b;font-size:12px;line-height:1.7;margin:28px 0 0;border-top:1px solid rgba(255,255,255,0.07);padding-top:16px">
      Data sourced from CoinGecko and the Naka Labs whale tracker at publish time. Markets move fast; treat this as a starting point, not financial advice.
    </p>`;

  const readTime = Math.max(2, Math.round((majors.length + gainers.length + losers.length + volumeLeaders.length + moves.length + trending.length) / 4) + 1);
  const coverImage = buildCover(dateLabel, vibe, global?.totalMarketCapUSD ?? 0);

  const title = `Market Brief · ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} ${edition.label}`;

  return {
    slug, title, summary, contentHtml,
    tags: ['Daily Brief', 'Market', vibe.label],
    coverImage, readTime, dateLabel,
    global, gainers, losers, trending, whaleMoves: moves, vibe,
    majors, volumeLeaders, advancers, decliners, breadthUniverse,
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
