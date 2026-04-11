import { getSupabaseAdmin } from '../supabaseAdmin';

export interface LimitOrder {
  id: string;
  userId: string;
  tokenAddress: string;
  tokenSymbol: string;
  chain: string;
  side: 'BUY' | 'SELL';
  targetPrice: number;
  amount: number;
  amountUSD: string;
  status: 'PENDING' | 'FILLED' | 'CANCELLED' | 'EXPIRED';
  createdAt: Date;
  expiresAt: Date;
  filledAt?: Date;
  txHash?: string;
}

export interface StopLossOrder {
  id: string;
  positionId: string;
  userId: string;
  tokenAddress: string;
  stopPrice: number;
  amount: number;
  status: 'ACTIVE' | 'TRIGGERED' | 'CANCELLED';
  createdAt: Date;
}

export interface TakeProfitOrder {
  id: string;
  positionId: string;
  userId: string;
  tokenAddress: string;
  targetPrice: number;
  amount: number;
  status: 'ACTIVE' | 'TRIGGERED' | 'CANCELLED';
  createdAt: Date;
}

export interface DCAConfig {
  id: string;
  userId: string;
  tokenAddress: string;
  tokenSymbol: string;
  chain: string;
  amountPerBuy: number;
  frequency: 'HOURLY' | 'DAILY' | 'WEEKLY';
  totalBudget: number;
  spentSoFar: number;
  active: boolean;
  lastBuyAt?: Date;
  nextBuyAt: Date;
}

export async function createLimitOrder(params: {
  userId: string;
  tokenAddress: string;
  tokenSymbol: string;
  chain: string;
  side: 'BUY' | 'SELL';
  targetPrice: number;
  amount: number;
  amountUSD: string;
  expiresInHours?: number;
}): Promise<LimitOrder> {
  const supabaseAdmin = getSupabaseAdmin();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + (params.expiresInHours || 24));

  const { data, error } = await supabaseAdmin
    .from('limit_orders')
    .insert({
      user_id: params.userId,
      token_address: params.tokenAddress,
      token_symbol: params.tokenSymbol,
      chain: params.chain,
      side: params.side,
      target_price: params.targetPrice,
      amount: params.amount,
      amount_usd: params.amountUSD,
      status: 'PENDING',
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    userId: data.user_id,
    tokenAddress: data.token_address,
    tokenSymbol: data.token_symbol,
    chain: data.chain,
    side: data.side,
    targetPrice: data.target_price,
    amount: data.amount,
    amountUSD: data.amount_usd,
    status: data.status,
    createdAt: new Date(data.created_at),
    expiresAt: new Date(data.expires_at),
  };
}

export async function monitorLimitOrders(): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: orders } = await supabaseAdmin
    .from('limit_orders')
    .select('*')
    .eq('status', 'PENDING')
    .gt('expires_at', new Date().toISOString());

  if (!orders || orders.length === 0) return;

  for (const order of orders) {
    try {
      const currentPrice = await getCurrentPrice(order.token_address, order.chain);

      let shouldExecute = false;
      if (order.side === 'BUY' && currentPrice <= order.target_price) {
        shouldExecute = true;
      } else if (order.side === 'SELL' && currentPrice >= order.target_price) {
        shouldExecute = true;
      }

      if (shouldExecute) {

        await executeLimitOrder(order);
      }
    } catch (error) {

    }
  }

  await expireOldOrders();
}

async function executeLimitOrder(order: any): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  await supabaseAdmin
    .from('limit_orders')
    .update({
      status: 'FILLED',
      filled_at: new Date().toISOString(),
    })
    .eq('id', order.id);
}

async function expireOldOrders(): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  await supabaseAdmin
    .from('limit_orders')
    .update({ status: 'EXPIRED' })
    .eq('status', 'PENDING')
    .lt('expires_at', new Date().toISOString());
}

async function getCurrentPrice(tokenAddress: string, chain: string): Promise<number> {
  return 0;
}

export async function createStopLoss(params: {
  positionId: string;
  userId: string;
  tokenAddress: string;
  stopPrice: number;
  amount: number;
}): Promise<StopLossOrder> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('stop_loss_orders')
    .insert({
      position_id: params.positionId,
      user_id: params.userId,
      token_address: params.tokenAddress,
      stop_price: params.stopPrice,
      amount: params.amount,
      status: 'ACTIVE',
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    positionId: data.position_id,
    userId: data.user_id,
    tokenAddress: data.token_address,
    stopPrice: data.stop_price,
    amount: data.amount,
    status: data.status,
    createdAt: new Date(data.created_at),
  };
}

export async function createTakeProfit(params: {
  positionId: string;
  userId: string;
  tokenAddress: string;
  targetPrice: number;
  amount: number;
}): Promise<TakeProfitOrder> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('take_profit_orders')
    .insert({
      position_id: params.positionId,
      user_id: params.userId,
      token_address: params.tokenAddress,
      target_price: params.targetPrice,
      amount: params.amount,
      status: 'ACTIVE',
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    positionId: data.position_id,
    userId: data.user_id,
    tokenAddress: data.token_address,
    targetPrice: data.target_price,
    amount: data.amount,
    status: data.status,
    createdAt: new Date(data.created_at),
  };
}

