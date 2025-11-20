import mqtt from 'mqtt';
import { findDeviceByZoneId } from '../device/registry';
import { ingestTelemetry } from '../device/telemetry';
import { wsManager } from '../websocket/manager';

interface TelemetryMessage {
  voltage?: number;
  current?: number;
  power?: number;
  pf?: number;
  energy?: number;
  frequency?: number;
  status?: 'NORMAL' | 'FAULT' | 'TRIPPED' | 'ISOLATED' | 'LOCKOUT' | 'OFFLINE' | 'OPEN' | 'BACKUP' | 'PARALLEL';
  relays?: Array<{
    relay: number;
    state: 'OPEN' | 'CLOSED' | 'ON' | 'OFF';
    override?: boolean;
  }>;
  timestamp?: string;
}

export class MQTTSubscriber {
  private client: mqtt.MqttClient | null = null;
  private messageCount = 0;

  constructor(
    private brokerUrl: string,
    private username?: string,
    private password?: string
  ) {}

  connect() {
    const options: mqtt.IClientOptions = {
      clientId: `smart-grid-server-${Math.random().toString(16).substr(2, 8)}`,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 30 * 1000,
      rejectUnauthorized: false, // For self-signed certificates
    };

    if (this.username && this.password) {
      options.username = this.username;
      options.password = this.password;
    }

    console.log(`[MQTT] Connecting to ${this.brokerUrl}...`);
    this.client = mqtt.connect(this.brokerUrl, options);

    this.client.on('connect', () => {
      console.log('[MQTT] ✅ Connected to broker');

      // Subscribe to all device telemetry topics
      this.client!.subscribe('/device/+/telemetry', { qos: 0 }, (err) => {
        if (err) {
          console.error('[MQTT] Subscription error:', err);
        } else {
          console.log('[MQTT] 📡 Subscribed to /device/+/telemetry');
        }
      });

      // Subscribe to control acknowledgments (optional)
      this.client!.subscribe('/device/+/control/ack', { qos: 0 }, (err) => {
        if (!err) {
          console.log('[MQTT] 📡 Subscribed to /device/+/control/ack');
        }
      });
    });

    this.client.on('message', async (topic, payload) => {
      try {
        await this.handleMessage(topic, payload.toString());
      } catch (error) {
        console.error('[MQTT] Error handling message:', error);
      }
    });

    this.client.on('error', (error) => {
      console.error('[MQTT] Error:', error);
    });

    this.client.on('offline', () => {
      console.warn('[MQTT] ⚠️  Client offline');
    });

    this.client.on('reconnect', () => {
      console.log('[MQTT] 🔄 Reconnecting...');
    });

    this.client.on('close', () => {
      console.log('[MQTT] ❌ Connection closed');
    });
  }

  private async handleMessage(topic: string, payload: string) {
    this.messageCount++;

    // Parse topic to get device ID
    // Expected: /device/<deviceId>/telemetry
    const match = topic.match(/^\/device\/([^/]+)\/telemetry$/);
    if (!match) {
      console.warn(`[MQTT] Invalid topic format: ${topic}`);
      return;
    }

    const zoneId = match[1];

    try {
      // Parse payload
      const data: TelemetryMessage = JSON.parse(payload);

      console.log(`[MQTT] Received telemetry from zone ${zoneId}:`, {
        voltage: data.voltage,
        current: data.current,
        power: data.power,
        status: data.status,
      });

      // Find device by zone ID
      const device = await findDeviceByZoneId(zoneId);
      if (!device) {
        console.warn(`[MQTT] No device found for zone ${zoneId}`);
        return;
      }

      // Parse timestamp
      const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();

      // Ingest telemetry to database
      await ingestTelemetry(device, {
        voltage: data.voltage,
        current: data.current,
        power: data.power,
        pf: data.pf,
        energy: data.energy,
        frequency: data.frequency,
        status: data.status,
        relays: data.relays,
        timestamp,
      });

      // Broadcast to WebSocket clients immediately
      wsManager.broadcast(zoneId, {
        voltage: data.voltage,
        current: data.current,
        power: data.power,
        power_factor: data.pf,
        energy: data.energy,
        frequency: data.frequency,
        status: data.status,
        timestamp: timestamp.toISOString(),
      });

      // Periodic stats logging
      if (this.messageCount % 100 === 0) {
        console.log(`[MQTT] 📊 Processed ${this.messageCount} messages`);
      }
    } catch (error) {
      console.error(`[MQTT] Error processing message from ${topic}:`, error);
      console.error(`[MQTT] Payload was: ${payload}`);
    }
  }

  disconnect() {
    if (this.client) {
      console.log('[MQTT] Disconnecting...');
      this.client.end(false, {}, () => {
        console.log('[MQTT] Disconnected');
      });
      this.client = null;
    }
  }

  isConnected(): boolean {
    return this.client?.connected ?? false;
  }
}

// Export singleton instance
let mqttSubscriber: MQTTSubscriber | null = null;

export function initMQTTSubscriber(brokerUrl: string, username?: string, password?: string): MQTTSubscriber {
  if (!mqttSubscriber) {
    mqttSubscriber = new MQTTSubscriber(brokerUrl, username, password);
    mqttSubscriber.connect();
  }
  return mqttSubscriber;
}

export function getMQTTSubscriber(): MQTTSubscriber | null {
  return mqttSubscriber;
}
