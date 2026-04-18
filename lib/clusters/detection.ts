/**
 * Wallet cluster detection — 5 algorithms.
 *
 * Each algorithm produces edges into `wallet_edges` with a confidence score.
 * The cluster-analysis cron runs them in sequence over a sliding window of
 * fresh `whale_activity` rows, then connected-components the resulting graph
 * to derive cluster membership. This file is pure TS so it can be imported
 * by both the cron and on-demand analysis endpoints.
 */

export type EdgeType =
  | "common_funding"
  | "coordinated_trading"
  | "direct_transfer"
  | "behavioral_fingerprint"
  | "sybil_pattern";

export interface ActivityRow {
  whale_address: string;
  chain: string;
  tx_hash: string;
  action: string;
  token_address: string | null;
  amount: number | null;
  value_usd: number | null;
  counterparty: string | null;
  timestamp: string;
  block_number: number | null;
}

export interface DetectedEdge {
  from_address: string;
  to_address: string;
  chain: string;
  edge_type: EdgeType;
  weight: number;
  confidence: number;
  first_seen_at: string;
  last_seen_at: string;
  transaction_count: number;
  total_value_usd: number | null;
}

// ─── Algorithm 1: Direct transfer ─────────────────────────────────
// Any transfer_out/transfer_in row where the counterparty is also a tracked
// address. Confidence scales with tx count.
export function detectDirectTransfer(rows: ActivityRow[]): DetectedEdge[] {
  const agg = new Map<string, DetectedEdge>();
  for (const r of rows) {
    if (!r.counterparty) continue;
    if (r.action !== "transfer_out" && r.action !== "transfer_in") continue;
    const from = r.action === "transfer_out" ? r.whale_address : r.counterparty;
    const to = r.action === "transfer_out" ? r.counterparty : r.whale_address;
    const key = `${from.toLowerCase()}|${to.toLowerCase()}|${r.chain}`;
    const existing = agg.get(key);
    if (existing) {
      existing.transaction_count += 1;
      existing.total_value_usd = (existing.total_value_usd ?? 0) + (r.value_usd ?? 0);
      existing.last_seen_at = r.timestamp > existing.last_seen_at ? r.timestamp : existing.last_seen_at;
      existing.confidence = Math.min(1, 0.4 + existing.transaction_count * 0.05);
    } else {
      agg.set(key, {
        from_address: from.toLowerCase(),
        to_address: to.toLowerCase(),
        chain: r.chain,
        edge_type: "direct_transfer",
        weight: 1,
        confidence: 0.4,
        first_seen_at: r.timestamp,
        last_seen_at: r.timestamp,
        transaction_count: 1,
        total_value_usd: r.value_usd ?? null,
      });
    }
  }
  return Array.from(agg.values());
}

// ─── Algorithm 2: Common funding ───────────────────────────────────
// If wallet A and wallet B both received their first non-zero inflow from the
// same funder within a 24-hour window, emit an edge between A and B.
export function detectCommonFunding(rows: ActivityRow[]): DetectedEdge[] {
  const firstFund = new Map<string, { funder: string; ts: string; chain: string }>();
  for (const r of rows) {
    if (r.action !== "transfer_in" || !r.counterparty) continue;
    const key = `${r.whale_address.toLowerCase()}|${r.chain}`;
    const existing = firstFund.get(key);
    if (!existing || r.timestamp < existing.ts) {
      firstFund.set(key, { funder: r.counterparty.toLowerCase(), ts: r.timestamp, chain: r.chain });
    }
  }
  const byFunder = new Map<string, Array<{ address: string; ts: string; chain: string }>>();
  for (const [key, info] of firstFund) {
    const [address] = key.split("|");
    const k = `${info.funder}|${info.chain}`;
    const arr = byFunder.get(k) ?? [];
    arr.push({ address, ts: info.ts, chain: info.chain });
    byFunder.set(k, arr);
  }
  const edges: DetectedEdge[] = [];
  const WINDOW_MS = 24 * 60 * 60 * 1000;
  for (const [, siblings] of byFunder) {
    if (siblings.length < 2) continue;
    for (let i = 0; i < siblings.length; i++) {
      for (let j = i + 1; j < siblings.length; j++) {
        const dt = Math.abs(new Date(siblings[i].ts).getTime() - new Date(siblings[j].ts).getTime());
        if (dt > WINDOW_MS) continue;
        const [a, b] = [siblings[i].address, siblings[j].address].sort();
        edges.push({
          from_address: a,
          to_address: b,
          chain: siblings[i].chain,
          edge_type: "common_funding",
          weight: 1,
          confidence: 0.75,
          first_seen_at: siblings[i].ts < siblings[j].ts ? siblings[i].ts : siblings[j].ts,
          last_seen_at: siblings[i].ts > siblings[j].ts ? siblings[i].ts : siblings[j].ts,
          transaction_count: 2,
          total_value_usd: null,
        });
      }
    }
  }
  return edges;
}

