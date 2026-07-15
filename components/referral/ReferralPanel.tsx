'use client';

/**
 * ReferralPanel - "Refer & earn" card for Settings. Shows the user's referral
 * code and share link, how many friends they've brought in, the estimated
 * rebate from those friends' trading fees, and a short list of referees. Below
 * that, a claim box to apply a friend's code.
 *
 * Self-contained and export-only: the integrator mounts it in Settings. Real
 * data only, honest zero state, payouts handled off-platform by the Naka team.
 */

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Gift, Copy, Check, Link2, Loader2 } from 'lucide-react';
import { compactUsd } from '@/lib/coins/format';

interface Referee {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  joinedAt: string;
  feesGeneratedUsd: number;
}

interface ReferralData {
  code: string;
  shareUrl: string;
  referredCount: number;
  estimatedEarningsUsd: number;
  referees: Referee[];
}

function handleOf(r: Referee): string {
  return r.display_name || (r.username ? `@${r.username}` : 'Naka trader');
}

function initialOf(r: Referee): string {
  const base = r.display_name || r.username || 'N';
  return base.charAt(0).toUpperCase();
}

export function ReferralPanel() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [claimInput, setClaimInput] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/referrals', { credentials: 'include', cache: 'no-store' });
      if (res.ok) setData((await res.json()) as ReferralData);
    } catch {
      /* silent: the card renders its loading/empty state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copyLink = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: the link stays visible to copy manually */
    }
  };

  const applyCode = async () => {
    const code = claimInput.trim();
    if (!code || claiming) return;
    setClaiming(true);
    setClaimMsg(null);
    try {
      const res = await fetch('/api/referrals/claim', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setClaimMsg({ ok: true, text: `You're now referred by ${json.referrer || 'a Naka trader'}.` });
        setClaimInput('');
        void load();
      } else {
        setClaimMsg({ ok: false, text: json.error || 'Could not apply that code.' });
      }
    } catch {
      setClaimMsg({ ok: false, text: 'Network error, please try again.' });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="nl-glass rounded-2xl p-5"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#0066FF]/15 flex items-center justify-center shrink-0">
          <Gift className="w-5 h-5 text-[#00C8FF]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-white font-semibold text-sm">Refer &amp; earn</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Share your link. Earn a share of the fees your friends trade.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : !data ? (
        <div className="text-xs text-gray-400 bg-white/5 rounded-xl px-3 py-4 text-center">
          Sign in to get your referral link.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Code + share link */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Your code</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 min-w-0 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
                <Link2 className="w-4 h-4 text-[#00C8FF] shrink-0" />
                <span className="font-mono text-sm text-white shrink-0">{data.code}</span>
                <span className="text-xs text-gray-500 truncate">{data.shareUrl}</span>
              </div>
              <button
                onClick={copyLink}
                className="flex items-center justify-center gap-1.5 shrink-0 text-xs font-medium bg-[#0066FF] hover:bg-[#0052cc] text-white px-3 py-2.5 rounded-xl transition"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                <Users className="w-3.5 h-3.5" /> Referred
              </div>
              <div className="text-xl font-bold text-white">{data.referredCount}</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                <Gift className="w-3.5 h-3.5" /> Est. rebate
              </div>
              <div className="text-xl font-bold text-[#10B981]">
                {data.estimatedEarningsUsd > 0 ? compactUsd(data.estimatedEarningsUsd) : '$0.00'}
              </div>
            </div>
          </div>

          {/* Referees */}
          {data.referees.length > 0 ? (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Your referrals</div>
              {data.referees.map((r, i) => (
                <div
                  key={`${r.username || r.display_name || 'ref'}-${i}`}
                  className="flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2"
                >
                  {r.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.avatar_url}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#0066FF]/20 flex items-center justify-center text-[11px] font-semibold text-[#00C8FF] shrink-0">
                      {initialOf(r)}
                    </div>
                  )}
                  <span className="flex-1 min-w-0 truncate text-sm text-white">{handleOf(r)}</span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {compactUsd(r.feesGeneratedUsd)} fees
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-400 bg-white/5 rounded-xl px-3 py-4 text-center">
              No referrals yet. Share your link to get started.
            </div>
          )}

          <p className="text-[10px] text-gray-500 leading-relaxed">
            Estimated rebate from your referrals&apos; trading fees. Payouts are handled by the Naka team.
          </p>

          {/* Claim box */}
          <div className="pt-3 border-t border-white/10">
            <div className="text-xs font-medium text-white mb-2">Got a friend&apos;s code?</div>
            <div className="flex items-center gap-2">
              <input
                value={claimInput}
                onChange={(e) => setClaimInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void applyCode();
                }}
                placeholder="Enter code"
                spellCheck={false}
                autoCapitalize="characters"
                className="flex-1 min-w-0 rounded-xl bg-white/5 border border-white/10 focus:border-[#0066FF]/50 outline-none px-3 py-2.5 text-sm text-white font-mono placeholder:font-sans placeholder:text-gray-500"
              />
              <button
                onClick={applyCode}
                disabled={claiming || !claimInput.trim()}
                className="flex items-center justify-center gap-1.5 shrink-0 text-xs font-medium bg-white/10 hover:bg-white/15 text-white px-4 py-2.5 rounded-xl transition disabled:opacity-40"
              >
                {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Apply
              </button>
            </div>
            {claimMsg && (
              <div
                className={`mt-2 text-xs rounded-xl px-3 py-2 ${
                  claimMsg.ok
                    ? 'text-[#10B981] bg-[#10B981]/10'
                    : 'text-rose-400 bg-rose-500/10'
                }`}
              >
                {claimMsg.text}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
