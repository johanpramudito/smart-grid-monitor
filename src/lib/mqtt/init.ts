/**
 * MQTT Listener Initialization
 *
 * This module automatically starts the MQTT telemetry listener when imported.
 * Import this in instrumentation.ts to start the listener on server boot.
 */

import { startMqttTelemetryListener, stopMqttTelemetryListener } from './telemetry-listener';

// Check if we're in a Node.js server environment
if (typeof window === 'undefined') {
  console.log('[MQTT] Initializing telemetry listener...');

  // Start the listener
  startMqttTelemetryListener();

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('[MQTT] Shutting down...');
    stopMqttTelemetryListener();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export {};
