/**
 * Spam-token classifier for portfolio rows. The portfolio already
 * filters by GoPlus securityScore (< 30 = hidden) but that misses
 * the airdrop-spam pattern: zero-value scam tokens dumped on every
 * wallet, with NO security score at all because they're too obscure
 * for GoPlus to have indexed.
 *
 * Heuristics here are conservative — we'd rather show one spam row
 * than hide a real holding the user actually cares about. Each
 * heuristic contributes 0..1 to the score; >= 0.7 == spam.
 *
 * Audit §5.6 / B.1 P1.
 */

export interface SpamCandidate {
  symbol: string;
  /** Token name from on-chain metadata. */
  name?: string | null;
  /** USD value of the position. */
  valueUsd?: number | null;
  /** Token balance (number, not BigInt). */
  balance?: number | null;
  /** GoPlus security score 0..100 when available. */
  securityScore?: number | null;
  /** True when the user has never made an outbound transfer of this token. */
  neverTransferredOut?: boolean | null;
  /** True when the token contract is flagged as honeypot. */
  isHoneypot?: boolean | null;
}

export interface SpamClassification {
  isSpam: boolean;
  score: number; // 0..1
  reasons: string[];
}

// Common scam keywords. Conservative — we match WHOLE WORDS to avoid
// false-positives on legitimate tokens that happen to contain a
// keyword as a substring (e.g. 'AIRDROP' inside an unrelated symbol).
const SPAM_KEYWORDS = [
  /\bcla?im\b/i,
  /\bairdrop\b/i,
  /\bvisit\b/i,
  /\bwebsite\b/i,
  /\.com\b/i,
  /\.xyz\b/i,
  /\.io\b/i,
  /\.net\b/i,
  /\bhttps?:\/\//i,
  /\bgift\b/i,
  /\breward\b/i,
];

function keywordHit(text: string): boolean {
  return SPAM_KEYWORDS.some((re) => re.test(text));
}

export function classifySpam(c: SpamCandidate): SpamClassification {
  const reasons: string[] = [];
  let score = 0;

  // 1. Honeypot is an automatic flag.
  if (c.isHoneypot) {
    reasons.push('honeypot');
    score = Math.max(score, 1);
  }

  // 2. Very low GoPlus security score.
  if (typeof c.securityScore === 'number' && c.securityScore > 0 && c.securityScore < 25) {
    reasons.push(`security ${c.securityScore}/100`);
    score = Math.max(score, 0.85);
  }

  // 3. Symbol or name contains spam keyword.
  const symKeyword = keywordHit(c.symbol);
  const nameKeyword = c.name ? keywordHit(c.name) : false;
  if (symKeyword || nameKeyword) {
    reasons.push('promo keyword');
    score = Math.max(score, 0.8);
  }

  // 4. Dust-value airdrop pattern — balance > 0 but valueUsd < $0.10
  //    AND the user never sent any out.
  if (
    typeof c.valueUsd === 'number' &&
    c.valueUsd < 0.1 &&
    typeof c.balance === 'number' &&
    c.balance > 0 &&
    c.neverTransferredOut === true
  ) {
    reasons.push('untransferred dust');
    score = Math.max(score, 0.7);
  }

  // 5. Symbol has weird characters or zero-width unicode (common
  //    homograph spam).
  if (/[​-‍﻿⁠]/.test(c.symbol)) {
    reasons.push('zero-width chars');
    score = Math.max(score, 0.9);
  }
  if (c.symbol.length > 16) {
    reasons.push('long symbol');
    score = Math.max(score, 0.65);
  }

  return {
    isSpam: score >= 0.7,
    score,
    reasons,
  };
}
