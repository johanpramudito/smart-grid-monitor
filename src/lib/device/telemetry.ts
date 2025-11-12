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

    // Batch sensor creation for all needed sensor types
    const sensorPromises = [];
    const needsVoltage = input.voltage !== undefined ||
                         input.power !== undefined || input.pf !== undefined ||
                         input.energy !== undefined || input.frequency !== undefined;
    const needsCurrent = input.current !== undefined;

    if (needsVoltage) {
      sensorPromises.push(getOrCreateSensor(client, zoneId, 'VOLTAGE'));
    }
    if (needsCurrent) {
      sensorPromises.push(getOrCreateSensor(client, zoneId, 'CURRENT'));
    }

    const sensors = await Promise.all(sensorPromises);
    const voltageSensorId = needsVoltage ? sensors[0] : null;
    const currentSensorId = needsCurrent ? sensors[needsVoltage ? 1 : 0] : null;

    // Batch all sensor reading inserts into a single query
    const insertBatch: string[] = [];
    const insertParams: (string | number)[] = [];
    let paramIndex = 1;

    if (voltageSensorId && typeof input.voltage === 'number') {
      const sensorIdParam = paramIndex++;
      const voltageParam = paramIndex++;
      const timestampParam = paramIndex++;

      insertBatch.push(`($${sensorIdParam}, $${voltageParam}, NULL, NULL, NULL, NULL, NULL, $${timestampParam})`);
      insertParams.push(voltageSensorId, input.voltage, input.timestamp.toISOString());
    }

    if (currentSensorId && typeof input.current === 'number') {
      const sensorIdParam = paramIndex++;
      const currentParam = paramIndex++;
      const timestampParam = paramIndex++;

      insertBatch.push(`($${sensorIdParam}, NULL, $${currentParam}, NULL, NULL, NULL, NULL, $${timestampParam})`);
      insertParams.push(currentSensorId, input.current, input.timestamp.toISOString());
    }

    // Add power metrics row
    const hasPowerMetrics = input.power !== undefined || input.pf !== undefined ||
                           input.energy !== undefined || input.frequency !== undefined;

    if (voltageSensorId && hasPowerMetrics) {
      const sensorIdParam = paramIndex++;
      const powerParam = input.power !== undefined ? `$${paramIndex++}` : 'NULL';
      const pfParam = input.pf !== undefined ? `$${paramIndex++}` : 'NULL';
      const energyParam = input.energy !== undefined ? `$${paramIndex++}` : 'NULL';
      const frequencyParam = input.frequency !== undefined ? `$${paramIndex++}` : 'NULL';
      const timestampParam = paramIndex++;

      insertBatch.push(`($${sensorIdParam}, NULL, NULL, ${powerParam}, ${pfParam}, ${energyParam}, ${frequencyParam}, $${timestampParam})`);
      insertParams.push(voltageSensorId);
      if (input.power !== undefined) insertParams.push(input.power);
      if (input.pf !== undefined) insertParams.push(input.pf);
      if (input.energy !== undefined) insertParams.push(input.energy);
      if (input.frequency !== undefined) insertParams.push(input.frequency);
      insertParams.push(input.timestamp.toISOString());
    }

    // Execute batched sensor inserts
    if (insertBatch.length > 0) {
      await client.query(
        `INSERT INTO "SensorReading" (sensor_id, voltage, current, power, power_factor, energy, frequency, timestamp)
         VALUES ${insertBatch.join(', ')}`,
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

    // Update device last seen
    await client.query(
      `UPDATE "DeviceAgent" SET last_seen = NOW(), updated_at = NOW() WHERE device_id = $1`,
      [device.device_id]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
