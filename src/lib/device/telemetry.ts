import type { PoolClient } from 'pg';
import { pool } from '../database/connection';
import type { DeviceAgent } from '../database/models';
import type { ZoneStatus } from '../flisr/types';

type SensorType = 'CURRENT' | 'VOLTAGE';

type TelemetryInput = {
  timestamp: Date;
  status?: ZoneStatus;
  voltage?: number;
  current?: number;
};

async function getOrCreateSensor(client: PoolClient, zoneId: string, type: SensorType) {
  const existing = await client.query<{ sensor_id: string }>(
    `
      SELECT sensor_id
      FROM "Sensor"
      WHERE zone_agent_id = $1
        AND type = $2
      ORDER BY installed_at ASC
      LIMIT 1
    `,
    [zoneId, type],
  );

  if (existing.rows[0]) {
    return existing.rows[0].sensor_id;
  }

  const created = await client.query<{ sensor_id: string }>(
    `
      INSERT INTO "Sensor" (zone_agent_id, type)
      VALUES ($1, $2)
      RETURNING sensor_id
    `,
    [zoneId, type],
  );

  return created.rows[0].sensor_id;
}

async function recordSensorValue(
  client: PoolClient,
  sensorId: string,
  timestamp: Date,
  value: number,
  field: 'voltage' | 'current',
) {
  await client.query(
    `
      INSERT INTO "SensorReading" (sensor_id, ${field}, timestamp)
      VALUES ($1, $2, $3)
    `,
    [sensorId, value, timestamp.toISOString()],
  );
}

export async function ingestTelemetry(device: DeviceAgent, input: TelemetryInput) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const zoneId = device.zone_agent_id;

    if (typeof input.voltage === 'number') {
      const voltageSensorId = await getOrCreateSensor(client, zoneId, 'VOLTAGE');
      await recordSensorValue(client, voltageSensorId, input.timestamp, input.voltage, 'voltage');
    }

    if (typeof input.current === 'number') {
      const currentSensorId = await getOrCreateSensor(client, zoneId, 'CURRENT');
      await recordSensorValue(client, currentSensorId, input.timestamp, input.current, 'current');
    }

    if (input.status) {
      await client.query(
        `
          UPDATE "ZoneAgent"
          SET status = $1
          WHERE zone_agent_id = $2
        `,
        [input.status, zoneId],
      );

      await client.query(
        `
          INSERT INTO "EventLog" (zone_agent_id, event_type, description, resolved)
          VALUES ($1, $2, $3, $4)
        `,
        [
          zoneId,
          input.status === 'FAULT' ? 'FAULT' : 'STATUS_UPDATE',
          `Device ${device.device_id} reported status ${input.status}`,
          input.status !== 'FAULT',
        ],
      );

      if (input.status !== 'FAULT') {
        await client.query(
          `
            UPDATE "EventLog"
            SET resolved = TRUE
            WHERE zone_agent_id = $1
              AND event_type = 'FAULT'
              AND resolved = FALSE
          `,
          [zoneId],
        );
      }
    }

    await client.query(
      `
        UPDATE "DeviceAgent"
        SET last_seen = NOW(), updated_at = NOW()
        WHERE device_id = $1
      `,
      [device.device_id],
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
