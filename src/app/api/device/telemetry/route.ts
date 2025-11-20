import { NextResponse } from 'next/server';
import { z } from 'zod';
import { findDeviceByApiKey } from '../../../../lib/device/registry';
import { ingestTelemetry } from '../../../../lib/device/telemetry';
import { wsManager } from '../../../../lib/websocket/manager';

const relaySchema = z.object({
  relay: z.number().int().positive(),
  state: z.enum(['OPEN', 'CLOSED', 'ON', 'OFF']),
  override: z.boolean().optional(),
});

const telemetrySchema = z
  .object({
    voltage: z.number().finite().optional(),
    current: z.number().finite().optional(),
    power: z.number().finite().optional(),
    pf: z.number().min(0).max(1).optional(), // Power factor: 0.0 to 1.0
    energy: z.number().finite().nonnegative().optional(), // Accumulated energy in kWh
    frequency: z.number().finite().positive().optional(), // AC frequency in Hz
    status: z.enum([
      'NORMAL',
      'FAULT',
      'TRIPPED',
      'ISOLATED',
      'LOCKOUT',
      'OFFLINE',
      'OPEN',
      'BACKUP',
      'PARALLEL'
    ]).optional(),
    relays: z.array(relaySchema).optional(),
    timestamp: z.string().datetime().optional(),
  })
  .refine(
    (data) => data.voltage !== undefined || data.current !== undefined || data.power !== undefined || data.status !== undefined,
    { message: 'Provide at least one of voltage, current, power, or status.' },
  );

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ message: 'Missing API key.' }, { status: 401 });
    }

    const device = await findDeviceByApiKey(apiKey);
    if (!device) {
      return NextResponse.json({ message: 'Invalid API key.' }, { status: 401 });
    }

    const payload = await request.json();

    // Debug logging - show raw payload
    console.log(`[API] Received telemetry from device ${device.device_id}:`, payload);

    const parsed = telemetrySchema.safeParse(payload);

    if (!parsed.success) {
      const errors = parsed.error.flatten();
      console.error(`[API] Telemetry validation failed:`, errors);
      return NextResponse.json(
        {
          message: errors.formErrors[0] ?? 'Invalid telemetry payload.',
          errors,
        },
        { status: 400 },
      );
    }

    console.log(`[API] Telemetry validated, parsed data:`, parsed.data);

    const timestamp = parsed.data.timestamp ? new Date(parsed.data.timestamp) : new Date();

    // Ingest telemetry - returns true if status changed
    const statusChanged = await ingestTelemetry(device, {
      ...parsed.data,
      timestamp,
    });

    // Broadcast real-time data to WebSocket clients immediately
    console.log(`[API] 📡 Broadcasting to zone: ${device.zone_agent_id}`);
    console.log(`[API] 📊 Data:`, {
      voltage: parsed.data.voltage,
      current: parsed.data.current,
      power: parsed.data.power,
    });

    wsManager.broadcast(device.zone_agent_id, {
      voltage: parsed.data.voltage,
      current: parsed.data.current,
      power: parsed.data.power,
      power_factor: parsed.data.pf,
      energy: parsed.data.energy,
      frequency: parsed.data.frequency,
      status: parsed.data.status,
      timestamp: timestamp.toISOString(),
    });

    // CRITICAL: Broadcast status changes to all dashboard clients
    // Only broadcast if status actually changed (detected by ingestTelemetry)
    if (statusChanged && parsed.data.status) {
      console.log(`[API] 🔔 Status CHANGED to ${parsed.data.status} - broadcasting to ALL dashboard clients`);

      // IMPORTANT: Don't stringify - wsManager.broadcast() will do that
      wsManager.broadcast('__status_broadcast__', {
        type: 'status-change',
        data: {
          zoneId: device.zone_agent_id,
          status: parsed.data.status,
          timestamp: timestamp.toISOString(),
        }
      });
    }

    return NextResponse.json({
      message: 'Telemetry ingested successfully.',
      deviceId: device.device_id,
      zoneAgentId: device.zone_agent_id,
    });
  } catch (error) {
    console.error('Telemetry ingest failure:', error);
    return NextResponse.json(
      {
        message: 'Failed to ingest telemetry.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
