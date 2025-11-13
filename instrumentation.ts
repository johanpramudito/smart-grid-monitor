/**
 * Next.js Instrumentation Hook
 *
 * This file runs once when the Next.js server starts.
 * We use it to initialize background services like the MQTT listener.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  console.log('[Instrumentation] register() called');
  console.log('[Instrumentation] NEXT_RUNTIME:', process.env.NEXT_RUNTIME);
  console.log('[Instrumentation] NODE_ENV:', process.env.NODE_ENV);

  // In Next.js 15+, NEXT_RUNTIME is undefined during instrumentation
  // We check if we're in a server context by checking for 'window'
  if (typeof window === 'undefined') {
    console.log('[Instrumentation] Running in server context');

    // Don't run during build phase
    if (process.env.NODE_ENV !== 'test') {
      console.log('[Server] Starting instrumentation...');
      console.log('[Server] MQTT_BROKER_URL:', process.env.MQTT_BROKER_URL ? 'set' : 'MISSING');

      try {
        // Dynamically import to avoid build-time issues
        const { startMqttTelemetryListener } = await import('./src/lib/mqtt/telemetry-listener');
        console.log('[Server] startMqttTelemetryListener imported, calling...');
        startMqttTelemetryListener();
        console.log('[Server] MQTT listener initialization triggered');

        // Note: Connection might not be established immediately
        // Check /api/mqtt/status for actual connection status
      } catch (error) {
        console.error('[Server] Failed to start MQTT listener:', error);
        console.error('[Server] Error stack:', error instanceof Error ? error.stack : 'N/A');
      }
    } else {
      console.log('[Instrumentation] Skipping (test mode)');
    }
  } else {
    console.log('[Instrumentation] Skipping (browser context)');
  }
}
