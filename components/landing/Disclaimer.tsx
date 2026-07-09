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
            <strong className="text-white/70">Nothing here is financial, legal, or investment advice.</strong> Naka Labs is an information and tooling platform: scores, signals, and AI responses are for research only, and every trading decision is yours alone.
          </p>
          <p>
            <strong className="text-white/70">Crypto is volatile; you can lose everything.</strong> Only risk what you can afford to lose. Security tools reduce but never eliminate risk, past performance doesn&apos;t predict results, and Naka Labs is unavailable where prohibited by law.
          </p>
          <p className="text-white/45 text-[12px] pt-2 border-t border-white/[0.05] mt-4">
            By using Naka Labs you accept our <Link href="/terms" className="text-[#4D6BFF] hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-[#4D6BFF] hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}
