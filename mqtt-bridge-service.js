/**
 * MQTT Bridge HTTP Service
 *
 * This service maintains a persistent MQTT connection and exposes
 * an HTTP API for Vercel to publish messages.
 *
 * Deploy this to Railway, Render, or any platform supporting persistent processes.
 *
 * Usage:
 * - POST /publish - Publish MQTT message
 * - GET /health - Health check
 */

const express = require('express');
const mqtt = require('mqtt');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// MQTT Configuration
const MQTT_CONFIG = {
  brokerUrl: process.env.MQTT_BROKER_URL || 'mqtts://63bc39f40f32495da0024ba20d660201.s1.eu.hivemq.cloud:8883',
  username: process.env.MQTT_USERNAME || 'capstonea03',
  password: process.env.MQTT_PASSWORD || 'CAPstone_A03',
  clientId: `mqtt-bridge-${Math.random().toString(16).substr(2, 8)}`,
};

// Initialize MQTT Client
let mqttClient;

function connectMQTT() {
  const options = {
    clientId: MQTT_CONFIG.clientId,
    username: MQTT_CONFIG.username,
    password: MQTT_CONFIG.password,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 30 * 1000,
    rejectUnauthorized: false,
  };

  mqttClient = mqtt.connect(MQTT_CONFIG.brokerUrl, options);

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

// Initialize connection
connectMQTT();

/**
 * POST /publish
 * Body: { topic: string, message: string|object, qos?: 0|1|2 }
 */
app.post('/publish', async (req, res) => {
  try {
    const { topic, message, qos = 1 } = req.body;

    if (!topic || !message) {
      return res.status(400).json({
        error: 'Missing required fields: topic, message',
      });
    }

    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);

    // Publish to MQTT
    mqttClient.publish(topic, messageStr, { qos, retain: false }, (error) => {
      if (error) {
        console.error(`[MQTT] Publish error:`, error);
        return res.status(500).json({
          error: 'Failed to publish message',
          details: error.message,
        });
      }

      console.log(`[MQTT] Published to ${topic}:`, messageStr);
      res.json({
        success: true,
        topic,
        message: messageStr,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (error) {
    console.error('[API] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
});

/**
 * GET /health
 */
app.get('/health', (req, res) => {
  const isConnected = mqttClient && mqttClient.connected;
  res.json({
    status: isConnected ? 'healthy' : 'unhealthy',
    mqtt: {
      connected: isConnected,
      broker: MQTT_CONFIG.brokerUrl,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /
 */
app.get('/', (req, res) => {
  res.json({
    service: 'MQTT Bridge',
    version: '1.0.0',
    endpoints: {
      'POST /publish': 'Publish MQTT message',
      'GET /health': 'Health check',
    },
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[HTTP] MQTT Bridge listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] Received SIGTERM');
  if (mqttClient) {
    mqttClient.end(false, {}, () => {
      console.log('[MQTT] Client disconnected');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
