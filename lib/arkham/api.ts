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

  private mapAddressResponse(raw: any): ArkhamAddress {
    const entity = raw.arkhamEntity || null;
    const label = raw.arkhamLabel || null;

    const mappedEntity: ArkhamEntity | null = entity ? {
      id: entity.id || '',
      name: entity.name || '',
      type: entity.type || '',
      verified: true,
      description: entity.note || undefined,
      addresses: entity.addresses || undefined,
      logo: entity.logo || undefined,
      website: entity.website || undefined,
      twitter: entity.twitter || undefined,
      crunchbase: entity.crunchbase || undefined,
      linkedin: entity.linkedin || undefined,
    } : null;

    const labels: string[] = [];
    if (label?.name) labels.push(label.name);
    if (raw.contract) labels.push('contract');

    return {
      address: raw.address || '',
      chain: raw.chain || '',
      arkhamEntity: mappedEntity,
      labels,
      firstSeen: '',
      lastSeen: '',
      transactionCount: 0,
    };
  }

  private mapTransferResponse(raw: any): ArkhamTransaction {
    return {
      hash: raw.transactionHash || '',
      chain: raw.chain || '',
      timestamp: raw.blockTimestamp || '',
      blockNumber: raw.blockNumber || 0,
      from: {
        address: raw.fromAddress?.address || '',
        entity: raw.fromAddress?.arkhamEntity ? {
          id: raw.fromAddress.arkhamEntity.id || '',
          name: raw.fromAddress.arkhamEntity.name || '',
          type: raw.fromAddress.arkhamEntity.type || '',
          verified: true,
        } : undefined,
      },
      to: {
        address: raw.toAddress?.address || '',
        entity: raw.toAddress?.arkhamEntity ? {
          id: raw.toAddress.arkhamEntity.id || '',
          name: raw.toAddress.arkhamEntity.name || '',
          type: raw.toAddress.arkhamEntity.type || '',
          verified: true,
        } : undefined,
      },
      value: String(raw.unitValue || '0'),
      valueUSD: String(raw.historicalUSD || '0'),
      token: raw.tokenAddress ? {
        symbol: raw.tokenSymbol || '',
        address: raw.tokenAddress || '',
        amount: String(raw.unitValue || '0'),
      } : (raw.tokenSymbol ? {
        symbol: raw.tokenSymbol || '',
        address: '',
        amount: String(raw.unitValue || '0'),
      } : undefined),
      gasUsed: '0',
      gasFee: '0',
      type: 'transfer',
    };
  }

  async getAddressIntel(address: string, chain?: string): Promise<ArkhamAddress> {
    const cacheKey = `address:${address}:${chain || 'all'}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const endpoint = chain
      ? `/intelligence/address/${address}?chain=${chain}`
      : `/intelligence/address/${address}`;

    const raw = await this.fetch(endpoint);
    const data = this.mapAddressResponse(raw);
    this.setCache(cacheKey, data);
    return data;
  }

  async getEntity(entityId: string): Promise<ArkhamEntity> {
    const cacheKey = `entity:${entityId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.fetch(`/intelligence/entity/${entityId}`);

      const entity: ArkhamEntity = {
        id: data.id || entityId,
        name: data.name || entityId,
        type: data.type || '',
        verified: true,
        description: data.note || undefined,
        addresses: data.addresses || undefined,
        website: data.website || undefined,
        twitter: data.twitter || undefined,
      };

      this.setCache(cacheKey, entity);
      return entity;
    } catch {
      return {
        id: entityId,
        name: entityId,
        type: '',
        verified: false,
      };
    }
  }

  async getTokenHolders(
    tokenAddress: string,
    limit: number = 20,
    chain?: string
  ): Promise<ArkhamHolder[]> {
    const cacheKey = `holders:${tokenAddress}:${limit}:${chain || 'all'}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const transfers = await this.getAddressTransfers(tokenAddress, limit * 2, chain);

      const holderMap = new Map<string, { address: string; count: number }>();

      for (const tx of transfers) {
        const addr = tx.to.address;
        if (addr && addr !== tokenAddress) {
          const existing = holderMap.get(addr) || { address: addr, count: 0 };
          existing.count++;
          holderMap.set(addr, existing);
        }
      }

      const topAddresses = Array.from(holderMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      const enriched: ArkhamHolder[] = await Promise.all(
        topAddresses.map(async (holder, index) => {
          try {
            const addressIntel = await this.getAddressIntel(holder.address);
            return {
              address: holder.address,
              balance: '0',
              balanceUSD: '0',
              percentage: 0,
              entity: addressIntel.arkhamEntity || undefined,
              labels: addressIntel.labels,
            };
          } catch {
            return {
              address: holder.address,
              balance: '0',
              balanceUSD: '0',
              percentage: 0,
            };
          }
        })
      );

      this.setCache(cacheKey, enriched);
      return enriched;
    } catch (error) {

      return [];
    }
  }

  async getWalletConnections(
    address: string,
    limit: number = 50
  ): Promise<ArkhamConnection[]> {
    const cacheKey = `connections:${address}:${limit}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const transfers = await this.getAddressTransfers(address, limit);

      const connectionMap = new Map<string, ArkhamConnection>();

      for (const tx of transfers) {
        const otherAddress = tx.from.address === address ? tx.to.address : tx.from.address;
        const otherEntity = tx.from.address === address ? tx.to.entity : tx.from.entity;

        if (!connectionMap.has(otherAddress)) {
          connectionMap.set(otherAddress, {
            address: otherAddress,
            entity: otherEntity,
            relationship: 'transfer',
            labels: [],
            totalValue: tx.valueUSD || '0',
            transactionCount: 1,
          });
        } else {
          const conn = connectionMap.get(otherAddress)!;
          conn.transactionCount++;
          conn.totalValue = String(
            parseFloat(conn.totalValue) + parseFloat(tx.valueUSD || '0')
          );
        }
      }

      const connections = Array.from(connectionMap.values());
      this.setCache(cacheKey, connections);
      return connections;
    } catch (error) {

      return [];
    }
  }

  async getByLabel(label: string): Promise<ArkhamAddress[]> {
    const cacheKey = `label:${label}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.fetch(`/intelligence/labels/${label}`);
      const addresses = (data.addresses || []).map((a: any) => this.mapAddressResponse(a));
      this.setCache(cacheKey, addresses);
      return addresses;
    } catch {
      return [];
    }
  }

  async getScammerDatabase(): Promise<ArkhamAddress[]> {
    return this.getByLabel('scammer');
  }

  async getTransaction(txHash: string): Promise<ArkhamTransaction> {
    const cacheKey = `tx:${txHash}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const data = await this.fetch(`/tx/${txHash}`);
    const mapped = this.mapTransferResponse(data);
    this.setCache(cacheKey, mapped);
    return mapped;
  }

  async getAddressTransfers(
    address: string,
    limit: number = 100,
    chain?: string
  ): Promise<ArkhamTransaction[]> {
    const params = new URLSearchParams({
      base: address,
      limit: limit.toString(),
      ...(chain && { chain }),
    });

    const data = await this.fetch(`/transfers?${params.toString()}`);

    const transfers = (data.transfers || []).map((tx: any) =>
      this.mapTransferResponse(tx)
    );

    return transfers;
  }

  async getEntityPortfolio(entityId: string): Promise<EntityPortfolio> {
    const cacheKey = `portfolio:${entityId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const now = Date.now();
      const data = await this.fetch(`/portfolio/entity/${entityId}?time=${now}`);
      this.setCache(cacheKey, data);
      return data;
    } catch {
      return {
        entityId,
        totalValue: '0',
        lastUpdated: new Date().toISOString(),
        holdings: {},
      };
    }
  }

  async getEntityPerformance(entityId: string): Promise<EntityPerformance> {
    const cacheKey = `performance:${entityId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.fetch(`/intelligence/entity/${entityId}/performance`);
      this.setCache(cacheKey, data);
      return data;
    } catch {
      return {
        entityId,
        winRate: 0,
        totalTrades: 0,
        avgHoldTime: 0,
        avgGainOnWinners: 0,
        avgLossOnLosers: 0,
        bestTrade: { token: '', entryDate: '', exitDate: '', holdTime: 0, gain: 0, amountUSD: '0' },
        worstTrade: { token: '', entryDate: '', exitDate: '', holdTime: 0, gain: 0, amountUSD: '0' },
        recentTrades: [],
      };
    }
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
