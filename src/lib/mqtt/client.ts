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
 * Format: smart-grid/zone/{zone_id}/relay/{relay_number}/command
 */
export interface RelayCommandPayload {
  zoneId: string;
  relayNumber: number;
  command: RelayCommand;
  timestamp: string;
  source: 'MANUAL' | 'FLISR';
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

  // Construct the topic
  const topic = `smart-grid/zone/${payload.zoneId}/relay/${payload.relayNumber}/command`;

  // Create the message
  const message = JSON.stringify({
    command: payload.command,
    timestamp: payload.timestamp,
    source: payload.source,
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
