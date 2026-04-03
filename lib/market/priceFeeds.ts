import { PriceUpdate } from '../trading/types';

class PriceFeedManager {
  private ws: WebSocket | null = null;
  private subscribers = new Map<string, Set<(update: PriceUpdate) => void>>();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 5000;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket('wss://io.dexscreener.com/dex/screener/pairs/h24/1');

      this.ws.onopen = () => {
        console.log('Price feed connected');
        this.reconnectDelay = 5000;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          this.handlePriceUpdate(data);
        } catch (error) {
          console.error('Failed to parse price update:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('Price feed error:', error);
      };

      this.ws.onclose = () => {
        console.log('Price feed disconnected, reconnecting...');
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('Failed to connect to price feed:', error);
      this.scheduleReconnect();
    }
  }

  private handlePriceUpdate(data: any) {
    const update: PriceUpdate = {
      token: data.baseToken?.symbol || 'UNKNOWN',
      address: data.baseToken?.address || '',
      chain: data.chainId || 'unknown',
      price: parseFloat(data.priceNative || '0'),
      priceUSD: parseFloat(data.priceUsd || '0'),
      volume24h: parseFloat(data.volume?.h24 || '0'),
      priceChange24h: parseFloat(data.priceChange?.h24 || '0'),
      liquidity: parseFloat(data.liquidity?.usd || '0'),
      timestamp: Date.now(),
    };

    const tokenSubscribers = this.subscribers.get(update.address);
    if (tokenSubscribers) {
      tokenSubscribers.forEach(callback => callback(update));
    }
  }

  subscribe(tokenAddress: string, callback: (update: PriceUpdate) => void) {
    if (!this.subscribers.has(tokenAddress)) {
      this.subscribers.set(tokenAddress, new Set());
    }

    this.subscribers.get(tokenAddress)!.add(callback);

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }

    return () => {
      const subs = this.subscribers.get(tokenAddress);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(tokenAddress);
        }
      }
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      console.log('Attempting to reconnect price feed...');
      this.connect();
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    }, this.reconnectDelay);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.subscribers.clear();
  }
}

export const priceFeedManager = new PriceFeedManager();
