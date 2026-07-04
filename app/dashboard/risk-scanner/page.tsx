'use client';

import { Target, AlertTriangle, CheckCircle, Shield, Zap, Loader2, Search, Brain, ShieldAlert, TrendingUp } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { riskScannerHowItWorks } from '@/lib/howItWorks/content/risk-scanner';
import { useState } from 'react';
import { useWallet } from '@/lib/hooks/useWallet';
import { AuroraBackground } from '@/components/brand/AuroraBackground';
import { TiltCard } from '@/components/brand/TiltCard';

// ─── Real engine types (mirror /api/portfolio-risk) ─────────────────────────

interface TokenRiskResult {
  contractAddress: string;
  symbol: string;
  riskLevel: 'safe' | 'warning' | 'danger' | 'unknown';
  score: number;
  flags: string[];
  details: {
    isHoneypot: boolean;
    isMintable: boolean;
    isProxy: boolean;
    isBlacklisted: boolean;
    selfDestruct: boolean;
    hiddenOwner: boolean;
    buyTax: number | null;
    sellTax: number | null;
    holderCount: number | null;
    top10HolderPercent: number | null;
    lpLockedPercent: number | null;
    creatorPercent: number | null;
  };
}

interface RiskResponse {
  results: Record<string, TokenRiskResult>;
  summary: {
    scanned: number;
    safe: number;
    warning: number;
    danger: number;
    unknown: number;
    avgScore: number;
    portfolioRisk: 'safe' | 'moderate' | 'high' | 'critical';
  };
}

interface Holding {
  symbol?: string;
  contractAddress?: string | null;
  valueUsd?: string | null;
}

// ─── EVM chain selector (GoPlus-supported chains only) ───────────────────────
// The contract-security engine is GoPlus-backed and EVM-only. Solana wallets
// have no on-chain contract-security equivalent in this engine, so we restrict
// the scanner to the chains the real engine actually supports.

const CHAINS: Array<{ id: string; slug: string; label: string }> = [
  { id: '1',     slug: 'ethereum',  label: 'Ethereum' },
  { id: '8453',  slug: 'base',      label: 'Base' },
  { id: '42161', slug: 'arbitrum',  label: 'Arbitrum' },
  { id: '10',    slug: 'optimism',  label: 'Optimism' },
  { id: '137',   slug: 'polygon',   label: 'Polygon' },
  { id: '56',    slug: 'bsc',       label: 'BSC' },
  { id: '43114', slug: 'avalanche', label: 'Avalanche' },
];

interface Recommendation {
  text: string;
  severity: 'danger' | 'warning' | 'safe';
}

/**
 * Build recommendations strictly from the real GoPlus-detected flags across the
 * scanned holdings. Every line is backed by an actual count of tokens that
 * tripped a specific check; nothing is templated by score tier. Returns an
 * empty array when no risk conditions were detected.
 */
function deriveRecommendations(results: TokenRiskResult[]): Recommendation[] {
  const recs: Recommendation[] = [];
  const count = (pred: (r: TokenRiskResult) => boolean) => results.filter(pred).length;
  const plural = (n: number) => (n === 1 ? 'token' : 'tokens');

  const honeypots = count(r => r.details.isHoneypot);
  if (honeypots > 0) {
    recs.push({ severity: 'danger', text: `${honeypots} ${plural(honeypots)} flagged as a honeypot by GoPlus. Do not attempt to sell or add liquidity; exit only via a route that confirms a sellable quote.` });
  }

  const selfDestruct = count(r => r.details.selfDestruct);
  if (selfDestruct > 0) {
    recs.push({ severity: 'danger', text: `${selfDestruct} ${plural(selfDestruct)} contain self destruct code that can wipe the contract. Treat these positions as unrecoverable risk.` });
  }

  const hiddenOwner = count(r => r.details.hiddenOwner);
  if (hiddenOwner > 0) {
    recs.push({ severity: 'danger', text: `${hiddenOwner} ${plural(hiddenOwner)} have a hidden owner that retains undisclosed control over the contract.` });
  }

  const blacklisted = count(r => r.details.isBlacklisted);
  if (blacklisted > 0) {
    recs.push({ severity: 'warning', text: `${blacklisted} ${plural(blacklisted)} include a blacklist function that can freeze your ability to transfer or sell.` });
  }

  const mintable = count(r => r.details.isMintable);
  if (mintable > 0) {
    recs.push({ severity: 'warning', text: `${mintable} ${plural(mintable)} have a mintable supply; the owner can dilute holders by minting new units.` });
  }

  const highTax = count(r => (r.details.buyTax != null && r.details.buyTax > 10) || (r.details.sellTax != null && r.details.sellTax > 10));
  if (highTax > 0) {
    recs.push({ severity: 'warning', text: `${highTax} ${plural(highTax)} charge a buy or sell tax above 10 percent, which erodes value on every trade.` });
  }

  const concentratedLp = count(r => r.details.lpLockedPercent != null && r.details.lpLockedPercent < 50);
  if (concentratedLp > 0) {
    recs.push({ severity: 'warning', text: `${concentratedLp} ${plural(concentratedLp)} have less than half of liquidity locked, raising the risk of a liquidity pull.` });
  }

  const whaleConcentration = count(r => r.details.creatorPercent != null && r.details.creatorPercent > 20);
  if (whaleConcentration > 0) {
    recs.push({ severity: 'warning', text: `${whaleConcentration} ${plural(whaleConcentration)} have a creator holding more than 20 percent of supply, concentrating dump risk.` });
  }

  const proxy = count(r => r.details.isProxy);
  if (proxy > 0) {
    recs.push({ severity: 'warning', text: `${proxy} ${plural(proxy)} use an upgradeable proxy; the contract logic can be changed after you buy.` });
  }

  return recs;
}