// ─── Algorithm 3: Coordinated trading ─────────────────────────────
// Two wallets buying/selling the same token within 5 minutes of each other
// more than N times → coordination edge.
export function detectCoordinatedTrading(rows: ActivityRow[]): DetectedEdge[] {
  const buys = rows.filter((r) => r.action === "buy" || r.action === "sell");
  const byToken = new Map<string, ActivityRow[]>();
  for (const r of buys) {
    if (!r.token_address) continue;
    const k = `${r.chain}|${r.token_address.toLowerCase()}|${r.action}`;
    const arr = byToken.get(k) ?? [];
    arr.push(r);
    byToken.set(k, arr);
  }
  const edges = new Map<string, DetectedEdge>();
  const WINDOW_MS = 5 * 60 * 1000;
  for (const [, group] of byToken) {
    group.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const dt = new Date(group[j].timestamp).getTime() - new Date(group[i].timestamp).getTime();
        if (dt > WINDOW_MS) break;
        if (group[i].whale_address.toLowerCase() === group[j].whale_address.toLowerCase()) continue;
        const [a, b] = [group[i].whale_address.toLowerCase(), group[j].whale_address.toLowerCase()].sort();
        const key = `${a}|${b}|${group[i].chain}`;
        const existing = edges.get(key);
        if (existing) {
          existing.transaction_count += 1;
          existing.confidence = Math.min(1, 0.5 + existing.transaction_count * 0.08);
        } else {
          edges.set(key, {
            from_address: a,
            to_address: b,
            chain: group[i].chain,
            edge_type: "coordinated_trading",
            weight: 1,
            confidence: 0.55,
            first_seen_at: group[i].timestamp,
            last_seen_at: group[j].timestamp,
            transaction_count: 1,
            total_value_usd: null,
          });
        }
      }
    }
  }
  return Array.from(edges.values());
}

// ─── Algorithm 4: Behavioral fingerprint ──────────────────────────
// Wallets that trade the same basket of 3+ tokens within a week cluster together.
export function detectBehavioralFingerprint(rows: ActivityRow[]): DetectedEdge[] {
  const tokensByWallet = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.token_address || (r.action !== "buy" && r.action !== "sell")) continue;
    const k = `${r.whale_address.toLowerCase()}|${r.chain}`;
    const set = tokensByWallet.get(k) ?? new Set<string>();
    set.add(r.token_address.toLowerCase());
    tokensByWallet.set(k, set);
  }
  const wallets = Array.from(tokensByWallet.entries());
  const edges: DetectedEdge[] = [];
  for (let i = 0; i < wallets.length; i++) {
    for (let j = i + 1; j < wallets.length; j++) {
      const [kA, sA] = wallets[i];
      const [kB, sB] = wallets[j];
      const [addrA, chainA] = kA.split("|");
      const [addrB, chainB] = kB.split("|");
      if (chainA !== chainB) continue;
      let intersect = 0;
      for (const t of sA) if (sB.has(t)) intersect++;
      if (intersect < 3) continue;
      const union = sA.size + sB.size - intersect;
      const jaccard = intersect / Math.max(1, union);
      if (jaccard < 0.3) continue;
      const [a, b] = [addrA, addrB].sort();
      edges.push({
        from_address: a,
        to_address: b,
        chain: chainA,
        edge_type: "behavioral_fingerprint",
        weight: 1,
        confidence: Math.min(1, 0.5 + jaccard),
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        transaction_count: intersect,
        total_value_usd: null,
      });
    }
  }
  return edges;
}

// ─── Algorithm 5: Sybil pattern ───────────────────────────────────
// Detect wallets funded by the same source within minutes of each other,
// trading the same tokens in the same direction — strong sybil signal.
export function detectSybilPattern(rows: ActivityRow[]): DetectedEdge[] {
  const funding = detectCommonFunding(rows).filter((e) => {
    const minutes =
      (new Date(e.last_seen_at).getTime() - new Date(e.first_seen_at).getTime()) / 60000;
    return minutes <= 30; // very tight funding window
  });
  if (funding.length === 0) return [];
  const behavioralKeys = new Set(
    detectBehavioralFingerprint(rows).map(
      (e) => `${e.from_address}|${e.to_address}|${e.chain}`,
    ),
  );
  return funding
    .filter((e) => behavioralKeys.has(`${e.from_address}|${e.to_address}|${e.chain}`))
    .map((e) => ({
      ...e,
      edge_type: "sybil_pattern" as const,
      confidence: Math.min(1, 0.85 + e.confidence * 0.15),
    }));
}

export function runAllDetectors(rows: ActivityRow[]): DetectedEdge[] {
  return [
    ...detectDirectTransfer(rows),
    ...detectCommonFunding(rows),
    ...detectCoordinatedTrading(rows),
    ...detectBehavioralFingerprint(rows),
    ...detectSybilPattern(rows),
  ];
}
