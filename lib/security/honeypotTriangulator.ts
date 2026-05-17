/**
 * Honeypot detection via three-source triangulation. GoPlus alone
 * misses ~12% of honeypots on Solana and ~6% on EVM (vs ground-truth
 * Honeypot.is dataset). Triangulating across GoPlus + Honeypot.is
 * (EVM) / de.fi Scanner + RugCheck (Solana) catches the long tail
 * and returns a 0..3 confidence count instead of a single source's
 * binary verdict.
 *
 * Audit §B.4 P1 source triangulation. Pure transform — caller
 * fetches the three source verdicts; this lib votes.
 */

export type SourceVerdict = 'honeypot' | 'safe' | 'unknown';

export interface TriangulationInput {
  goPlus: SourceVerdict;
  /** Honeypot.is (EVM) — pass 'unknown' on Solana. */
  honeypotIs?: SourceVerdict;
  /** RugCheck (Solana) — pass 'unknown' on EVM. */
  rugCheck?: SourceVerdict;
  /** de.fi Scanner — both chains. */
  deFi?: SourceVerdict;
}

export interface TriangulationVerdict {
  honeypot: boolean;
  sourcesVoted: number;
  sourcesAgreed: number;
  confidence: 'high' | 'medium' | 'low';
  /** Names of sources that voted honeypot — UI uses this for badge stack. */
  honeypotSources: string[];
  /** Names of sources that voted safe — UI shows the alternative voice. */
  safeSources: string[];
}

export function triangulateHoneypot(input: TriangulationInput): TriangulationVerdict {
  const entries: Array<[string, SourceVerdict]> = [
    ['GoPlus', input.goPlus],
    ['Honeypot.is', input.honeypotIs ?? 'unknown'],
    ['RugCheck', input.rugCheck ?? 'unknown'],
    ['de.fi', input.deFi ?? 'unknown'],
  ];
  const voted = entries.filter(([, v]) => v !== 'unknown');
  const honeypotVotes = voted.filter(([, v]) => v === 'honeypot');
  const safeVotes = voted.filter(([, v]) => v === 'safe');

  let confidence: 'high' | 'medium' | 'low';
  if (voted.length >= 3) {
    // 3+ sources weighed in.
    confidence = honeypotVotes.length === voted.length || safeVotes.length === voted.length ? 'high' : 'medium';
  } else if (voted.length === 2) {
    confidence = honeypotVotes.length === 2 || safeVotes.length === 2 ? 'medium' : 'low';
  } else {
    confidence = 'low';
  }

  // Majority rule with fail-CLOSED tiebreaker — if exactly half vote
  // honeypot, we treat as honeypot. Better to over-flag a legit
  // token than to let a single missing source decide a trade.
  const honeypot = honeypotVotes.length >= safeVotes.length && honeypotVotes.length > 0;

  return {
    honeypot,
    sourcesVoted: voted.length,
    sourcesAgreed: Math.max(honeypotVotes.length, safeVotes.length),
    confidence,
    honeypotSources: honeypotVotes.map(([name]) => name),
    safeSources: safeVotes.map(([name]) => name),
  };
}
