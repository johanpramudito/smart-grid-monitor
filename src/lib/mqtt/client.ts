/**
 * MQTT Client Service
 *
 * Provides a singleton MQTT client for publishing relay control commands
 * to IoT devices (STM32 + ESP-01) in the smart grid system.
 */

import mqtt, { MqttClient } from 'mqtt';

let mqttClient: MqttClient | null = null;

/**
 * MQTT Configuration from environment variables
 */
const MQTT_CONFIG = {
  brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  username: process.env.MQTT_USERNAME || '',
  password: process.env.MQTT_PASSWORD || '',
  clientId: process.env.MQTT_CLIENT_ID || `smart-grid-server-${Math.random().toString(16).substr(2, 8)}`,
};

/**
 * Get or create the MQTT client singleton
 */
export function getMqttClient(): MqttClient {
  if (!mqttClient) {
    mqttClient = mqtt.connect(MQTT_CONFIG.brokerUrl, {
      clientId: MQTT_CONFIG.clientId,
      username: MQTT_CONFIG.username,
      password: MQTT_CONFIG.password,
      clean: true,
      reconnectPeriod: 5000, // Reconnect every 5 seconds if disconnected
      connectTimeout: 30 * 1000, // 30 seconds
    });

    mqttClient.on('connect', () => {
      console.log('[MQTT] Connected to broker:', MQTT_CONFIG.brokerUrl);
    });

    mqttClient.on('error', (error) => {
      console.error('[MQTT] Connection error:', error);
    });

    mqttClient.on('offline', () => {
      console.warn('[MQTT] Client is offline');
    });

    mqttClient.on('reconnect', () => {
      console.log('[MQTT] Attempting to reconnect...');
    });
  }

  return mqttClient;
}

/**
 * Relay command types
 */
export type RelayCommand = 'CLOSED' | 'OPEN' | 'ON' | 'OFF';

/**
 * MQTT topic structure for relay control
 * Format: /device/{deviceKeyId}/control
 * This matches the ESP32 subscription pattern: /device/+/control
 */
export interface RelayCommandPayload {
  zoneId: string; // UUID from database
  relayNumber: number;
  command: RelayCommand;
  timestamp: string;
  source: 'MANUAL' | 'FLISR';
}

/**
 * Map zone UUID to device key ID (must match STM32 configuration)
 * TODO: This should be fetched from database DeviceAgent table
 */
const ZONE_TO_DEVICE_MAP: Record<string, string> = {
  // Add your zone_agent_id to device_key_id mappings here
  // These should match the kZones[] array in STM32 code
  // Example:
  // 'uuid-of-zone-1': 'ac1b15fc',
  // 'uuid-of-zone-2': '70f460bd',
  // 'uuid-of-zone-3': 'df8f6261',
  // 'uuid-of-tie': '68a3fd30',
};

/**
 * Fetch device key ID from database based on zone ID
 */
async function getDeviceKeyId(zoneId: string): Promise<string | null> {
  try {
    const { pool } = await import('@/lib/database/connection');
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT da.api_key_id
         FROM "DeviceAgent" da
         WHERE da.zone_agent_id = $1
         LIMIT 1`,
        [zoneId]
      );

      if (result.rows.length > 0) {
        // Extract the device key from api_key_id (format: sgm_<deviceKey>_<hash>)
        const apiKeyId = result.rows[0].api_key_id as string;
        const match = apiKeyId.match(/^sgm_([a-f0-9]{8})_/);
        if (match) {
          return match[1]; // Return just the device key (e.g., 'ac1b15fc')
        }
      }

      return null;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[MQTT] Failed to fetch device key ID:', error);
    return null;
  }
}

/**
 * Publish a relay control command to the MQTT broker
 *
 * @param payload - The relay command payload
 * @returns Promise that resolves when the message is published
 */
export async function publishRelayCommand(
  payload: RelayCommandPayload
): Promise<void> {
  const client = getMqttClient();

  // Get device key ID from zone ID
  const deviceKeyId = await getDeviceKeyId(payload.zoneId);

  if (!deviceKeyId) {
    throw new Error(`No device found for zone ${payload.zoneId}`);
  }

  // Construct the topic in format: /device/{deviceKeyId}/control
  const topic = `/device/${deviceKeyId}/control`;

  // Create the message in format expected by STM32:
  // {"relay":1,"state":"CLOSED"}
  const message = JSON.stringify({
    relay: payload.relayNumber,
    state: payload.command, // CLOSED, OPEN, ON, OFF
  });

  return new Promise((resolve, reject) => {
    client.publish(topic, message, { qos: 1, retain: false }, (error) => {
      if (error) {
        console.error(`[MQTT] Failed to publish to ${topic}:`, error);
        reject(error);
      } else {
        console.log(`[MQTT] Published command to ${topic}:`, message);
        console.log(`[MQTT] Device: ${deviceKeyId}, Relay: ${payload.relayNumber}, State: ${payload.command}`);
        resolve();
      }
    });
  });
}

/**
 * Publish a switch control command for grid connections (used by FLISR)
 * Format: smart-grid/connection/{grid_connection_id}/switch/command
 */
export interface SwitchCommandPayload {
  gridConnectionId: string;
  command: 'OPEN' | 'CLOSE';
  timestamp: string;
  source: 'MANUAL' | 'FLISR';
  reason?: string;
}

/**
 * Publish a switch control command to the MQTT broker
 *
 * @param payload - The switch command payload
 * @returns Promise that resolves when the message is published
 */
export async function publishSwitchCommand(
  payload: SwitchCommandPayload
): Promise<void> {
  const client = getMqttClient();

  // Construct the topic
  const topic = `smart-grid/connection/${payload.gridConnectionId}/switch/command`;

  // Create the message
  const message = JSON.stringify({
    command: payload.command,
    timestamp: payload.timestamp,
    source: payload.source,
    reason: payload.reason || '',
  });

  return new Promise((resolve, reject) => {
    client.publish(topic, message, { qos: 1, retain: false }, (error) => {
      if (error) {
        console.error(`[MQTT] Failed to publish to ${topic}:`, error);
        reject(error);
      } else {
        console.log(`[MQTT] Published to ${topic}:`, message);
        resolve();
      }
    });
  });
}

/**
 * Close the MQTT client connection (useful for cleanup)
 */
export async function closeMqttClient(): Promise<void> {
  if (mqttClient) {
    return new Promise((resolve) => {
      mqttClient!.end(false, {}, () => {
        console.log('[MQTT] Client disconnected');
        mqttClient = null;
        resolve();
      });
    });
  }
}
