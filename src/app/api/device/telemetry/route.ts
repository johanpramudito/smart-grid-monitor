import { NextResponse } from 'next/server';
import { z } from 'zod';
import { findDeviceByApiKey } from '../../../../lib/device/registry';
import { ingestTelemetry } from '../../../../lib/device/telemetry';

const telemetrySchema = z
  .object({
    voltage: z.number().finite().optional(),
    current: z.number().finite().optional(),
    power: z.number().finite().optional(),
    pf: z.number().min(0).max(1).optional(), // Power factor: 0.0 to 1.0
    energy: z.number().finite().nonnegative().optional(), // Accumulated energy in kWh
    frequency: z.number().finite().positive().optional(), // AC frequency in Hz
    status: z.enum(['NORMAL', 'FAULT', 'ISOLATED', 'OFFLINE']).optional(),
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
    const parsed = telemetrySchema.safeParse(payload);

    if (!parsed.success) {
      const errors = parsed.error.flatten();
      return NextResponse.json(
        {
          message: errors.formErrors[0] ?? 'Invalid telemetry payload.',
          errors,
        },
        { status: 400 },
      );
    }

    const timestamp = parsed.data.timestamp ? new Date(parsed.data.timestamp) : new Date();
    await ingestTelemetry(device, {
      ...parsed.data,
      timestamp,
    });

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
