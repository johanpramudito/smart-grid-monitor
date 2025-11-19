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
  // Use UPSERT to avoid separate SELECT query
  const result = await client.query<{ sensor_id: string }>(
    `
      INSERT INTO "Sensor" (zone_agent_id, type)
      VALUES ($1, $2)
      ON CONFLICT (zone_agent_id, type)
      DO UPDATE SET zone_agent_id = EXCLUDED.zone_agent_id
      RETURNING sensor_id
    `,
    [zoneId, type],
  );

  if (result.rows[0]) {
    return result.rows[0].sensor_id;
  }

  // Fallback: if no conflict clause matched, try direct select
  const existing = await client.query<{ sensor_id: string }>(
    `SELECT sensor_id FROM "Sensor"
     WHERE zone_agent_id = $1 AND type = $2
     LIMIT 1`,
    [zoneId, type],
  );

  return existing.rows[0].sensor_id;
}

export async function ingestTelemetry(device: DeviceAgent, input: TelemetryInput) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const zoneId = device.zone_agent_id;

    // Update device and zone last seen timestamps FIRST for faster status updates
    await Promise.all([
      client.query(
        `UPDATE "DeviceAgent" SET last_seen = NOW(), updated_at = NOW() WHERE device_id = $1`,
        [device.device_id]
      ),
      client.query(
        `UPDATE "ZoneAgent" SET last_seen = NOW() WHERE zone_agent_id = $1`,
        [zoneId]
      )
    ]);

    // Create a single sensor per zone for all readings
    const sensorId = await getOrCreateSensor(client, zoneId, 'VOLTAGE');

    // Insert all sensor data in a SINGLE row to avoid timestamp merge issues
    const hasAnyReading = input.voltage !== undefined || input.current !== undefined ||
                         input.power !== undefined || input.pf !== undefined ||
                         input.energy !== undefined || input.frequency !== undefined;

    if (hasAnyReading) {
      const insertParams: (string | number)[] = [sensorId];
      let paramIndex = 2;

      const voltageParam = input.voltage !== undefined ? `$${paramIndex++}` : 'NULL';
      const currentParam = input.current !== undefined ? `$${paramIndex++}` : 'NULL';
      const powerParam = input.power !== undefined ? `$${paramIndex++}` : 'NULL';
      const pfParam = input.pf !== undefined ? `$${paramIndex++}` : 'NULL';
      const energyParam = input.energy !== undefined ? `$${paramIndex++}` : 'NULL';
      const frequencyParam = input.frequency !== undefined ? `$${paramIndex++}` : 'NULL';
      const timestampParam = paramIndex++;

      if (input.voltage !== undefined) insertParams.push(input.voltage);
      if (input.current !== undefined) insertParams.push(input.current);
      if (input.power !== undefined) insertParams.push(input.power);
      if (input.pf !== undefined) insertParams.push(input.pf);
      if (input.energy !== undefined) insertParams.push(input.energy);
      if (input.frequency !== undefined) insertParams.push(input.frequency);
      insertParams.push(input.timestamp.toISOString());

      await client.query(
        `INSERT INTO "SensorReading" (sensor_id, voltage, current, power, power_factor, energy, frequency, timestamp)
         VALUES ($1, ${voltageParam}, ${currentParam}, ${powerParam}, ${pfParam}, ${energyParam}, ${frequencyParam}, $${timestampParam})`,
        insertParams
      );
    }

    // Batch relay updates
    if (input.relays && input.relays.length > 0) {
      const relayUpdates = input.relays.map(relay => {
        const normalizedState = (relay.state === 'ON' || relay.state === 'CLOSED') ? 'CLOSED' : 'OPEN';
        return client.query(
          `UPDATE "Relay" SET status = $1 WHERE zone_agent_id = $2 AND relay_number = $3`,
          [normalizedState, zoneId, relay.relay]
        );
      });
      await Promise.all(relayUpdates);
    }

    // Status and event log updates
    if (input.status) {
      const statusUpdates = [
        client.query(
          `UPDATE "ZoneAgent" SET status = $1 WHERE zone_agent_id = $2`,
          [input.status, zoneId]
        ),
        client.query(
          `INSERT INTO "EventLog" (zone_agent_id, event_type, description, resolved)
           VALUES ($1, $2, $3, $4)`,
          [
            zoneId,
            input.status === 'FAULT' ? 'FAULT' : 'STATUS_UPDATE',
            `Device ${device.device_id} reported status ${input.status}`,
            input.status !== 'FAULT',
          ]
        )
      ];

      if (input.status !== 'FAULT') {
        statusUpdates.push(
          client.query(
            `UPDATE "EventLog" SET resolved = TRUE
             WHERE zone_agent_id = $1 AND event_type = 'FAULT' AND resolved = FALSE`,
            [zoneId]
          )
        );
      }

      await Promise.all(statusUpdates);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
