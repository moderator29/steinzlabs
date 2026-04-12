import { WebSocketServer, WebSocket } from 'ws';
import { priceFeedManager } from '../market/priceFeeds';

class RealtimeServer {
  private wss: WebSocketServer | null = null;
  private clients = new Map<string, WebSocket>();

  // =====================================================================
  // Start WebSocket server
  // =====================================================================
  start(port: number = 8080) {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws: WebSocket, req: any) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);

      console.log(`✅ Client connected: ${clientId} (Total: ${this.clients.size})`);

      ws.on('message', (message: string) => {
        this.handleMessage(clientId, message);
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`❌ Client disconnected: ${clientId}`);
      });

      // Send welcome message
      this.send(clientId, {
        type: 'CONNECTED',
        clientId,
        message: 'Welcome to STEINZ Labs realtime server',
      });
    });

    console.log(`🌐 WebSocket server started on port ${port}`);
  }

  // =====================================================================
  // Handle incoming messages
  // =====================================================================
  private handleMessage(clientId: string, message: string) {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'SUBSCRIBE_PRICE':
          this.subscribeToPriceUpdates(clientId, data.tokenAddress);
          break;

        case 'UNSUBSCRIBE_PRICE':
          // Unsubscribe logic
          break;

        case 'SUBSCRIBE_ENTITY':
          // Subscribe to entity activity
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  // =====================================================================
  // Subscribe client to price updates
  // =====================================================================
  private subscribeToPriceUpdates(clientId: string, tokenAddress: string) {
    priceFeedManager.subscribe(tokenAddress, (update) => {
      this.send(clientId, {
        type: 'PRICE_UPDATE',
        tokenAddress,
        data: update,
      });
    });
  }

  // =====================================================================
  // Send message to specific client
  // =====================================================================
  private send(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  }

  // =====================================================================
  // Broadcast to all clients
  // =====================================================================
  broadcast(data: any) {
    const message = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // =====================================================================
  // Generate unique client ID
  // =====================================================================
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const realtimeServer = new RealtimeServer();

// Start server in production
if (process.env.NODE_ENV === 'production') {
  realtimeServer.start(Number(process.env.WS_PORT) || 8080);
}
