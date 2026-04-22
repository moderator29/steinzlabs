'use client';

// Public escape hatch for users stuck behind Vercel's
// REQUEST_HEADER_TOO_LARGE (494) error. Cause: Supabase auth cookies
// accumulated past the 32KB edge limit — the edge rejects every request
// before any server code runs, so the only way out is a page that clears
// cookies client-side. This route is listed in PUBLIC_PATHS in middleware
// so it's reachable even with bloated cookies (after our middleware strips
// the auth ones). On mount we nuke every cookie we can see and bounce to
// /login.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

function AuthClearInner() {
  const router = useRouter();
  const search = useSearchParams();
  const from = search.get('from') || '/';
  const [done, setDone] = useState(false);
  const [cleared, setCleared] = useState<string[]>([]);

  useEffect(() => {
    const names: string[] = [];
    try {
      // Broadest possible sweep. Some cookies were written with explicit
      // domain + path attrs (e.g. Supabase chunks on `.nakalabs.xyz`) and
      // can only be cleared by a Set-Cookie that exactly matches. We fan
      // out across every plausible (host × path) combination.
      const host = window.location.hostname;
      const hosts = Array.from(new Set([
        host,
        `.${host}`,
        host.replace(/^www\./, ''),
        `.${host.replace(/^www\./, '')}`,
        // Parent domain in case the site is on a subdomain (e.g. app.nakalabs.xyz
        // → .nakalabs.xyz chunks also need wiping).
        host.split('.').slice(-2).join('.'),
        `.${host.split('.').slice(-2).join('.')}`,
      ]));
      const paths = ['/', '/dashboard', '/auth', '/api', '/api/auth'];

      const cookies = document.cookie.split(';');
      for (const raw of cookies) {
        const name = raw.split('=')[0]?.trim();
        if (!name) continue;
        names.push(name);
        for (const h of hosts) {
          for (const p of paths) {
            // With and without SameSite/Secure — Chrome is lenient on
            // deletion but some browsers refuse to clear Secure cookies
            // with a non-Secure delete header.
            document.cookie = `${name}=; Path=${p}; Domain=${h}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
            document.cookie = `${name}=; Path=${p}; Domain=${h}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Lax`;
            document.cookie = `${name}=; Path=${p}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
          }
        }
      }
      // Wipe localStorage + sessionStorage auth residue so the client can't
      // instantly rehydrate a stale session and re-bloat the jar.
      try {
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith('sb-') || k === 'supabase.auth.token' || k.startsWith('supabase.')) {
            localStorage.removeItem(k);
          }
        });
        Object.keys(sessionStorage).forEach((k) => {
          if (k.startsWith('sb-') || k.startsWith('supabase.')) sessionStorage.removeItem(k);
        });
      } catch {}
    } finally {
      setCleared(names);
      setDone(true);
      // Auto-bounce back so users don't have to click anything.
      const target = from.startsWith('/dashboard') || from.startsWith('/admin') ? '/login' : from;
      const t = setTimeout(() => { window.location.replace(target); }, 1500);
      return () => clearTimeout(t);
    }
  }, [from, router]);

  return (
    <div className="min-h-screen bg-[#07090f] text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 rounded-full px-3 py-1 text-xs text-amber-300 font-semibold mb-5">
          Session reset
        </div>
        <h1 className="text-2xl font-bold mb-3">Refreshing your session</h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-6">
          {done
            ? 'Your browser had too many stale auth cookies stacked up (a Vercel edge limit). We cleared them — bouncing you to the login page now.'
            : 'Clearing accumulated auth cookies so you can log in again…'}
        </p>

        {done && cleared.length > 0 && (
          <div className="text-[10px] text-gray-600 font-mono mb-6 leading-relaxed">
            Cleared {cleared.length} cookie{cleared.length === 1 ? '' : 's'}
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-xl bg-[#0A1EFF] hover:bg-[#0916CC] text-white text-sm font-semibold transition-colors"
          >
            Go to login
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl border border-white/10 hover:border-white/20 text-gray-300 hover:text-white text-sm font-semibold transition-colors"
          >
            Landing page
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthClearPage() {
  return (
    <Suspense fallback={null}>
      <AuthClearInner />
    </Suspense>
  );
}
