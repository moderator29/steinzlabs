import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import * as Sentry from '@sentry/nextjs';

/**
 * Idempotently grant an achievement to a cult member by its catalog `code`.
 *
 * This is the server-side earning pipeline: call it at the real action site
 * (casting a Conclave vote, breaking a Daily Seal, having a whisper echoed,
 * etc.). It is best-effort and fire-and-forget by design — a failure here must
 * NEVER break the underlying action, so it swallows everything and only pages
 * Sentry on an unexpected error. Granting an achievement the member already has
 * is a silent no-op (the (user_id, achievement_id) primary key makes the insert
 * a 23505 conflict, which we treat as success).
 *
 * granted_by is left null to mark a system-earned grant (vs an admin manual
 * grant, which records the admin's id).
 */
export async function grantAchievement(userId: string | null | undefined, code: string): Promise<void> {
  if (!userId || !code) return;
  try {
    const admin = getSupabaseAdmin();
    const { data: achievement } = await admin
      .from('cult_achievements')
      .select('id')
      .eq('code', code)
      .eq('active', true)
      .maybeSingle<{ id: string }>();
    if (!achievement) return; // unknown or inactive code — nothing to grant

    const { error } = await admin
      .from('cult_member_achievements')
      .insert({ user_id: userId, achievement_id: achievement.id });

    // 23505 = unique violation = already earned → idempotent no-op.
    if (error && (error as { code?: string }).code !== '23505') {
      Sentry.captureException(error, { tags: { source: 'grantAchievement', code } });
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { source: 'grantAchievement', code } });
  }
}
