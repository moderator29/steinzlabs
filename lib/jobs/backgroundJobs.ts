import { moneyRadarMonitor } from '../moneyRadar/monitor';
import { monitorLimitOrders } from '../trading/advancedOrders';
import { createHolderSnapshot } from '../intelligence/historicalTracking';
import { getEntity, getEntityPerformance, getEntityPortfolio } from '../services/arkham';
import { getSupabaseAdmin } from '../supabaseAdmin';

class BackgroundJobManager {
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  startAll() {


    this.startJob('moneyRadar', async () => {
      await moneyRadarMonitor.startMonitoring();
    }, 60 * 1000);

    this.startJob('limitOrders', async () => {
      await monitorLimitOrders();
    }, 30 * 1000);

    this.startJob('snapshots', async () => {
      await this.snapshotPopularTokens();
    }, 60 * 60 * 1000);

    this.startJob('entityCache', async () => {
      await this.updateEntityCache();
    }, 6 * 60 * 60 * 1000);

    this.startJob('cleanup', async () => {
      await this.cleanupExpiredData();
    }, 24 * 60 * 60 * 1000);
  }

  stopAll() {

    for (const [name, interval] of this.intervals) {
      clearInterval(interval);

    }
    this.intervals.clear();
  }

  private startJob(name: string, handler: () => Promise<void>, intervalMs: number) {
    handler().catch(() => {});

    const interval = setInterval(async () => {
      try {
        await handler();
      } catch {
        // job error silenced in production
      }
    }, intervalMs);

    this.intervals.set(name, interval);
  }

  private async snapshotPopularTokens() {
    const popularTokens = [
      { address: '0x...', chain: 'ethereum', price: 0, volume: 0, liquidity: 0 },
    ];

    for (const token of popularTokens) {
      try {
        await createHolderSnapshot(
          token.address,
          token.chain,
          token.price,
          token.volume,
          token.liquidity
        );
      } catch (error) {

      }
    }
  }

  private async updateEntityCache() {
    const supabaseAdmin = getSupabaseAdmin();
    const entities = ['jump-trading', 'wintermute', 'a16z-crypto'];

    for (const entityId of entities) {
      try {
        const entity = await getEntity(entityId);
        const performance = await getEntityPerformance(entityId);
        const portfolio = await getEntityPortfolio(entityId);

        await supabaseAdmin.from('entity_cache').upsert({
          entity_id: entityId,
          entity_data: entity,
          performance_data: performance,
          portfolio_data: portfolio,
          updated_at: new Date().toISOString(),
        });


      } catch (error) {

      }
    }
  }

  private async cleanupExpiredData() {
    const supabaseAdmin = getSupabaseAdmin();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await supabaseAdmin
      .from('scans')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString());

    await supabaseAdmin
      .from('holder_snapshots')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString());


  }
}

export const backgroundJobs = new BackgroundJobManager();

if (process.env.NODE_ENV === 'production') {
  backgroundJobs.startAll();
}
