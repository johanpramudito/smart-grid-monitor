import { NextResponse } from 'next/server';
import { isMqttListenerActive } from '@/lib/mqtt/telemetry-listener';

/**
 * GET /api/mqtt/status
 *
 * Check if the MQTT telemetry listener is active
 * Useful for monitoring and health checks
 */
export async function GET() {
  const active = isMqttListenerActive();
  const status = active ? 'connected' : 'disconnected';

  return NextResponse.json({
    mqtt_listener: status,
    active,
    timestamp: new Date().toISOString(),
    runtime: process.env.NEXT_RUNTIME || 'unknown',
  });
}
