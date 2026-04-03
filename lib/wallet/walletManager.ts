import { getSupabaseAdmin } from '../supabaseAdmin';

export interface WalletAccount {
  id: string;
  userId: string;
  address: string;
  chain: string;
  label: string;
  isImported: boolean;
  createdAt: Date;
}

export interface TransactionHistory {
  hash: string;
  chain: string;
  from: string;
  to: string;
  value: string;
  valueUSD: string;
  token?: {
    symbol: string;
    address: string;
    amount: string;
  };
  type: 'SEND' | 'RECEIVE' | 'SWAP' | 'APPROVE';
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  timestamp: Date;
  gasUsed: string;
  gasFee: string;
}

export interface TokenApproval {
  id: string;
  userWallet: string;
  tokenAddress: string;
  tokenSymbol: string;
  spender: string;
  spenderName: string;
  chain: string;
  allowance: string;
  lastUsed: Date;
  risky: boolean;
}

export interface Contact {
  id: string;
  userId: string;
  address: string;
  label: string;
  chain: string;
  createdAt: Date;
}

export async function addWalletAccount(params: {
  userId: string;
  address: string;
  chain: string;
  label: string;
  isImported: boolean;
}): Promise<WalletAccount> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('wallet_accounts')
    .insert({
      user_id: params.userId,
      address: params.address,
      chain: params.chain,
      label: params.label,
      is_imported: params.isImported,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    userId: data.user_id,
    address: data.address,
    chain: data.chain,
    label: data.label,
    isImported: data.is_imported,
    createdAt: new Date(data.created_at),
  };
}

export async function getUserWalletAccounts(userId: string): Promise<WalletAccount[]> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('wallet_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(mapWalletAccount);
}

export async function removeWalletAccount(accountId: string, userId: string): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  await supabaseAdmin
    .from('wallet_accounts')
    .delete()
    .eq('id', accountId)
    .eq('user_id', userId);
}

export async function getTransactionHistory(
  walletAddress: string,
  chain: string,
  limit: number = 50
): Promise<TransactionHistory[]> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from('transaction_history')
    .select('*')
    .eq('wallet_address', walletAddress)
    .eq('chain', chain)
    .order('timestamp', { ascending: false })
    .limit(limit);

  return (data || []).map(mapTransactionFromDB);
}

export async function getTokenApprovals(
  walletAddress: string,
  chain: string
): Promise<TokenApproval[]> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from('token_approvals')
    .select('*')
    .eq('user_wallet', walletAddress)
    .eq('chain', chain);

  return (data || []).map(mapApprovalFromDB);
}

export async function revokeApproval(
  approvalId: string,
  userWallet: string
): Promise<{ txHash: string }> {
  const supabaseAdmin = getSupabaseAdmin();
  const approval = await supabaseAdmin
    .from('token_approvals')
    .select('*')
    .eq('id', approvalId)
    .single();

  if (!approval.data) throw new Error('Approval not found');

  return {
    txHash: 'pending_signature',
  };
}

export async function addContact(params: {
  userId: string;
  address: string;
  label: string;
  chain: string;
}): Promise<Contact> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .insert({
      user_id: params.userId,
      address: params.address,
      label: params.label,
      chain: params.chain,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    userId: data.user_id,
    address: data.address,
    label: data.label,
    chain: data.chain,
    createdAt: new Date(data.created_at),
  };
}

export async function getUserContacts(userId: string): Promise<Contact[]> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(mapContactFromDB);
}

export async function removeContact(contactId: string, userId: string): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  await supabaseAdmin
    .from('contacts')
    .delete()
    .eq('id', contactId)
    .eq('user_id', userId);
}

function mapWalletAccount(d: any): WalletAccount {
  return {
    id: d.id,
    userId: d.user_id,
    address: d.address,
    chain: d.chain,
    label: d.label,
    isImported: d.is_imported,
    createdAt: new Date(d.created_at),
  };
}

function mapTransactionFromDB(tx: any): TransactionHistory {
  return {
    hash: tx.hash,
    chain: tx.chain,
    from: tx.from_address,
    to: tx.to_address,
    value: tx.value,
    valueUSD: tx.value_usd,
    token: tx.token_data,
    type: tx.type,
    status: tx.status,
    timestamp: new Date(tx.timestamp),
    gasUsed: tx.gas_used,
    gasFee: tx.gas_fee,
  };
}

function mapApprovalFromDB(approval: any): TokenApproval {
  return {
    id: approval.id,
    userWallet: approval.user_wallet,
    tokenAddress: approval.token_address,
    tokenSymbol: approval.token_symbol,
    spender: approval.spender,
    spenderName: approval.spender_name,
    chain: approval.chain,
    allowance: approval.allowance,
    lastUsed: new Date(approval.last_used),
    risky: approval.risky,
  };
}

function mapContactFromDB(c: any): Contact {
  return {
    id: c.id,
    userId: c.user_id,
    address: c.address,
    label: c.label,
    chain: c.chain,
    createdAt: new Date(c.created_at),
  };
}
