/**
 * $cashtag parsing for The Wire.
 *
 * A cashtag is a `$` immediately followed by a ticker: a letter, then up to nine
 * more letters/digits (e.g. $BTC, $SOL, $WIF). Case-insensitive on input,
 * normalised to uppercase. Used to split a wire body into plain text and live
 * price chips, and to collect the symbols a card needs a price for.
 */
export const CASHTAG_RE = /\$([A-Za-z][A-Za-z0-9]{0,9})\b/g;

/** Unique uppercase symbols referenced by `$SYMBOL` tokens in the text. */
export function extractCashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const m of text.matchAll(CASHTAG_RE)) out.add(m[1].toUpperCase());
  return Array.from(out);
}
