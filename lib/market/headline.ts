/**
 * Single source of truth for the "headline market cap" convention.
 *
 * DexScreener's API (and its own UI) returns both a circulating-supply
 * `marketCap` and an `fdv`. For long-tail / memecoin tokens circulating-supply
 * data is unreliable, so DexScreener — and the traders quoting these tokens —
 * headline the FDV whenever it exceeds the reported circulating cap (e.g. a
 * token reads $267M FDV, not $116M circulating). Majors keep their real
 * circulating cap via the CoinGecko/CMC paths, which have accurate supply.
 *
 * This lived duplicated (byte-identical) in `app/api/vtx/token-card` and
 * `lib/ai/vtxToolExecutor` — the exact kind of copy that drifts and produces
 * the "the card says one number, the agent says another" inconsistency. Both
 * now call this, so the token card and the agent's market-data tool can never
 * disagree on which figure to headline.
 */

/** Coerce to a positive finite number, else 0. */
function pos(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * The market-cap figure to headline for a token: FDV when it exceeds the
 * circulating market cap, otherwise the circulating cap (falling back to FDV
 * when circulating is missing).
 */
export function headlineMarketCap(fdv: unknown, circulatingMarketCap: unknown): number {
  const fdvN = pos(fdv);
  const mcN = pos(circulatingMarketCap);
  return fdvN > mcN ? fdvN : (mcN || fdvN);
}

/**
 * Enforce the invariant that FDV is never below the headline market cap
 * (fully-diluted value can't be smaller than the value of the circulating
 * float). Returns a corrected FDV.
 */
export function clampFdv(fdv: unknown, marketCap: unknown): number {
  return Math.max(pos(fdv), pos(marketCap));
}
