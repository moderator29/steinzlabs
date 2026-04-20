import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export function Disclaimer() {
  return (
    <section className="max-w-6xl mx-auto px-5 py-14">
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white">Important disclaimer</h3>
        </div>
        <div className="space-y-3 text-[13px] sm:text-sm text-white/55 leading-relaxed">
          <p>
            <strong className="text-white/70">Nothing on Naka Labs is financial, legal, investment, or tax advice.</strong> The intelligence, scores, signals, AI responses and tools on this platform are provided for educational and informational purposes. You are solely responsible for your financial decisions.
          </p>
          <p>
            <strong className="text-white/70">Crypto assets are highly volatile and speculative.</strong> Trading involves substantial risk, including the risk of total loss. Only engage with capital you can afford to lose. Past performance of any wallet, strategy, or platform tool is not indicative of future results.
          </p>
          <p>
            <strong className="text-white/70">Security tools reduce but do not eliminate risk.</strong> A token flagged safe today can turn malicious tomorrow. Always do your own due diligence before interacting with any smart contract, protocol or counterparty.
          </p>
          <p>
            <strong className="text-white/70">Jurisdictional restrictions apply.</strong> Naka Labs is not available to residents of sanctioned jurisdictions. You are responsible for ensuring your use of the platform complies with the laws of your country.
          </p>
          <p className="text-white/45 text-[12px] pt-2 border-t border-white/[0.05] mt-4">
            By using Naka Labs you accept our <Link href="/terms" className="text-[#4D6BFF] hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-[#4D6BFF] hover:underline">Privacy Policy</Link>. For the full legal picture, see the <Link href="/whitepaper#company" className="text-[#4D6BFF] hover:underline">Company &amp; Legal</Link> section of our whitepaper.
          </p>
        </div>
      </div>
    </section>
  );
}
