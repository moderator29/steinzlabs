import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { resolveCoin, getStats } from '@/lib/coins/coinService';
import { vtxAnalyze } from '@/lib/services/anthropic';
import { scanTokenSecurity } from '@/lib/security/goplusService';
import { compactUsd } from '@/lib/coins/format';

export const dynamic = 'force-dynamic';

/**
 * A short, honest VTX read of a single coin, grounded strictly in the real data
 * we already hold: price, liquidity, volume, buy/sell split and the token's
 * security signal. No AI key configured => an honest "unavailable" state; we
 * never invent an analysis.
 *
 * Response: { available: true, summary, flags: [{ kind, text }] }
 *        or { available: false, reason }
 */

interface VtxFlag { kind: 'strength' | 'risk'; text: string; }

export async function GET(_req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await ctx.params;
  const addr = decodeURIComponent(address);

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ available: false, reason: 'AI read unavailable' });
  }

  const coin = await resolveCoin(chain, addr);
  if (!coin) return NextResponse.json({ available: false, reason: 'Coin not found' }, { status: 404 });

  // Pull the real buy/sell split and the security signal in parallel; both are
  // optional context, never blockers.
  const [stats, sec] = await Promise.all([
    getStats(chain, addr, coin.pairAddress).catch(() => null),
    scanTokenSecurity(addr, chain).catch(() => null),
  ]);

  // Only real, present numbers make it into the grounding block. Anything null
  // is passed through as "unavailable" so the model can never fill a gap.
  const secReasons: string[] = [];
  if (sec) {
    if (sec.isHoneypot) secReasons.push('honeypot flagged');
    if (sec.cannotSellAll) secReasons.push('cannot sell all');
    if (sec.isMintable) secReasons.push('supply mintable');
    if (sec.hasHiddenOwner) secReasons.push('hidden owner');
    if (sec.canTakeBackOwnership) secReasons.push('ownership reclaimable');
    if (sec.isOpenSource === false) secReasons.push('source not verified');
    if (sec.buyTax > 0.1) secReasons.push(`buy tax ${Math.round(sec.buyTax * 100)}%`);
    if (sec.sellTax > 0.1) secReasons.push(`sell tax ${Math.round(sec.sellTax * 100)}%`);
  }

  const facts = [
    `Symbol: ${coin.symbol || coin.name || 'unknown'}`,
    `Chain: ${coin.chain}`,
    `Price USD: ${coin.priceUsd != null ? coin.priceUsd : 'unavailable'}`,
    `Market cap USD: ${coin.marketCapUsd != null ? compactUsd(coin.marketCapUsd) : 'unavailable'}`,
    `Liquidity USD: ${coin.liquidityUsd != null ? compactUsd(coin.liquidityUsd) : 'unavailable'}`,
    `24h volume USD: ${coin.volume24hUsd != null ? compactUsd(coin.volume24hUsd) : 'unavailable'}`,
    `24h change %: ${coin.change24h != null ? coin.change24h : 'unavailable'}`,
    `1h change %: ${coin.change1h != null ? coin.change1h : 'unavailable'}`,
    `24h buys: ${stats?.buys ?? coin.txns24h?.buys ?? 'unavailable'}`,
    `24h sells: ${stats?.sells ?? coin.txns24h?.sells ?? 'unavailable'}`,
    `24h buyers: ${stats?.buyers ?? 'unavailable'}`,
    `24h sellers: ${stats?.sellers ?? 'unavailable'}`,
    `Holders: ${coin.holdersCount ?? 'unavailable'}`,
    `Naka verified: ${coin.verified ? 'yes' : 'no'}`,
    `Security rating: ${sec ? sec.safetyLevel : 'unavailable'}`,
    `Security flags: ${secReasons.length ? secReasons.join(', ') : (sec ? 'none confirmed' : 'unavailable')}`,
  ].join('\n');

  const prompt = `Give a concise read on this coin using ONLY the data below. Do not invent any number or fact not present here; if a field says "unavailable", do not guess it.

DATA:
${facts}

Respond with STRICT JSON only, no prose outside it, in this exact shape:
{"summary":"2 to 4 sentences of plain, direct analysis grounded in the numbers above","flags":[{"kind":"strength","text":"short specific point"},{"kind":"risk","text":"short specific point"}]}

Rules: 2 to 4 flags total, each tied to a real figure or confirmed security flag above. No emojis. No em-dashes. No generic "DYOR" filler.`;

  try {
    const raw = await vtxAnalyze(prompt, 700);
    const parsed = parseVtx(raw);
    if (!parsed) {
      // Model replied but not as parseable JSON: surface the text honestly as
      // the summary with no fabricated flags.
      const text = raw.trim();
      if (!text) return NextResponse.json({ available: false, reason: 'AI read unavailable' });
      return NextResponse.json({ available: true, summary: text, flags: [] as VtxFlag[] });
    }
    return NextResponse.json({ available: true, summary: parsed.summary, flags: parsed.flags });
  } catch {
    return NextResponse.json({ available: false, reason: 'AI read unavailable' });
  }
}

/** Best-effort extraction of the strict-JSON block from the model reply. */
function parseVtx(raw: string): { summary: string; flags: VtxFlag[] } | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as { summary?: unknown; flags?: unknown };
    const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
    if (!summary) return null;
    const flags: VtxFlag[] = Array.isArray(obj.flags)
      ? obj.flags
          .filter((f): f is { kind: string; text: string } => !!f && typeof f === 'object' && typeof (f as { text?: unknown }).text === 'string')
          .slice(0, 4)
          .map((f): VtxFlag => ({ kind: f.kind === 'strength' ? 'strength' : 'risk', text: String(f.text).trim() }))
          .filter((f) => f.text.length > 0)
      : [];
    return { summary, flags };
  } catch {
    return null;
  }
}
