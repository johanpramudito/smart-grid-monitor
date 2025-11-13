/**
 * MQTT Telemetry Listener
 *
 * Background service that subscribes to MQTT telemetry topics and ingests
 * data directly into the database, eliminating the need for a Python gateway.
 *
 * ONLY works with Node.js runtime (Azure App Service, not Vercel serverless)
 */

import mqtt, { MqttClient } from 'mqtt';
import { findDeviceByApiKey } from '../device/registry';
import { ingestTelemetry } from '../device/telemetry';
import type { ZoneStatus } from '../flisr/types';

let mqttListener: MqttClient | null = null;
let isListening = false;

/**
 * MQTT Configuration from environment variables
 */
const MQTT_CONFIG = {
  brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  username: process.env.MQTT_USERNAME || '',
  password: process.env.MQTT_PASSWORD || '',
  clientId: process.env.MQTT_CLIENT_ID || `smart-grid-listener-${Math.random().toString(16).substr(2, 8)}`,
};

/**
 * Map device keys (from MQTT topics) to API keys (for device lookup)
 * This mapping must match your ESP32 device keys
 */
const DEVICE_KEY_TO_API_KEY: Record<string, string> = {
  'ac1b15fc': process.env.DEVICE_AC1B15FC_API_KEY || '',
  '70f460bd': process.env.DEVICE_70F460BD_API_KEY || '',
  'df8f6261': process.env.DEVICE_DF8F6261_API_KEY || '',
  '68a3fd30': process.env.DEVICE_68A3FD30_API_KEY || '',
};

interface TelemetryPayload {
  voltage?: number;
  current?: number;
  power?: number;
  pf?: number;
  energy?: number;
  frequency?: number;
  status?: ZoneStatus;
  relays?: Array<{
    relay: number;
    state: 'OPEN' | 'CLOSED' | 'ON' | 'OFF';
    override?: boolean;
  }>;
  timestamp?: string;
}

/**
 * Process incoming telemetry message
 */
async function processTelemetry(deviceKey: string, payload: TelemetryPayload): Promise<void> {
  try {
    // Get API key for this device
    const apiKey = DEVICE_KEY_TO_API_KEY[deviceKey];
    if (!apiKey) {
      console.warn(`[MQTT] No API key mapped for device '${deviceKey}'`);
      return;
    }

    // Look up device in database
    const device = await findDeviceByApiKey(apiKey);
    if (!device) {
      console.error(`[MQTT] Invalid API key for device '${deviceKey}'`);
      return;
    }

    // Ingest telemetry
    const timestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();
    await ingestTelemetry(device, {
      ...payload,
      timestamp,
    });

    console.log(`[MQTT] ✓ Telemetry ingested for ${deviceKey} (${device.zone_agent_id})`);
  } catch (error) {
    console.error(`[MQTT] Failed to process telemetry for ${deviceKey}:`, error);
  }
}

/**
 * Start the MQTT telemetry listener
 * This should be called once when the Next.js server starts
 */
export function startMqttTelemetryListener(): void {
  if (isListening) {
    console.log('[MQTT] Listener already running');
    return;
  }

  // Check if we're in a Node.js environment (not Edge runtime)
  if (typeof window !== 'undefined') {
    console.error('[MQTT] Cannot start listener in browser environment');
    return;
  }

  console.log('[MQTT] Starting telemetry listener...');
  console.log(`[MQTT] Broker: ${MQTT_CONFIG.brokerUrl}`);

  // Parse broker URL to determine if TLS is enabled
  const isTLS = MQTT_CONFIG.brokerUrl.startsWith('mqtts://') ||
                MQTT_CONFIG.brokerUrl.startsWith('wss://');

  const connectionOptions: mqtt.IClientOptions = {
    clientId: MQTT_CONFIG.clientId,
    username: MQTT_CONFIG.username,
    password: MQTT_CONFIG.password,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 30 * 1000,
  };

  if (isTLS) {
    connectionOptions.rejectUnauthorized = false;
    console.log('[MQTT] Using TLS/SSL connection');
  }

  mqttListener = mqtt.connect(MQTT_CONFIG.brokerUrl, connectionOptions);

  mqttListener.on('connect', () => {
    console.log('[MQTT] ✓ Connected to broker');

    // Subscribe to all device telemetry topics
    mqttListener!.subscribe('/device/+/telemetry', (err) => {
      if (err) {
        console.error('[MQTT] Subscription error:', err);
      } else {
        console.log('[MQTT] ✓ Subscribed to /device/+/telemetry');
        isListening = true;
      }
    });
  });

  mqttListener.on('message', async (topic, message) => {
    try {
      // Parse topic: /device/{deviceKey}/telemetry
      const parts = topic.split('/');
      if (parts.length !== 4 || parts[1] !== 'device' || parts[3] !== 'telemetry') {
        return; // Ignore non-telemetry topics
      }

      const deviceKey = parts[2];
      const payload: TelemetryPayload = JSON.parse(message.toString());

      // Process telemetry asynchronously (don't block MQTT loop)
      processTelemetry(deviceKey, payload).catch((err) => {
        console.error(`[MQTT] Error processing telemetry:`, err);
      });
    } catch (error) {
      console.error('[MQTT] Failed to parse message:', error);
    }
  });

  mqttListener.on('error', (error) => {
    console.error('[MQTT] Connection error:', error);
  });

  mqttListener.on('offline', () => {
    console.warn('[MQTT] Client is offline');
    isListening = false;
  });

  mqttListener.on('reconnect', () => {
    console.log('[MQTT] Attempting to reconnect...');
  });

  mqttListener.on('close', () => {
    console.log('[MQTT] Connection closed');
    isListening = false;
  });
}

/**
 * Stop the MQTT telemetry listener
 * Call this on server shutdown
 */
export function stopMqttTelemetryListener(): void {
  if (mqttListener) {
    console.log('[MQTT] Stopping telemetry listener...');
    mqttListener.end(true);
    mqttListener = null;
    isListening = false;
  }
}

/**
 * Check if the listener is active
 */
export function isMqttListenerActive(): boolean {
  return isListening;
}

/**
 * Get detailed MQTT listener status for diagnostics
 */
export function getMqttListenerStatus() {
  return {
    isListening,
    hasClient: mqttListener !== null,
    isConnected: mqttListener?.connected || false,
    brokerUrl: MQTT_CONFIG.brokerUrl,
    clientId: MQTT_CONFIG.clientId,
  };
}
