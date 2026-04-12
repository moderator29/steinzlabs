'use client';

import { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, Loader } from 'lucide-react';

interface ScanResult {
  allowed: boolean;
  blocked: boolean;
  riskScore: number;
  message: string;
  scammers?: any[];
  verifiedHolders?: string[];
}

interface ShadowGuardianScanProps {
  tokenAddress: string;
  onComplete?: (result: ScanResult) => void;
}

export function ShadowGuardianScan({ tokenAddress, onComplete }: ShadowGuardianScanProps) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  async function runScan() {
    try {
      setScanning(true);
      setResult(null);

      const response = await fetch('/api/security/scan-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAddress, amount: 100 }),
      });

      const data = await response.json();
      setResult(data);

      if (onComplete) onComplete(data);
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setScanning(false);
    }
  }

  if (scanning) {
    return (
      <div className="bg-[#141824] rounded-lg p-6 text-center">
        <Loader className="animate-spin mx-auto mb-4 text-[#0A1EFF]" size={32} />
        <p className="text-gray-300">Shadow Guardian scanning...</p>
        <p className="text-sm text-gray-500 mt-2">
          Checking for scammers, mixers, and suspicious activity
        </p>
      </div>
    );
  }

  if (!result) {
    return (
      <button
        onClick={runScan}
        className="w-full bg-[#0A1EFF] hover:bg-[#0916CC] text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <Shield size={20} />
        Run Shadow Guardian Scan
      </button>
    );
  }

  if (result.blocked) {
    return (
      <div className="bg-red-500/10 border-2 border-red-500 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="text-red-500" size={32} />
          <div>
            <h3 className="text-lg font-bold text-red-500">TRADE BLOCKED</h3>
            <p className="text-sm text-gray-300">Risk Score: {result.riskScore}/10</p>
          </div>
        </div>

        <p className="text-white mb-4">{result.message}</p>

        {result.scammers && result.scammers.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-300">Detected Scammers:</p>
            {result.scammers.map((scammer: any, i: number) => (
              <div key={i} className="bg-[#0A0E1A] rounded p-3 text-sm">
                <div className="text-red-400 font-medium">{scammer.name}</div>
                <div className="text-gray-400">
                  {scammer.rugPulls} rug pulls • ${scammer.totalStolen} stolen • {scammer.victims} victims
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-red-500/20 rounded text-sm text-red-300">
          You cannot proceed with this trade. Shadow Guardian has detected serious risks.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-green-500/10 border-2 border-green-500 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <CheckCircle className="text-green-500" size={32} />
        <div>
          <h3 className="text-lg font-bold text-green-500">SAFE TO TRADE</h3>
          <p className="text-sm text-gray-300">Risk Score: {result.riskScore}/10</p>
        </div>
      </div>

      <p className="text-white mb-4">{result.message}</p>

      {result.verifiedHolders && result.verifiedHolders.length > 0 && (
        <div className="bg-[#0A0E1A] rounded p-3 text-sm">
          <div className="text-gray-400">Verified Institutions:</div>
          <div className="text-green-400 font-medium">
            {result.verifiedHolders.join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}
