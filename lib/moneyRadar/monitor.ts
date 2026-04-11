import { arkhamAPI } from '../arkham/api';
import { getSupabaseAdmin } from '../supabaseAdmin';
import { EntityTrade } from './types';

class MoneyRadarMonitor {
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;
  private checkIntervalMs = 60000;

  async startMonitoring() {
    if (this.monitoringInterval) {

      return;
    }



    this.monitoringInterval = setInterval(async () => {
      await this.checkAllEntities();
    }, this.checkIntervalMs);

    await this.checkAllEntities();
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;

    }
  }

  private async checkAllEntities() {
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: followedEntities, error } = await supabaseAdmin
        .from('followed_entities')
        .select('*');

      if (error) throw error;

      if (!followedEntities || followedEntities.length === 0) {
        return;
      }



      for (const followed of followedEntities) {
        await this.checkEntityActivity(followed);
      }
    } catch (error) {

    }
  }

  private async checkEntityActivity(followed: any) {
    try {
      for (const wallet of (followed.wallets || [])) {
        const transfers = await arkhamAPI.getAddressTransfers(wallet, 10);

        const recentTrades = transfers.filter(tx => {
          const txTime = new Date(tx.timestamp).getTime();
          const now = Date.now();
          return now - txTime < 5 * 60 * 1000;
        });

        for (const tx of recentTrades) {
          await this.processEntityTrade(followed, wallet, tx);
        }
      }
    } catch (error) {

    }
  }

  private async processEntityTrade(followed: any, wallet: string, tx: any) {
    try {
      const isBuy = tx.to.address.toLowerCase() === wallet.toLowerCase();
      const action = isBuy ? 'BUY' : 'SELL';

      const entityTrade: EntityTrade = {
        entityId: followed.entity_id,
        entityName: followed.entity_name,
        walletAddress: wallet,
        token: tx.token?.symbol || 'UNKNOWN',
        tokenAddress: tx.token?.address || '',
        chain: tx.chain,
        action,
        amount: tx.token?.amount || '0',
        amountUSD: tx.valueUSD,
        price: tx.valueUSD,
        timestamp: new Date(tx.timestamp),
        txHash: tx.hash,
      };



      await this.alertFollowers(followed.user_id, entityTrade);

      if (action === 'SELL') {
        await this.triggerAutoExits(entityTrade);
      }

    } catch (error) {

    }
  }

  private async alertFollowers(userId: string, trade: EntityTrade) {


    const supabaseAdmin = getSupabaseAdmin();
    await supabaseAdmin.from('alerts').insert({
      user_id: userId,
      alert_type: 'ENTITY_MOVEMENT',
      entity_id: trade.entityId,
      token_address: trade.tokenAddress,
      condition_type: 'ENTITY_TRADE',
      condition_value: {
        entityId: trade.entityId,
        entityName: trade.entityName,
        action: trade.action,
        token: trade.token,
        amount: trade.amount,
        amountUSD: trade.amountUSD,
      },
      triggered: true,
      triggered_at: new Date().toISOString(),
    });
  }

  private async triggerAutoExits(trade: EntityTrade) {
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: positions, error } = await supabaseAdmin
        .from('positions')
        .select('*')
        .eq('token_address', trade.tokenAddress)
        .eq('following_entity', trade.entityId)
        .eq('auto_exit_enabled', true)
        .eq('status', 'ACTIVE');

      if (error) throw error;

      if (!positions || positions.length === 0) {
        return;
      }



      for (const position of positions) {


        await supabaseAdmin
          .from('positions')
          .update({
            status: 'EXITED',
          })
          .eq('id', position.id);
      }
    } catch (error) {

    }
  }
}

export const moneyRadarMonitor = new MoneyRadarMonitor();
