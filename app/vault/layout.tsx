import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { IdentityStrip } from '@/components/vault/IdentityStrip';
import { VaultNav } from '@/components/vault/VaultNav';
import { CultPlayer } from '@/components/vault/CultPlayer';
import './vault.css';

interface LoadoutCosmetic {
  slot: string;
  label: string | null;
  preview_color: string | null;
}

/**
 * Resolve the member's worn identity from their equipped loadout so it actually
 * renders somewhere (the loadout was write-only before): the equipped `title`
 * cosmetic becomes the rank text, and the first of glow/frame/sigil with a
 * colour becomes the strip accent. Best-effort · falls back to the plain
 * Cultist identity on any error.
 */
async function resolveWornIdentity(userId: string | null | undefined): Promise<{ rank: string; accentColor: string | null }> {
  const fallback = { rank: 'Cultist', accentColor: null };
  if (!userId) return fallback;
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from('cult_member_loadouts')
      .select('slot, cult_cosmetics(slot,label,preview_color)')
      .eq('user_id', userId);
    const bySlot = new Map<string, { label: string | null; preview_color: string | null }>();
    for (const row of (data ?? []) as Array<{ slot: string; cult_cosmetics: LoadoutCosmetic | LoadoutCosmetic[] | null }>) {
      const c = Array.isArray(row.cult_cosmetics) ? row.cult_cosmetics[0] : row.cult_cosmetics;
      if (c) bySlot.set(row.slot, { label: c.label, preview_color: c.preview_color });
    }
    return {
      rank: bySlot.get('title')?.label || 'Cultist',
      accentColor:
        bySlot.get('glow')?.preview_color ??
        bySlot.get('frame')?.preview_color ??
        bySlot.get('sigil')?.preview_color ??
        null,
    };
  } catch {
    return fallback;
  }
}

export const dynamic = 'force-dynamic';

/**
 * Vault root layout. Gates every /vault route on cult access.
 * Non-members are bounced to /naka-cult (the dramatic landing). The
 * gate runs server-side via getCultAccess() so the chamber HTML never
 * ships to non-members.
 */
export default async function VaultLayout({ children }: { children: ReactNode }) {
  const access = await getCultAccess();
  if (!access.allowed) {
    // /naka-cult is the dramatic landing · explains the cult and how to
    // enter. Replaces the previous /dashboard?denied=cult fallback now
    // that the landing exists.
    redirect('/naka-cult');
  }

  const worn = await resolveWornIdentity(access.userId);

  return (
    <div className="vault-shell">
      <header className="vault-header">
        <IdentityStrip
          username={access.displayName ?? access.username ?? 'Cultist'}
          rank={worn.rank}
          accentColor={worn.accentColor}
        />
        <VaultNav />
      </header>
      <main className="vault-main">{children}</main>
      <CultPlayer />
    </div>
  );
}
