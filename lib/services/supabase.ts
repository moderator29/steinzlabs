import 'server-only';
import { getSupabaseAdmin } from '../supabaseAdmin';

/**
 * Supabase Service — typed query helpers for the Naka Labs database.
 * All writes use the service-role client (admin).
 * All tables are listed in /scripts/schema-complete.sql
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  avatar_url?: string;
  plan: 'free' | 'pro' | 'elite';
  created_at: string;
  wallet_address?: string;
  notifications_enabled: boolean;
  alert_email?: string;
}

export interface WalletProfile {
  id: string;
  user_id: string;
  address: string;
  chain: string;
  label?: string;
  is_primary: boolean;
  created_at: string;
}

export interface SwapLog {
  id: string;
  user_id: string | null;
  chain: string;
  input_token: string;
  output_token: string;
  input_amount: number;
  output_amount: number;
  status: 'pending' | 'completed' | 'failed';
  tx_hash: string | null;
  created_at: string;
}

export interface FeeRevenue {
  id: string;
  user_id: string | null;
  tx_hash: string;
  chain: string;
  fee_usd: number;
  fee_bps: number;
  input_token: string;
  output_token: string;
  input_value_usd: number;
  created_at: string;
}

export interface SniperExecution {
  id: string;
  user_id: string;
  chain: string;
  token_address: string;
  buy_amount_usd: number;
  tx_hash: string | null;
  status: 'queued' | 'executing' | 'completed' | 'failed';
  stop_loss_pct?: number;
  take_profit_pct?: number;
  created_at: string;
}

export interface WhaleWatchlist {
  id: string;
  user_id: string;
  address: string;
  chain: string;
  label?: string;
  alert_threshold_usd: number;
  created_at: string;
}

export interface Broadcast {
  id: string;
  title: string;
  content: string;
  html: string;
  sent_at: string | null;
  recipient_count: number;
  opened_count: number;
  created_by: string;
  created_at: string;
}

// ─── User Queries ─────────────────────────────────────────────────────────────

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data as UserProfile;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Omit<UserProfile, 'id' | 'created_at'>>
): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  return !error;
}

export async function getUserPlan(userId: string): Promise<'free' | 'pro' | 'elite'> {
  const profile = await getUserProfile(userId);
  return profile?.plan ?? 'free';
}

// ─── Wallet Profiles ──────────────────────────────────────────────────────────

export async function getUserWallets(userId: string): Promise<WalletProfile[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('wallet_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false });
  if (error || !data) return [];
  return data as WalletProfile[];
}

export async function addWalletProfile(params: {
  userId: string;
  address: string;
  chain: string;
  label?: string;
  isPrimary?: boolean;
}): Promise<WalletProfile | null> {
  const db = getSupabaseAdmin();

  if (params.isPrimary) {
    // Unset existing primary for this chain
    await db
      .from('wallet_profiles')
      .update({ is_primary: false })
      .eq('user_id', params.userId)
      .eq('chain', params.chain);
  }

  const { data, error } = await db
    .from('wallet_profiles')
    .insert({
      user_id: params.userId,
      address: params.address,
      chain: params.chain,
      label: params.label ?? null,
      is_primary: params.isPrimary ?? false,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) return null;
  return data as WalletProfile;
}

export async function removeWalletProfile(userId: string, walletId: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from('wallet_profiles')
    .delete()
    .eq('id', walletId)
    .eq('user_id', userId);
  return !error;
}

// ─── Swap Logs ────────────────────────────────────────────────────────────────

export async function getSwapHistory(userId: string, limit = 50): Promise<SwapLog[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('swap_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as SwapLog[];
}

export async function updateSwapStatus(
  txHash: string,
  status: SwapLog['status']
): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from('swap_logs')
    .update({ status })
    .eq('tx_hash', txHash);
  return !error;
}

// ─── Sniper Executions ────────────────────────────────────────────────────────

export async function getSniperHistory(userId: string, limit = 100): Promise<SniperExecution[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('sniper_executions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as SniperExecution[];
}

export async function createSniperExecution(params: Omit<SniperExecution, 'id' | 'created_at'>): Promise<SniperExecution | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('sniper_executions')
    .insert({ ...params, created_at: new Date().toISOString() })
    .select()
    .single();
  if (error || !data) return null;
  return data as SniperExecution;
}

export async function updateSniperExecution(
  id: string,
  updates: Partial<Pick<SniperExecution, 'status' | 'tx_hash'>>
): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from('sniper_executions')
    .update(updates)
    .eq('id', id);
  return !error;
}

// ─── Whale Watchlist ──────────────────────────────────────────────────────────

export async function getWhaleWatchlist(userId: string): Promise<WhaleWatchlist[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('whale_watchlist')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as WhaleWatchlist[];
}

export async function addToWatchlist(params: Omit<WhaleWatchlist, 'id' | 'created_at'>): Promise<WhaleWatchlist | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('whale_watchlist')
    .insert({ ...params, created_at: new Date().toISOString() })
    .select()
    .single();
  if (error || !data) return null;
  return data as WhaleWatchlist;
}

export async function removeFromWatchlist(userId: string, watchlistId: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from('whale_watchlist')
    .delete()
    .eq('id', watchlistId)
    .eq('user_id', userId);
  return !error;
}

// ─── Admin: Fee Revenue ───────────────────────────────────────────────────────

export async function getTotalFeeRevenue(since?: Date): Promise<number> {
  const db = getSupabaseAdmin();
  let query = db.from('fee_revenue').select('fee_usd');
  if (since) {
    query = query.gte('created_at', since.toISOString());
  }
  const { data, error } = await query;
  if (error || !data) return 0;
  return (data as { fee_usd: number }[]).reduce((sum, row) => sum + row.fee_usd, 0);
}

// ─── Admin: Broadcasts ────────────────────────────────────────────────────────

export async function getBroadcasts(limit = 20): Promise<Broadcast[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as Broadcast[];
}

export async function createBroadcast(params: Omit<Broadcast, 'id' | 'created_at' | 'sent_at' | 'opened_count'>): Promise<Broadcast | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('broadcasts')
    .insert({ ...params, created_at: new Date().toISOString(), sent_at: null, opened_count: 0 })
    .select()
    .single();
  if (error || !data) return null;
  return data as Broadcast;
}

export async function markBroadcastSent(id: string, recipientCount: number): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from('broadcasts')
    .update({ sent_at: new Date().toISOString(), recipient_count: recipientCount })
    .eq('id', id);
  return !error;
}

// ─── Misc ──────────────────────────────────────────────────────────────────────

/**
 * Check if a user has an active Pro or Elite subscription.
 */
export async function isProUser(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId);
  return plan === 'pro' || plan === 'elite';
}

/**
 * Get all user IDs for bulk email operations (admin only).
 */
export async function getAllUserEmails(): Promise<{ id: string; email: string }[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('profiles')
    .select('id, email')
    .not('email', 'is', null);
  if (error || !data) return [];
  return data as { id: string; email: string }[];
}
