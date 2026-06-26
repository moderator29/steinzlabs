import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { Diamond } from 'lucide-react';

interface Snapshot {
  balance_naka: string | null;
  balance_usd: string | null;
  source: string;
  captured_at: string;
}

async function loadLatest(): Promise<Snapshot | null> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from('cult_treasury_snapshots')
      .select('balance_naka, balance_usd, source, captured_at')
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle<Snapshot>();
    return data ?? null;
  } catch {
    return null;
  }
}

const fmtNum = (raw: string | null) => raw == null ? null : Number(raw);
const compact = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString();
};

export async function TreasuryPanel() {
  const snap = await loadLatest();
  const naka = fmtNum(snap?.balance_naka ?? null);
  const usd  = fmtNum(snap?.balance_usd ?? null);

  // Only treat a snapshot as a live reading when it has a real balance and is
  // recent (the cron refreshes every 6h). A NULL/stale placeholder must never
  // render as the current treasury with a real-looking date · that's the "fake
  // date" the panel was showing.
  const ageMs = snap ? Date.now() - new Date(snap.captured_at).getTime() : Infinity;
  const isLive = snap != null && naka != null && Number.isFinite(ageMs) && ageMs < 48 * 3_600_000;

  return (
    <section className="vault-portal mb-8">
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#00C8FF]">
          <Diamond size={14} /> THE TREASURY
        </span>
        {isLive && (
          <span className="text-[11px] text-[#B4C0E0]">
            Snapshot · {new Date(snap!.captured_at).toLocaleString()}
          </span>
        )}
      </header>

      <div className="text-center py-2">
        {isLive ? (
          <>
            <div className="cinematic-stat text-[40px] leading-none"
                 style={{ fontFamily: 'JetBrains Mono, SF Mono, monospace', fontWeight: 700 }}>
              {compact(naka!)} $NAKA
            </div>
            {usd != null && (
              <div className="mt-2 text-[14px] text-[#B4C0E0]">≈ ${compact(usd)} USD</div>
            )}
          </>
        ) : (
          <p className="mt-3 text-[13px] text-[#B4C0E0]">
            Awaiting the first live treasury snapshot. The on-chain balance refreshes automatically.
          </p>
        )}
      </div>
    </section>
  );
}
