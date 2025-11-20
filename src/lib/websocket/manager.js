// WebSocket manager for real-time telemetry broadcasting
// Converted to JavaScript for CommonJS compatibility

class WebSocketManager {
  constructor() {
    this.clients = new Map();
    console.log('[WebSocket] 🔧 WebSocketManager instance created');
  }

  static getInstance() {
    // Use global to ensure singleton across Next.js bundles (server.js + API routes)
    if (!global.__wsManagerInstance) {
      global.__wsManagerInstance = new WebSocketManager();
      console.log('[WebSocket] ✨ Created NEW singleton instance (stored in global)');
    } else {
      console.log('[WebSocket] ♻️  Reusing existing singleton instance from global');
    }
    return global.__wsManagerInstance;
  }

  // Add client subscription for a specific zone
  addClient(zoneId, ws) {
    if (!this.clients.has(zoneId)) {
      this.clients.set(zoneId, new Set());
    }
    this.clients.get(zoneId).add(ws);
    console.log(`[WebSocket] Client subscribed to zone ${zoneId}. Total clients: ${this.clients.get(zoneId).size}`);
  }

  // Remove client from all subscriptions
  removeClient(ws) {
    this.clients.forEach((clientSet, zoneId) => {
      if (clientSet.has(ws)) {
        clientSet.delete(ws);
        console.log(`[WebSocket] Client unsubscribed from zone ${zoneId}. Remaining: ${clientSet.size}`);
      }
    });
  }

  // Broadcast telemetry data to all clients subscribed to a zone
  broadcast(zoneId, data) {
    console.log(`[WebSocket] 📢 Attempting broadcast to zone: ${zoneId}`);
    console.log(`[WebSocket] 👥 All zones with clients:`, Array.from(this.clients.keys()));

    const clients = this.clients.get(zoneId);
    if (!clients || clients.size === 0) {
      console.log(`[WebSocket] ⚠️  No clients subscribed to zone ${zoneId} (found ${clients?.size || 0} clients)`);
      return; // No clients subscribed to this zone
    }

    // Check if this is a status-change broadcast (already has type field)
    // If so, send it as-is without wrapping in telemetry envelope
    let payload;
    if (data.type === 'status-change') {
      console.log(`[WebSocket] 🔔 Broadcasting status change directly (no telemetry wrapper)`);
      payload = JSON.stringify(data);
    } else {
      // Regular telemetry data - wrap in envelope
      payload = JSON.stringify({
        type: 'telemetry',
        zoneId,
        data,
        timestamp: new Date().toISOString(),
      });
    }

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
      console.log(`[WebSocket] ✅ Broadcasted to ${sentCount} clients for zone ${zoneId} (${failedCount} failed)`);
    }
  }

  // Get number of connected clients for a zone
  getClientCount(zoneId) {
    return this.clients.get(zoneId)?.size || 0;
  }

  // Get total number of connections across all zones
  getTotalClientCount() {
    let total = 0;
    this.clients.forEach((clientSet) => {
      total += clientSet.size;
    });
    return total;
  }
}

// Export singleton instance
const wsManager = WebSocketManager.getInstance();

module.exports = { wsManager, WebSocketManager };
