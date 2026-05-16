/**
 * Multi-source security triangulation. Combines independent verdicts
 * from up to four providers (GoPlus, Honeypot.is, de.fi Scanner,
 * RugCheck) into a single confidence-weighted assessment. The UI
 * renders a 3/3-agree or 2/3-agree badge stack so the user sees not
 * just the score but the agreement across sources.
 *
 * Audit §5.8 B.4 — fresh primitive. Single-source scores were
 * vulnerable to provider blind spots: GoPlus missing newly-deployed
 * tokens, Honeypot.is only working on a subset of EVM chains, etc.
 * Voting across providers eliminates that class of false-negative.
 *
 * This file deliberately does NOT make any network calls — callers
 * pass in already-fetched verdicts. Keeps it pure and testable.
 */

export type Verdict = 'safe' | 'caution' | 'danger';

export interface SourceVerdict {
  source: 'goplus' | 'honeypot.is' | 'de.fi' | 'rugcheck';
  verdict: Verdict;
  /** 0..1, the provider's own confidence in the verdict. */
  confidence: number;
  /** Optional human-readable summary the UI can surface on hover. */
  summary?: string;
}

export interface TriangulatedResult {
  overall: Verdict;
  agreement: 'unanimous' | 'majority' | 'split';
  /** Per-verdict source count. Drives the badge stack in the UI. */
  votes: Record<Verdict, number>;
  /** Sources that did vote (excludes providers that returned no data). */
  voters: number;
  /** 0..1 weighted confidence in the overall verdict. */
  confidence: number;
}

const VERDICT_RANK: Record<Verdict, number> = { safe: 0, caution: 1, danger: 2 };

function pickMostSevereAgreement(votes: Record<Verdict, number>): Verdict {
  // Tie-break in favor of the most severe verdict so a 1-1-1 split
  // surfaces 'danger' rather than 'safe'. The UI labels the
  // disagreement explicitly so users can dig into the per-source
  // panel.
  if (votes.danger > 0 && votes.danger >= votes.caution && votes.danger >= votes.safe) return 'danger';
  if (votes.caution >= votes.safe) return 'caution';
  return 'safe';
}

export function triangulate(sources: SourceVerdict[]): TriangulatedResult {
  const votes: Record<Verdict, number> = { safe: 0, caution: 0, danger: 0 };
  let weightedSum = 0;
  let weightTotal = 0;
  for (const s of sources) {
    if (!Number.isFinite(s.confidence) || s.confidence <= 0) continue;
    votes[s.verdict] += 1;
    weightedSum += s.confidence * VERDICT_RANK[s.verdict];
    weightTotal += s.confidence;
  }
  const voters = votes.safe + votes.caution + votes.danger;
  if (voters === 0) {
    return {
      overall: 'caution',
      agreement: 'split',
      votes,
      voters: 0,
      confidence: 0,
    };
  }

  const overall = pickMostSevereAgreement(votes);
  const winning = votes[overall];
  const agreement: TriangulatedResult['agreement'] =
    winning === voters ? 'unanimous' : winning >= Math.ceil(voters / 2) ? 'majority' : 'split';

  const confidence = weightTotal > 0 ? weightedSum / weightTotal / 2 : 0;
  return { overall, agreement, votes, voters, confidence };
}
