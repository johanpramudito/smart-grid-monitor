/**
 * Next.js Instrumentation Hook
 *
 * This file runs once when the Next.js server starts.
 * We use it to initialize background services like the MQTT listener.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on Node.js runtime (not Edge, not during build)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Don't run during build phase
    if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development') {
      console.log('[Server] Starting instrumentation...');

      try {
        // Dynamically import to avoid build-time issues
        const { startMqttTelemetryListener } = await import('./src/lib/mqtt/telemetry-listener');
        startMqttTelemetryListener();
        console.log('[Server] MQTT listener started');
      } catch (error) {
        console.error('[Server] Failed to start MQTT listener:', error);
      }
    }
  }
}
