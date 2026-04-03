import {
  ArkhamEntity,
  ArkhamAddress,
  ArkhamHolder,
  ArkhamConnection,
  ArkhamTransaction,
  EntityPortfolio,
  EntityPerformance,
} from './types';

class ArkhamAPI {
  private apiKey = process.env.ARKHAM_API_KEY!;
  private baseUrl = 'https://api.arkm.com';
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheDuration = 5 * 60 * 1000;

  private async fetch(endpoint: string, options?: RequestInit) {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'API-Key': this.apiKey,
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Arkham API error (${response.status}): ${error}`);
      }

      return response.json();
    } catch (error) {
      console.error('Arkham API request failed:', error);
      throw error;
    }
  }

  private getCached(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > this.cacheDuration;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async getAddressIntel(address: string, chain?: string): Promise<ArkhamAddress> {
    const cacheKey = `address:${address}:${chain || 'all'}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const endpoint = chain
      ? `/intelligence/address/${address}?chain=${chain}`
      : `/intelligence/address/${address}`;

    const data = await this.fetch(endpoint);
    this.setCache(cacheKey, data);
    return data;
  }

  async getEntity(entityId: string): Promise<ArkhamEntity> {
    const cacheKey = `entity:${entityId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const data = await this.fetch(`/intelligence/entity/${entityId}`);
    this.setCache(cacheKey, data);
    return data;
  }

  async getTokenHolders(
    tokenAddress: string,
    limit: number = 20,
    chain?: string
  ): Promise<ArkhamHolder[]> {
    const cacheKey = `holders:${tokenAddress}:${limit}:${chain || 'all'}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const endpoint = chain
      ? `/token/${tokenAddress}/holders?limit=${limit}&chain=${chain}`
      : `/token/${tokenAddress}/holders?limit=${limit}`;

    const data = await this.fetch(endpoint);

    const enriched = await Promise.all(
      (data.holders || []).map(async (holder: any) => {
        try {
          const addressIntel = await this.getAddressIntel(holder.address);
          return {
            ...holder,
            entity: addressIntel.arkhamEntity,
            labels: addressIntel.labels,
          };
        } catch {
          return holder;
        }
      })
    );

    this.setCache(cacheKey, enriched);
    return enriched;
  }

  async getWalletConnections(
    address: string,
    limit: number = 50
  ): Promise<ArkhamConnection[]> {
    const cacheKey = `connections:${address}:${limit}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const data = await this.fetch(
      `/intelligence/address/${address}/connections?limit=${limit}`
    );

    this.setCache(cacheKey, data.connections || []);
    return data.connections || [];
  }

  async getByLabel(label: string): Promise<ArkhamAddress[]> {
    const cacheKey = `label:${label}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const data = await this.fetch(`/intelligence/labels/${label}`);
    this.setCache(cacheKey, data.addresses || []);
    return data.addresses || [];
  }

  async getScammerDatabase(): Promise<ArkhamAddress[]> {
    return this.getByLabel('scammer');
  }

  async getTransaction(txHash: string): Promise<ArkhamTransaction> {
    const cacheKey = `tx:${txHash}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const data = await this.fetch(`/tx/${txHash}`);
    this.setCache(cacheKey, data);
    return data;
  }

  async getAddressTransfers(
    address: string,
    limit: number = 100,
    chain?: string
  ): Promise<ArkhamTransaction[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(chain && { chain }),
    });

    const data = await this.fetch(
      `/transfers/address/${address}?${params.toString()}`
    );

    return data.transfers || [];
  }

  async getEntityPortfolio(entityId: string): Promise<EntityPortfolio> {
    const cacheKey = `portfolio:${entityId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const data = await this.fetch(`/portfolio/entity/${entityId}`);
    this.setCache(cacheKey, data);
    return data;
  }

  async getEntityPerformance(entityId: string): Promise<EntityPerformance> {
    const cacheKey = `performance:${entityId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const data = await this.fetch(`/intelligence/entity/${entityId}/performance`);
    this.setCache(cacheKey, data);
    return data;
  }

  async isScammer(address: string): Promise<boolean> {
    try {
      const intel = await this.getAddressIntel(address);
      return (
        intel.labels?.includes('scammer') ||
        intel.labels?.includes('rug_puller') ||
        intel.labels?.includes('phishing') ||
        !!intel.scamHistory
      );
    } catch {
      return false;
    }
  }

  async isVerifiedEntity(address: string): Promise<boolean> {
    try {
      const intel = await this.getAddressIntel(address);
      return intel.arkhamEntity?.verified === true;
    } catch {
      return false;
    }
  }

  async getEntityByAddress(address: string): Promise<ArkhamEntity | null> {
    try {
      const intel = await this.getAddressIntel(address);
      return intel.arkhamEntity || null;
    } catch {
      return null;
    }
  }

  async searchEntities(query: string): Promise<ArkhamEntity[]> {
    try {
      const data = await this.fetch(`/intelligence/search?q=${encodeURIComponent(query)}`);
      return data.entities || [];
    } catch {
      return [];
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const arkhamAPI = new ArkhamAPI();
