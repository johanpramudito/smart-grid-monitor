import type { WebSocket as WSType } from 'ws';

// WebSocket manager for real-time telemetry broadcasting
export class WebSocketManager {
  private clients: Map<string, Set<WSType>> = new Map();
  private static instance: WebSocketManager;

  private constructor() {}

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  // Add client subscription for a specific zone
  addClient(zoneId: string, ws: WSType) {
    if (!this.clients.has(zoneId)) {
      this.clients.set(zoneId, new Set());
    }
    this.clients.get(zoneId)!.add(ws);
    console.log(`[WebSocket] Client subscribed to zone ${zoneId}. Total clients: ${this.clients.get(zoneId)!.size}`);
  }

  // Remove client from all subscriptions
  removeClient(ws: WSType) {
    this.clients.forEach((clientSet, zoneId) => {
      if (clientSet.has(ws)) {
        clientSet.delete(ws);
        console.log(`[WebSocket] Client unsubscribed from zone ${zoneId}. Remaining: ${clientSet.size}`);
      }
    });
  }

  // Broadcast telemetry data to all clients subscribed to a zone
  broadcast(
    zoneId: string,
    data: Record<string, unknown> | { type: string; data: unknown; [key: string]: unknown },
  ) {
    const clients = this.clients.get(zoneId);
    if (!clients || clients.size === 0) {
      return; // No clients subscribed to this zone
    }

    const payload = JSON.stringify({
      type: 'telemetry',
      zoneId,
      data,
      timestamp: new Date().toISOString(),
    });

    let sentCount = 0;
    let failedCount = 0;

    clients.forEach((client) => {
      try {
        if (client.readyState === 1) { // 1 = OPEN
          client.send(payload);
          sentCount++;
        } else {
          failedCount++;
          this.removeClient(client);
        }
      } catch (error) {
        failedCount++;
        console.error(`[WebSocket] Error sending to client:`, error);
        this.removeClient(client);
      }
    });

    if (sentCount > 0) {
      console.log(`[WebSocket] Broadcasted to ${sentCount} clients for zone ${zoneId} (${failedCount} failed)`);
    }
  }

  // Get number of connected clients for a zone
  getClientCount(zoneId: string): number {
    return this.clients.get(zoneId)?.size || 0;
  }

  // Get total number of connections across all zones
  getTotalClientCount(): number {
    let total = 0;
    this.clients.forEach((clientSet) => {
      total += clientSet.size;
    });
    return total;
  }
}

// Export singleton instance
export const wsManager = WebSocketManager.getInstance();
