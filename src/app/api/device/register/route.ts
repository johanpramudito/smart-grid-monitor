import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromCookies } from '../../../../lib/auth/session';
import { registerDeviceAgent } from '../../../../lib/device/registry';

const registerSchema = z.object({
  zoneAgentId: z.string().uuid(),
  name: z.string().max(255).optional(),
  firmwareVersion: z.string().max(64).optional(),
});

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const parsed = registerSchema.safeParse(payload);

    if (!parsed.success) {
      const errors = parsed.error.flatten();
      return NextResponse.json(
        { message: errors.formErrors[0] ?? 'Invalid payload.', errors },
        { status: 400 },
      );
    }

    const { device, apiKey } = await registerDeviceAgent(parsed.data);
    return NextResponse.json({
      message: 'Device registered successfully.',
      device: {
        deviceId: device.device_id,
        zoneAgentId: device.zone_agent_id,
        name: device.name,
        firmwareVersion: device.firmware_version,
      },
      apiKey,
    });
  } catch (error) {
    console.error('Device registration failed:', error);
    return NextResponse.json(
      { message: 'Failed to register device.', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