const riskLevelMeta = {
  danger:  { color: '#EF4444', label: 'Danger' },
  warning: { color: '#F59E0B', label: 'Warning' },
  safe:    { color: '#10B981', label: 'Safe' },
  unknown: { color: '#6B7280', label: 'Unknown' },
} as const;

const portfolioRiskMeta = {
  critical: { color: '#EF4444', label: 'CRITICAL RISK' },
  high:     { color: '#F97316', label: 'HIGH RISK' },
  moderate: { color: '#F59E0B', label: 'MODERATE RISK' },
  safe:     { color: '#10B981', label: 'LOW RISK' },
} as const;

export default function RiskScannerPage() {
  const { address: walletAddress } = useWallet();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [scannedAddress, setScannedAddress] = useState('');
  const [chainId, setChainId] = useState('1');
  const [data, setData] = useState<RiskResponse | null>(null);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);

  const doScan = async (address: string) => {
    setScanning(true);
    setScanned(false);
    setScannedAddress(address);
    setData(null);
    setEmptyReason(null);

    const chainMeta = CHAINS.find(c => c.id === chainId) ?? CHAINS[0];

    try {
      // 1. Pull the real holdings for this wallet on the selected chain.
      const intelRes = await fetch(
        `/api/wallet-intelligence?address=${encodeURIComponent(address)}&chain=${chainMeta.slug}`
      );
      if (!intelRes.ok) {
        const j = await intelRes.json().catch(() => ({}));
        setEmptyReason(typeof j?.error === 'string' ? j.error : 'Could not load wallet holdings.');
        return;
      }
      const intel = await intelRes.json();
      const holdings: Holding[] = Array.isArray(intel.holdings) ? intel.holdings : [];

      // 2. Keep only ERC-20 holdings that carry a contract address. The native
      //    coin and price-less dust have no contract to scan.
      const tokens = holdings
        .filter(h => h.contractAddress && h.contractAddress !== 'native' && h.contractAddress !== 'null')
        .map(h => ({ contractAddress: h.contractAddress as string, symbol: h.symbol }));

      if (tokens.length === 0) {
        setEmptyReason(
          `No scannable token contracts found for this wallet on ${chainMeta.label}. The contract security engine analyzes ERC-20 holdings; native coin only wallets have nothing to scan here.`
        );
        return;
      }

      // 3. Run the REAL GoPlus-backed engine over every holding.
      const riskRes = await fetch('/api/portfolio-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens, chainId }),
      });
      if (!riskRes.ok) {
        const j = await riskRes.json().catch(() => ({}));
        setEmptyReason(typeof j?.error === 'string' ? j.error : 'Risk scan failed.');
        return;
      }
      const result: RiskResponse = await riskRes.json();
      if (!result.summary || result.summary.scanned === 0) {
        setEmptyReason(
          `GoPlus returned no security data for this wallet's tokens on ${chainMeta.label}. This usually means the contracts are not indexed on this chain.`
        );
        return;
      }
      setData(result);
    } catch {
      setEmptyReason('Network error while scanning portfolio risk.');
    } finally {
      setScanning(false);
      setScanned(true);
    }
  };

  const handleScan = () => {
    const addr = manualAddress.trim() || walletAddress || '';
    if (!addr) return;
    doScan(addr);
  };

  const reset = () => {
    setScanned(false);
    setData(null);
    setEmptyReason(null);
  };

  const summary = data?.summary;
  const rows = data ? Object.values(data.results).sort((a, b) => a.score - b.score) : [];
  const recommendations = data ? deriveRecommendations(rows) : [];
  const portMeta = summary ? portfolioRiskMeta[summary.portfolioRisk] : null;
  const strokeDash = summary ? (summary.avgScore / 100) * 251 : 0;
  const shortAddr = scannedAddress ? `${scannedAddress.slice(0, 10)}…${scannedAddress.slice(-6)}` : '';

  return (
    <AuroraBackground fullHeight className="text-white pb-20">
      <div className="sticky top-0 z-40 nl-glass border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <BackButton />
          <Target className="w-5 h-5 text-[#0066FF]" />
          <h1 className="text-sm font-heading font-bold">Risk Scanner</h1>
          <HowItWorksButton content={riskScannerHowItWorks} className="ms-auto shrink-0" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {!scanned && !scanning && (
          <TiltCard className="nl-fade-up">
            <div className="nl-glass rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-[#0066FF]/20 to-[#8B7CFF]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-[#0066FF]" />
              </div>
              <h2 className="text-base font-heading font-bold mb-1">Contract Security Scanner</h2>
              <p className="text-xs text-gray-400 mb-4">
                Scans every ERC-20 holding against GoPlus for honeypots, taxes, mint authority, liquidity locks and ownership risk.
              </p>

              <div className="flex flex-wrap justify-center gap-1.5 mb-4">
                {CHAINS.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChainId(c.id)}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold border transition-colors ${
                      chainId === c.id
                        ? 'bg-[#0066FF]/15 border-[#0066FF]/40 text-white'
                        : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="mb-4">
                <div className="flex items-center bg-white/[0.04] rounded-xl border border-white/10 overflow-hidden">
                  <Search className="w-4 h-4 text-gray-500 ms-3 flex-shrink-0" />
                  <input
                    type="text"
                    value={manualAddress}
                    onChange={e => setManualAddress(e.target.value)}
                    placeholder={walletAddress ? `Connected: ${walletAddress.slice(0, 8)}…` : 'Enter wallet address (0x…)'}
                    className="flex-1 bg-transparent py-3 px-2 text-xs placeholder-gray-600 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <button
                onClick={handleScan}
                disabled={scanning || (!manualAddress.trim() && !walletAddress)}
                className="nl-btn-neon px-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 mx-auto"
              >
                <Zap className="w-4 h-4" /> Run Full Scan
              </button>

              {!walletAddress && !manualAddress && (
                <p className="text-[10px] text-gray-600 mt-3">Enter an address or connect your wallet first</p>
              )}
            </div>
          </TiltCard>
        )}

        {scanning && (
          <div className="nl-glass rounded-2xl p-8 text-center nl-fade-up">
            <Loader2 className="w-10 h-10 text-[#0066FF] animate-spin mx-auto mb-4" />
            <p className="text-sm font-semibold mb-1">Scanning every holding against GoPlus…</p>
            <p className="text-[10px] text-gray-500 font-mono">{shortAddr}</p>
          </div>
        )}

        {scanned && !scanning && (
          <>
            {!summary ? (
              <div className="nl-glass rounded-2xl p-6 text-center nl-fade-up">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-gray-500" />
                </div>
                <p className="text-sm font-semibold mb-1">Nothing to scan</p>
                <p className="text-xs text-gray-400">{emptyReason ?? 'No contract security data available for this wallet.'}</p>
              </div>
            ) : (
              <>
                {/* Score gauge — avg GoPlus score across real holdings */}
                <TiltCard className="nl-fade-up nl-fade-up-1">
                  <div className="nl-glass rounded-2xl p-4 text-center">
                    <p className="text-[10px] text-gray-500 font-mono mb-2">{shortAddr}</p>
                    <div className="relative w-24 h-24 mx-auto mb-2">
                      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#1A2235" strokeWidth="8" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke={portMeta!.color} strokeWidth="8" strokeDasharray={`${strokeDash} 251`} strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold" style={{ color: portMeta!.color }}>{summary.avgScore}</span>
                      </div>
                    </div>
                    <div className="text-sm font-bold" style={{ color: portMeta!.color }}>{portMeta!.label}</div>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {summary.danger > 0
                        ? `${summary.danger} dangerous ${summary.danger === 1 ? 'token' : 'tokens'} detected across ${summary.scanned} scanned`
                        : summary.warning > 0
                        ? `${summary.warning} ${summary.warning === 1 ? 'token needs' : 'tokens need'} review across ${summary.scanned} scanned`
                        : `All ${summary.scanned} scanned ${summary.scanned === 1 ? 'token looks' : 'tokens look'} clean`}
                    </p>
                  </div>
                </TiltCard>

                {/* Summary stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 nl-fade-up nl-fade-up-2">
                  <SummaryStat label="Scanned" value={summary.scanned} color="#FFFFFF" />
                  <SummaryStat label="Safe" value={summary.safe} color="#10B981" />
                  <SummaryStat label="Warning" value={summary.warning} color="#F59E0B" />
                  <SummaryStat label="Danger" value={summary.danger} color="#EF4444" />
                </div>

                {/* Per-token results */}
                <div className="space-y-2 nl-fade-up nl-fade-up-3">
                  {rows.map(r => {
                    const meta = riskLevelMeta[r.riskLevel];
                    return (
                      <div key={r.contractAddress} className="nl-glass rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${meta.color}20` }}>
                              {r.riskLevel === 'danger'
                                ? <ShieldAlert className="w-3.5 h-3.5" style={{ color: meta.color }} />
                                : r.riskLevel === 'warning'
                                ? <AlertTriangle className="w-3.5 h-3.5" style={{ color: meta.color }} />
                                : <CheckCircle className="w-3.5 h-3.5" style={{ color: meta.color }} />}
                            </div>
                            <div>
                              <div className="text-xs font-bold">{r.symbol || 'Unknown token'}</div>
                              <div className="text-[10px] text-gray-500 font-mono">{r.contractAddress.slice(0, 8)}…{r.contractAddress.slice(-6)}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-gray-400">{r.score}/100</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: `${meta.color}20`, color: meta.color }}>{meta.label}</span>
                          </div>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-1.5 mb-2">
                          <div className="h-1.5 rounded-full" style={{ width: `${r.score}%`, backgroundColor: meta.color }} />
                        </div>
                        {r.flags.length > 0 && (
                          <ul className="space-y-0.5">
                            {r.flags.slice(0, 5).map((f, i) => (
                              <li key={i} className="text-[10px] text-gray-400 flex items-start gap-1">
                                <span style={{ color: meta.color }}>·</span> {f}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Intelligence report — derived from real flags */}
                <div className="nl-glass rounded-2xl p-4 nl-fade-up nl-fade-up-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 bg-[#0066FF]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Brain className="w-4 h-4 text-[#0066FF]" />
                    </div>
                    <span className="font-bold text-sm">Intelligence Report</span>
                    <span
                      className="ms-auto text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider"
                      style={{ color: portMeta!.color, borderColor: `${portMeta!.color}4D`, backgroundColor: `${portMeta!.color}26` }}
                    >
                      {portMeta!.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp className="w-3.5 h-3.5 text-[#0066FF]" />
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Recommendations</p>
                  </div>
                  {recommendations.length > 0 ? (
                    <div className="space-y-1.5">
                      {recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs" style={{ color: rec.severity === 'danger' ? '#FCA5A5' : rec.severity === 'warning' ? '#FCD34D' : '#86EFAC' }}>
                          {rec.severity === 'danger'
                            ? <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            : rec.severity === 'warning'
                            ? <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            : <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                          {rec.text}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-xs text-[#86EFAC]">
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      No contract security flags were raised on any scanned holding. Continue to review token approvals periodically.
                    </div>
                  )}
                </div>
              </>
            )}

            <button onClick={reset} className="w-full nl-glass nl-glass--interactive py-3 rounded-xl text-xs font-semibold text-[#0066FF]">
              Scan Again
            </button>
          </>
        )}
      </div>
    </AuroraBackground>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="nl-glass rounded-xl p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
