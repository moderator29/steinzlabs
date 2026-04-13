import { Code, Lock, AlertTriangle } from 'lucide-react';

const AUTH_HEADERS = [
  { header: 'Authorization', value: 'Bearer <supabase_access_token>', desc: 'Required for all protected endpoints' },
  { header: 'Content-Type', value: 'application/json', desc: 'Required for POST/PUT requests' },
  { header: 'x-admin-token', value: '<admin_bearer_token>', desc: 'Admin-only routes require this header additionally' },
];

const ENDPOINTS = [
  { method: 'GET', path: '/api/intelligence/holders/:address', auth: 'Bearer', desc: 'Full holder intelligence report for token' },
  { method: 'GET', path: '/api/smart-money', auth: 'Bearer', desc: 'Smart money wallet feed with filters' },
  { method: 'POST', path: '/api/swap/quote', auth: 'Bearer', desc: 'Fetch best swap quote across DEXs' },
  { method: 'POST', path: '/api/swap/execute', auth: 'Bearer', desc: 'Execute swap transaction' },
  { method: 'GET', path: '/api/portfolio', auth: 'Bearer', desc: 'Portfolio positions for wallet address' },
  { method: 'GET', path: '/api/security', auth: 'Bearer', desc: 'Shadow Guardian token security scan' },
  { method: 'GET', path: '/api/mev-protection', auth: 'Bearer', desc: 'MEV risk score for pending swap' },
  { method: 'POST', path: '/api/auth/verify-captcha', auth: 'None', desc: 'Server-side Cloudflare Turnstile verification' },
];

const RATE_LIMITS = [
  { tier: 'Free', limit: '100 req/hour', scope: 'Per user' },
  { tier: 'Pro', limit: '1,000 req/hour', scope: 'Per user' },
  { tier: 'Institutional', limit: '10,000 req/hour', scope: 'Per account' },
  { tier: 'Admin', limit: 'Unlimited', scope: 'Platform' },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400 bg-green-400/10',
  POST: 'text-blue-400 bg-blue-400/10',
  PUT: 'text-yellow-400 bg-yellow-400/10',
  DELETE: 'text-red-400 bg-red-400/10',
};

export function DocsSection10() {
  return (
    <section id="api-reference" className="mb-14 scroll-mt-24">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-4xl font-bold text-[#0A1EFF]/15 font-mono select-none">10</span>
        <h2 className="text-2xl font-bold text-white">API Reference</h2>
      </div>
      <p className="text-gray-400 text-sm leading-relaxed mb-6 ml-12">
        All API routes are Next.js App Router route handlers. Authentication uses Supabase JWT tokens. Base URL: your deployment domain.
      </p>

      <div className="ml-12 space-y-6">
        <div id="api-auth">
          <h3 className="text-sm font-semibold text-white mb-3">Authentication</h3>
          <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1E2433]">
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Header</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Value</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {AUTH_HEADERS.map(h => (
                  <tr key={h.header} className="border-b border-[#1E2433] last:border-0">
                    <td className="px-3 py-2 font-mono text-[#0A1EFF]">{h.header}</td>
                    <td className="px-3 py-2 font-mono text-gray-300 text-[10px]">{h.value}</td>
                    <td className="px-3 py-2 text-gray-400">{h.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div id="api-endpoints">
          <h3 className="text-sm font-semibold text-white mb-3">Endpoints</h3>
          <div className="space-y-1.5">
            {ENDPOINTS.map(e => (
              <div key={e.path} className="flex items-center gap-3 bg-[#141824] border border-[#1E2433] rounded-xl p-3">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono flex-shrink-0 w-10 text-center ${METHOD_COLORS[e.method] ?? 'text-gray-400 bg-gray-400/10'}`}>{e.method}</span>
                <code className="text-xs font-mono text-gray-300 flex-1">{e.path}</code>
                <span className="text-[10px] text-gray-500 flex-shrink-0">{e.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div id="api-rate-limits">
          <h3 className="text-sm font-semibold text-white mb-3">Rate Limits</h3>
          <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1E2433]">
                  {['Tier', 'Limit', 'Scope'].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RATE_LIMITS.map(r => (
                  <tr key={r.tier} className="border-b border-[#1E2433] last:border-0">
                    <td className="px-3 py-2 text-white font-semibold">{r.tier}</td>
                    <td className="px-3 py-2 font-mono text-[#0A1EFF]">{r.limit}</td>
                    <td className="px-3 py-2 text-gray-400">{r.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">Auth endpoints have an additional IP-based limit: 5 attempts per 10 minutes. Exceeding this triggers a 15-minute block.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
