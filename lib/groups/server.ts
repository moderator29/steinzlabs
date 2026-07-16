import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/** Shared server helpers for Groups: auth, slug/code generation, membership. */

export async function groupAuthUser() {
  const store = await cookies();
  const c = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => store.get(n)?.value, set() {}, remove() {} } },
  );
  const { data: { user } } = await c.auth.getUser();
  return user;
}

export function slugifyBase(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'group';
}

// Short url-safe code (no ambiguous chars) seeded from the caller (crypto in the
// route). We keep it here so slug + invite code share one alphabet.
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
export function randomCode(bytes: Uint8Array, len = 8): string {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i % bytes.length] % ALPHABET.length];
  return out;
}

export type MemberRow = { role: string; status: string } | null;

/** The caller's membership row for a group (or null). */
export async function membershipOf(groupId: string, userId: string): Promise<MemberRow> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from('group_members')
    .select('role, status')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

export function isActive(m: MemberRow): boolean { return m?.status === 'active'; }
export function isManager(m: MemberRow): boolean { return m?.status === 'active' && (m.role === 'owner' || m.role === 'admin'); }

/** Mutual-follow friends of a user who currently allow group invites. */
export async function friendsAllowingInvites(userId: string): Promise<string[]> {
  const db = getSupabaseAdmin();
  // People I follow (accepted).
  const { data: iFollow } = await db.from('social_follows').select('following_id').eq('follower_id', userId).eq('status', 'accepted');
  const following = new Set((iFollow ?? []).map((r) => r.following_id as string));
  if (following.size === 0) return [];
  // Of those, who follow me back (accepted) → mutual = friends.
  const { data: followMe } = await db
    .from('social_follows')
    .select('follower_id')
    .eq('following_id', userId)
    .eq('status', 'accepted')
    .in('follower_id', Array.from(following));
  const mutual = (followMe ?? []).map((r) => r.follower_id as string);
  if (mutual.length === 0) return [];
  // Respect each friend's allow_group_invites toggle.
  const { data: profs } = await db.from('profiles').select('id, allow_group_invites').in('id', mutual);
  return (profs ?? []).filter((p) => p.allow_group_invites !== false).map((p) => p.id as string);
}
