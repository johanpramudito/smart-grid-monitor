import type { PoolClient } from 'pg';
import { pool } from '../database/connection';
import type { DeviceAgent } from '../database/models';
import type { ZoneStatus } from '../flisr/types';

type SensorType = 'CURRENT' | 'VOLTAGE';

type RelayInfo = {
  relay: number;
  state: 'OPEN' | 'CLOSED' | 'ON' | 'OFF';
  override?: boolean;
};

type TelemetryInput = {
  timestamp: Date;
  status?: ZoneStatus;
  voltage?: number;
  current?: number;
  power?: number;
  pf?: number; // power factor
  energy?: number; // accumulated energy in kWh
  frequency?: number; // AC frequency in Hz
  relays?: RelayInfo[];
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

async function recordPowerMetrics(
  client: PoolClient,
  sensorId: string,
  timestamp: Date,
  power?: number,
  powerFactor?: number,
  energy?: number,
  frequency?: number,
) {
  // Build dynamic SQL based on which values are provided
  const fields: string[] = ['sensor_id', 'timestamp'];
  const values: (string | number)[] = [sensorId, timestamp.toISOString()];

  if (power !== undefined) {
    fields.push('power');
    values.push(power);
  }
  if (powerFactor !== undefined) {
    fields.push('power_factor');
    values.push(powerFactor);
  }
  if (energy !== undefined) {
    fields.push('energy');
    values.push(energy);
  }
  if (frequency !== undefined) {
    fields.push('frequency');
    values.push(frequency);
  }

  if (fields.length > 2) { // Only insert if we have data beyond sensor_id and timestamp
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO "SensorReading" (${fields.join(', ')})
       VALUES (${placeholders})`,
      values,
    );
  }
}

export async function ingestTelemetry(device: DeviceAgent, input: TelemetryInput) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const zoneId = device.zone_agent_id;

    // Record voltage and current (use existing logic for backward compatibility)
    if (typeof input.voltage === 'number') {
      const voltageSensorId = await getOrCreateSensor(client, zoneId, 'VOLTAGE');
      await recordSensorValue(client, voltageSensorId, input.timestamp, input.voltage, 'voltage');
    }

    if (typeof input.current === 'number') {
      const currentSensorId = await getOrCreateSensor(client, zoneId, 'CURRENT');
      await recordSensorValue(client, currentSensorId, input.timestamp, input.current, 'current');
    }

    // Record power metrics (power, pf, energy, frequency) - use voltage sensor as the parent
    const hasPowerMetrics = input.power !== undefined || input.pf !== undefined ||
                           input.energy !== undefined || input.frequency !== undefined;

    if (hasPowerMetrics) {
      const voltageSensorId = await getOrCreateSensor(client, zoneId, 'VOLTAGE');
      await recordPowerMetrics(
        client,
        voltageSensorId,
        input.timestamp,
        input.power,
        input.pf,
        input.energy,
        input.frequency
      );
    }

    // Update relay states if provided
    if (input.relays && input.relays.length > 0) {
      for (const relay of input.relays) {
        // Normalize state: ON/CLOSED -> CLOSED, OFF/OPEN -> OPEN
        const normalizedState = (relay.state === 'ON' || relay.state === 'CLOSED') ? 'CLOSED' : 'OPEN';

        await client.query(
          `
            UPDATE "Relay"
            SET status = $1, updated_at = NOW()
            WHERE zone_agent_id = $2 AND relay_number = $3
          `,
          [normalizedState, zoneId, relay.relay]
        );
      }
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
