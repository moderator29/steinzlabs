import { getSupabaseAdmin } from '../supabaseAdmin';

function getAdmin() {
  return getSupabaseAdmin();
}

export async function saveUser(data: {
  walletAddress: string;
  reputationScore?: number;
  reputationStatus?: string;
  isVerifiedEntity?: boolean;
  entityId?: string;
  entityName?: string;
  blocked?: boolean;
}) {
  const supabaseAdmin = getAdmin();
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .upsert(
      {
        wallet_address: data.walletAddress,
        reputation_score: data.reputationScore,
        reputation_status: data.reputationStatus,
        is_verified_entity: data.isVerifiedEntity,
        entity_id: data.entityId,
        entity_name: data.entityName,
        blocked: data.blocked,
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'wallet_address' }
    )
    .select()
    .single();

  if (error) throw error;
  return user;
}

export async function getUserByWallet(walletAddress: string) {
  const supabaseAdmin = getAdmin();
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('wallet_address', walletAddress)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function saveScanResult(data: {
  userId: string;
  tokenAddress: string;
  scanResult: any;
  allowed: boolean;
  blocked: boolean;
  riskScore: number;
  reason?: string;
}) {
  const supabaseAdmin = getAdmin();
  const { data: scan, error } = await supabaseAdmin
    .from('scans')
    .insert({
      user_id: data.userId,
      token_address: data.tokenAddress,
      scan_result: data.scanResult,
      allowed: data.allowed,
      blocked: data.blocked,
      risk_score: data.riskScore,
      reason: data.reason,
    })
    .select()
    .single();

  if (error) throw error;
  return scan;
}

export async function saveThreat(data: {
  userId: string;
  severity: string;
  tokenAddress: string;
  tokenSymbol: string;
  threatType: string;
  threatData: Record<string, unknown>;
  recommendation: string;
}) {
  const supabaseAdmin = getAdmin();
  const { data: threat, error } = await supabaseAdmin
    .from('threats')
    .insert({
      user_id: data.userId,
      severity: data.severity,
      token_address: data.tokenAddress,
      token_symbol: data.tokenSymbol,
      threat_type: data.threatType,
      threat_data: data.threatData,
      recommendation: data.recommendation,
    })
    .select()
    .single();

  if (error) throw error;
  return threat;
}

export async function getUserThreats(userId: string) {
  const supabaseAdmin = getAdmin();
  const { data, error } = await supabaseAdmin
    .from('threats')
    .select('*')
    .eq('user_id', userId)
    .eq('acknowledged', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function savePosition(data: {
  userId: string;
  tokenAddress: string;
  tokenSymbol: string;
  chain: string;
  entryPrice: number;
  amount: number;
  valueUsd?: number;
  autoExitEnabled?: boolean;
  followingEntity?: string;
}) {
  const supabaseAdmin = getAdmin();
  const { data: position, error } = await supabaseAdmin
    .from('positions')
    .insert({
      user_id: data.userId,
      token_address: data.tokenAddress,
      token_symbol: data.tokenSymbol,
      chain: data.chain,
      entry_price: data.entryPrice,
      amount: data.amount,
      value_usd: data.valueUsd,
      auto_exit_enabled: data.autoExitEnabled,
      following_entity: data.followingEntity,
    })
    .select()
    .single();

  if (error) throw error;
  return position;
}

export async function getUserPositions(userId: string) {
  const supabaseAdmin = getAdmin();
  const { data, error } = await supabaseAdmin
    .from('positions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
