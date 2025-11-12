  /**
   * MQTT Client Service
   *
   * Provides a singleton MQTT client for publishing relay control commands
   * to IoT devices (STM32 + ESP-01) in the smart grid system.
   */

  import mqtt, { MqttClient, IClientOptions } from 'mqtt';

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
      // Parse broker URL to determine if TLS is enabled
      const isTLS = MQTT_CONFIG.brokerUrl.startsWith('mqtts://') ||
                    MQTT_CONFIG.brokerUrl.startsWith('wss://');

      const connectionOptions: IClientOptions = {
        clientId: MQTT_CONFIG.clientId,
        username: MQTT_CONFIG.username,
        password: MQTT_CONFIG.password,
        clean: true,
        reconnectPeriod: 5000, // Reconnect every 5 seconds if disconnected
        connectTimeout: 30 * 1000, // 30 seconds
      };

      // Add TLS options if using secure connection
      if (isTLS) {
        connectionOptions.rejectUnauthorized = false; // Skip certificate validation for now
        console.log('[MQTT] Using TLS/SSL connection');
        console.log('[MQTT] Note: Certificate validation is disabled');
        console.log('[MQTT] For production, enable certificate verification!');
      }

      mqttClient = mqtt.connect(MQTT_CONFIG.brokerUrl, connectionOptions);

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
   * - CLOSED/ON: Close the relay contact
   * - OPEN/OFF: Open the relay contact
   * - AUTO: Exit manual override mode and return to automatic protection
   */
  export type RelayCommand = 'CLOSED' | 'OPEN' | 'ON' | 'OFF' | 'AUTO';

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
   * You need to populate this with your actual zone_agent_id values
   */
  const ZONE_TO_DEVICE_MAP: Record<string, string> = {
    'bbe279dd-fafc-46cf-baa6-155274848aa4': 'ac1b15fc',  // Feeder 1
    '374dc170-e214-46db-976a-7640a8ce05e2': '70f460bd',  // Feeder 2
    'fa069c3b-8840-4a46-9f2d-5556de3acbc8': 'df8f6261',  // Feeder 3
    'ad2582a3-8b97-45d2-bdf8-05d834d87e9c': '68a3fd30', // Tie relay
  };

  /**
   * Publish a relay control command to the MQTT broker
   * Publishes to the specific device mapped to the zone
   *
   * @param payload - The relay command payload
   * @returns Promise that resolves when the message is published
   */
  export async function publishRelayCommand(
    payload: RelayCommandPayload
  ): Promise<void> {
    const client = getMqttClient();

    // Get device key ID for this zone
    const deviceKeyId = ZONE_TO_DEVICE_MAP[payload.zoneId];

    if (!deviceKeyId) {
      throw new Error(
        `No device key mapping found for zone ${payload.zoneId}. ` +
        `Please update ZONE_TO_DEVICE_MAP in mqtt/client.ts`
      );
    }

    // Construct the topic in format: /device/{deviceKeyId}/control
    const topic = `/device/${deviceKeyId}/control`;

    // Create the message in format expected by STM32:
    // {"relay":1,"state":"CLOSED"} or {"relay":1,"state":"AUTO"}
    const message = JSON.stringify({
      relay: payload.relayNumber,
      state: payload.command, // CLOSED, OPEN, ON, OFF, AUTO
    });

    return new Promise((resolve, reject) => {
      client.publish(topic, message, { qos: 1, retain: false }, (error) => {
        if (error) {
          console.error(`[MQTT] Failed to publish to ${topic}:`, error);
          reject(error);
        } else {
          console.log(`[MQTT] Published command to ${topic}:`, message);
          console.log(`[MQTT] Zone: ${payload.zoneId}, Device: ${deviceKeyId}, Relay: ${payload.relayNumber}, State: ${payload.command}`);
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

  /**
   * Initialize MQTT telemetry subscriber
   * Only call this in non-serverless environments (Azure App Service, Railway, etc.)
   * DO NOT use on Vercel or other serverless platforms!
   */
  export function initializeTelemetrySubscriber(): void {
    const client = getMqttClient();

    // Subscribe to all device telemetry topics
    client.subscribe('/device/+/telemetry', { qos: 1 }, (error) => {
      if (error) {
        console.error('[MQTT] Failed to subscribe to telemetry topics:', error);
      } else {
        console.log('[MQTT] Subscribed to /device/+/telemetry');
      }
    });

    // Handle incoming telemetry messages
    client.on('message', async (topic, message) => {
      try {
        // Only process telemetry messages
        if (!topic.includes('/telemetry')) return;

        // Parse topic to extract device key
        // Format: /device/{deviceKeyId}/telemetry
        const parts = topic.split('/');
        if (parts.length !== 4 || parts[1] !== 'device' || parts[3] !== 'telemetry') {
          console.warn('[MQTT] Invalid topic format:', topic);
          return;
        }

        const deviceKeyId = parts[2];
        const payload = JSON.parse(message.toString());

        // Find zone ID from device key
        const zoneId = Object.keys(ZONE_TO_DEVICE_MAP).find(
          key => ZONE_TO_DEVICE_MAP[key] === deviceKeyId
        );

        if (!zoneId) {
          console.warn(`[MQTT] No zone mapping for device ${deviceKeyId}`);
          return;
        }

        console.log(`[MQTT] Received telemetry from ${deviceKeyId} (zone ${zoneId})`);

        // Import dynamically to avoid circular dependencies
        const { findDeviceByZoneId } = await import('../device/registry');
        const { ingestTelemetry } = await import('../device/telemetry');

        const device = await findDeviceByZoneId(zoneId);
        if (!device) {
          console.error(`[MQTT] No device found for zone ${zoneId}`);
          return;
        }

        await ingestTelemetry(device, {
          ...payload,
          timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
        });

        console.log(`[MQTT] Telemetry ingested for device ${deviceKeyId}`);
      } catch (error) {
        console.error('[MQTT] Error processing telemetry:', error);
      }
    });

    console.log('[MQTT] Telemetry subscriber initialized');
  }
