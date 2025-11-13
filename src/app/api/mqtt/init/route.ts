import { NextResponse } from 'next/server';
import { startMqttTelemetryListener, isMqttListenerActive } from '@/lib/mqtt/telemetry-listener';

/**
 * POST /api/mqtt/init
 *
 * Manually initialize the MQTT telemetry listener
 * Useful in development when instrumentation.ts doesn't run
 */
export async function POST() {
  try {
    const alreadyActive = isMqttListenerActive();

    if (alreadyActive) {
      return NextResponse.json({
        success: true,
        message: 'MQTT listener already active',
        alreadyRunning: true,
      });
    }

    // Start the listener
    startMqttTelemetryListener();

    // Wait a bit for connection to establish
    await new Promise(resolve => setTimeout(resolve, 2000));

    const nowActive = isMqttListenerActive();

    return NextResponse.json({
      success: true,
      message: nowActive
        ? 'MQTT listener started successfully'
        : 'MQTT listener started but not yet connected (check broker credentials)',
      active: nowActive,
    });
  } catch (error) {
    console.error('[API] Failed to initialize MQTT listener:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to start MQTT listener',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * GET /api/mqtt/init
 *
 * Check if auto-init is available and provide instructions
 */
export async function GET() {
  const active = isMqttListenerActive();

  return NextResponse.json({
    active,
    message: active
      ? 'MQTT listener is running'
      : 'MQTT listener not running. Send POST request to initialize.',
    instructions: {
      dev: 'Run: npm run dev:mqtt (uses custom server with auto-init)',
      manual: 'Send POST request to /api/mqtt/init',
      production: 'instrumentation.ts runs automatically on next start',
    },
  });
}
