import { moneyRadarMonitor } from '../moneyRadar/monitor';
import { monitorLimitOrders } from '../trading/advancedOrders';
import { createHolderSnapshot } from '../intelligence/historicalTracking';
import { arkhamAPI } from '../arkham/api';
import { getSupabaseAdmin } from '../supabaseAdmin';

class BackgroundJobManager {
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  startAll() {
    console.log('Starting all background jobs...');

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
    console.log('Stopping all background jobs...');
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
      console.log(`Stopped job: ${name}`);
    }
    this.intervals.clear();
  }

  private startJob(name: string, handler: () => Promise<void>, intervalMs: number) {
    handler().catch(err => console.error(`Job ${name} failed:`, err));

    const interval = setInterval(async () => {
      try {
        await handler();
      } catch (error) {
        console.error(`Job ${name} failed:`, error);
      }
    }, intervalMs);

    this.intervals.set(name, interval);
    console.log(`Started job: ${name} (interval: ${intervalMs}ms)`);
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
        console.error(`Failed to snapshot ${token.address}:`, error);
      }
    }
  }

  private async updateEntityCache() {
    const supabaseAdmin = getSupabaseAdmin();
    const entities = ['jump-trading', 'wintermute', 'a16z-crypto'];

    for (const entityId of entities) {
      try {
        const entity = await arkhamAPI.getEntity(entityId);
        const performance = await arkhamAPI.getEntityPerformance(entityId);
        const portfolio = await arkhamAPI.getEntityPortfolio(entityId);

        await supabaseAdmin.from('entity_cache').upsert({
          entity_id: entityId,
          entity_data: entity,
          performance_data: performance,
          portfolio_data: portfolio,
          updated_at: new Date().toISOString(),
        });

        console.log(`Updated cache for ${entity.name}`);
      } catch (error) {
        console.error(`Failed to update ${entityId}:`, error);
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

    console.log('Cleaned up expired data');
  }
}

export const backgroundJobs = new BackgroundJobManager();

if (process.env.NODE_ENV === 'production') {
  backgroundJobs.startAll();
}