export async function createDCABot(params: {
  userId: string;
  tokenAddress: string;
  tokenSymbol: string;
  chain: string;
  amountPerBuy: number;
  frequency: 'HOURLY' | 'DAILY' | 'WEEKLY';
  totalBudget: number;
}): Promise<DCAConfig> {
  const supabaseAdmin = getSupabaseAdmin();
  const nextBuyAt = calculateNextBuyTime(params.frequency);

  const { data, error } = await supabaseAdmin
    .from('dca_configs')
    .insert({
      user_id: params.userId,
      token_address: params.tokenAddress,
      token_symbol: params.tokenSymbol,
      chain: params.chain,
      amount_per_buy: params.amountPerBuy,
      frequency: params.frequency,
      total_budget: params.totalBudget,
      spent_so_far: 0,
      active: true,
      next_buy_at: nextBuyAt.toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    userId: data.user_id,
    tokenAddress: data.token_address,
    tokenSymbol: data.token_symbol,
    chain: data.chain,
    amountPerBuy: data.amount_per_buy,
    frequency: data.frequency,
    totalBudget: data.total_budget,
    spentSoFar: data.spent_so_far,
    active: data.active,
    nextBuyAt: new Date(data.next_buy_at),
  };
}

export async function cancelOrder(
  orderId: string,
  orderType: 'limit' | 'stop_loss' | 'take_profit' | 'dca'
): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  const tableMap = {
    limit: 'limit_orders',
    stop_loss: 'stop_loss_orders',
    take_profit: 'take_profit_orders',
    dca: 'dca_configs',
  };

  const table = tableMap[orderType];
  const cancelField = orderType === 'dca' ? { active: false } : { status: 'CANCELLED' };

  await supabaseAdmin
    .from(table)
    .update(cancelField)
    .eq('id', orderId);
}

export async function getUserOrders(userId: string): Promise<{
  limitOrders: LimitOrder[];
  stopLossOrders: StopLossOrder[];
  takeProfitOrders: TakeProfitOrder[];
  dcaConfigs: DCAConfig[];
}> {
  const supabaseAdmin = getSupabaseAdmin();

  const [limitRes, stopRes, tpRes, dcaRes] = await Promise.all([
    supabaseAdmin
      .from('limit_orders')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['PENDING'])
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('stop_loss_orders')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('take_profit_orders')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('dca_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at', { ascending: false }),
  ]);

  return {
    limitOrders: (limitRes.data || []).map(mapLimitOrder),
    stopLossOrders: (stopRes.data || []).map(mapStopLoss),
    takeProfitOrders: (tpRes.data || []).map(mapTakeProfit),
    dcaConfigs: (dcaRes.data || []).map(mapDCA),
  };
}

function mapLimitOrder(d: any): LimitOrder {
  return {
    id: d.id,
    userId: d.user_id,
    tokenAddress: d.token_address,
    tokenSymbol: d.token_symbol,
    chain: d.chain,
    side: d.side,
    targetPrice: d.target_price,
    amount: d.amount,
    amountUSD: d.amount_usd,
    status: d.status,
    createdAt: new Date(d.created_at),
    expiresAt: new Date(d.expires_at),
    filledAt: d.filled_at ? new Date(d.filled_at) : undefined,
    txHash: d.tx_hash,
  };
}

function mapStopLoss(d: any): StopLossOrder {
  return {
    id: d.id,
    positionId: d.position_id,
    userId: d.user_id,
    tokenAddress: d.token_address,
    stopPrice: d.stop_price,
    amount: d.amount,
    status: d.status,
    createdAt: new Date(d.created_at),
  };
}

function mapTakeProfit(d: any): TakeProfitOrder {
  return {
    id: d.id,
    positionId: d.position_id,
    userId: d.user_id,
    tokenAddress: d.token_address,
    targetPrice: d.target_price,
    amount: d.amount,
    status: d.status,
    createdAt: new Date(d.created_at),
  };
}

function mapDCA(d: any): DCAConfig {
  return {
    id: d.id,
    userId: d.user_id,
    tokenAddress: d.token_address,
    tokenSymbol: d.token_symbol,
    chain: d.chain,
    amountPerBuy: d.amount_per_buy,
    frequency: d.frequency,
    totalBudget: d.total_budget,
    spentSoFar: d.spent_so_far,
    active: d.active,
    lastBuyAt: d.last_buy_at ? new Date(d.last_buy_at) : undefined,
    nextBuyAt: new Date(d.next_buy_at),
  };
}

function calculateNextBuyTime(frequency: 'HOURLY' | 'DAILY' | 'WEEKLY'): Date {
  const now = new Date();
  switch (frequency) {
    case 'HOURLY':
      now.setHours(now.getHours() + 1);
      break;
    case 'DAILY':
      now.setDate(now.getDate() + 1);
      break;
    case 'WEEKLY':
      now.setDate(now.getDate() + 7);
      break;
  }
  return now;
}
