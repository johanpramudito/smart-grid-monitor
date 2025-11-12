import { randomBytes } from 'node:crypto';
import { pool } from '../database/connection';
import { hashPassword, verifyPassword } from '../auth/password';
import type { DeviceAgent } from '../database/models';

type RegisterDeviceInput = {
  zoneAgentId: string;
  name?: string;
  firmwareVersion?: string;
};

type RegisterDeviceResult = {
  device: DeviceAgent;
  apiKey: string;
};

function generateApiKeyId(): string {
  return randomBytes(8).toString('hex');
}

function formatApiKey(id: string, secret: string) {
  return `sgm_${id}_${secret}`;
}

export async function registerDeviceAgent(input: RegisterDeviceInput): Promise<RegisterDeviceResult> {
  const apiKeyId = generateApiKeyId();
  const apiSecret = randomBytes(24).toString('hex');
  const rawKey = formatApiKey(apiKeyId, apiSecret);
  const hash = await hashPassword(rawKey);

  const client = await pool.connect();
  try {
    const result = await client.query<DeviceAgent>(
      `
        INSERT INTO "DeviceAgent" (zone_agent_id, name, api_key_id, api_key_hash, firmware_version)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING device_id, zone_agent_id, name, api_key_id, api_key_hash, firmware_version, last_seen, created_at, updated_at
      `,
      [input.zoneAgentId, input.name ?? null, apiKeyId, hash, input.firmwareVersion ?? null],
    );

    return {
      device: result.rows[0],
      apiKey: rawKey,
    };
  } finally {
    client.release();
  }
}

export async function findDeviceByApiKey(apiKey: string): Promise<DeviceAgent | null> {
  const parts = apiKey.split('_');
  if (parts.length < 3) {
    return null;
  }

  const apiKeyId = parts[1];
  const client = await pool.connect();
  try {
    const result = await client.query<DeviceAgent>(
      `
        SELECT device_id, zone_agent_id, name, api_key_id, api_key_hash, firmware_version, last_seen, created_at, updated_at
        FROM "DeviceAgent"
        WHERE api_key_id = $1
        LIMIT 1
      `,
      [apiKeyId],
    );

    const device = result.rows[0];
    if (!device) {
      return null;
    }

    const isValid = await verifyPassword(apiKey, device.api_key_hash);
    if (!isValid) {
      return null;
    }

    return device;
  } finally {
    client.release();
  }
}

export async function findDeviceByZoneId(zoneAgentId: string): Promise<DeviceAgent | null> {
  const client = await pool.connect();
  try {
    const result = await client.query<DeviceAgent>(
      `
        SELECT device_id, zone_agent_id, name, api_key_id, api_key_hash, firmware_version, last_seen, created_at, updated_at
        FROM "DeviceAgent"
        WHERE zone_agent_id = $1
        LIMIT 1
      `,
      [zoneAgentId],
    );

    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function touchDevice(deviceId: string) {
  const client = await pool.connect();
  try {
    await client.query(
      `
        UPDATE "DeviceAgent"
        SET last_seen = NOW(), updated_at = NOW()
        WHERE device_id = $1
      `,
      [deviceId],
    );
  } finally {
    client.release();
  }
}
