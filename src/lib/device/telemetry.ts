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

// Cache sensor IDs in memory to avoid database queries on every telemetry message
const sensorCache = new Map<string, string>(); // key: `${zoneId}:${type}`, value: sensor_id

async function getOrCreateSensor(client: PoolClient, zoneId: string, type: SensorType) {
  const cacheKey = `${zoneId}:${type}`;

  // Check cache first
  if (sensorCache.has(cacheKey)) {
    return sensorCache.get(cacheKey)!;
  }

  // Not in cache - try to find existing sensor
  const existing = await client.query<{ sensor_id: string }>(
    `SELECT sensor_id FROM "Sensor"
     WHERE zone_agent_id = $1 AND type = $2
     LIMIT 1`,
    [zoneId, type],
  );

  if (existing.rows[0]) {
    const sensorId = existing.rows[0].sensor_id;
    sensorCache.set(cacheKey, sensorId);
    return sensorId;
  }

  // Sensor doesn't exist - create it
  const result = await client.query<{ sensor_id: string }>(
    `INSERT INTO "Sensor" (zone_agent_id, type)
     VALUES ($1, $2)
     RETURNING sensor_id`,
    [zoneId, type],
  );

  const sensorId = result.rows[0].sensor_id;
  sensorCache.set(cacheKey, sensorId);
  console.log(`[Telemetry] Created new sensor for zone ${zoneId}, type ${type}`);
  return sensorId;
}

// Cache to track last update time for last_seen timestamps (avoid updating every 500ms)
const lastSeenUpdateCache = new Map<string, number>(); // key: device_id, value: timestamp
const LAST_SEEN_UPDATE_INTERVAL = 5000; // Update last_seen every 5 seconds, not every message

// Cache to track last known status and relay states (only update on actual changes)
const lastKnownStatus = new Map<string, string>(); // key: zone_id, value: status
const lastKnownRelayStates = new Map<string, string>(); // key: `zone_id:relay_num`, value: state

// ============================================================================
// ASYNC DATABASE WRITE QUEUE - For real-time WebSocket performance
// ============================================================================
interface QueuedWrite {
  device: DeviceAgent;
  input: TelemetryInput;
  timestamp: number;
}

const writeQueue: QueuedWrite[] = [];
let isProcessingQueue = false;

// Background worker that processes queued database writes
async function processWriteQueue() {
  if (isProcessingQueue || writeQueue.length === 0) {
    return;
  }

  isProcessingQueue = true;

  try {
    // Process in batches of 10 for efficiency
    const batch = writeQueue.splice(0, 10);

    console.log(`[Queue] Processing ${batch.length} writes (${writeQueue.length} remaining in queue)`);

    // Process all writes in parallel for speed
    await Promise.all(
      batch.map(item => writeTelemetryToDatabase(item.device, item.input))
    );
  } catch (error) {
    console.error('[Queue] Error processing batch:', error);
  } finally {
    isProcessingQueue = false;

    // Continue processing if queue has more items
    if (writeQueue.length > 0) {
      setImmediate(() => processWriteQueue());
    }
  }
}

// Main ingestion function - queues database write and returns immediately
// Returns TRUE if status changed, FALSE otherwise
export async function ingestTelemetry(device: DeviceAgent, input: TelemetryInput): Promise<boolean> {
  const zoneId = device.zone_agent_id;

  // Debug: Log every status received
  if (input.status) {
    const cachedStatus = lastKnownStatus.get(zoneId);
    console.log(`[Telemetry] 📊 Status check for ${zoneId}: received="${input.status}", cached="${cachedStatus || 'NONE'}", changed=${cachedStatus !== input.status}`);
  }

  // Check if status actually changed - critical changes should NOT be queued!
  // IMPORTANT: undefined !== 'NORMAL' is TRUE, so first message is treated as a change
  // This is intentional - we want to broadcast the initial status
  const statusChanged = input.status && (lastKnownStatus.get(zoneId) !== input.status);

  if (statusChanged) {
    // Status changes are CRITICAL - write immediately, don't queue!
    console.log(`[Telemetry] ⚡ CRITICAL: Status changed from ${lastKnownStatus.get(zoneId) || 'NONE'} to ${input.status} for zone ${zoneId} - writing immediately`);
    lastKnownStatus.set(zoneId, input.status!);

    // Write status change immediately (non-blocking, fire-and-forget)
    writeTelemetryToDatabase(device, input).catch(error => {
      console.error('[Telemetry] Error writing critical status change:', error);
    });

    return true; // Signal that status changed
  }

  // Non-critical sensor data - queue for background processing
  writeQueue.push({ device, input, timestamp: Date.now() });

  // Start processing queue if not already running
  if (!isProcessingQueue) {
    setImmediate(() => processWriteQueue());
  }

  // Return false - no status change
  return false;
}

// Write telemetry to database (called by background queue worker)
async function writeTelemetryToDatabase(device: DeviceAgent, input: TelemetryInput) {
  const client = await pool.connect();
  const zoneId = device.zone_agent_id;
  const now = Date.now();

  // Check if status actually changed (only update on transitions, not every message)
  const statusChanged = input.status && (lastKnownStatus.get(zoneId) !== input.status);

  // Check if any relay states changed
  let relayStatesChanged = false;
  if (input.relays && input.relays.length > 0) {
    for (const relay of input.relays) {
      const relayKey = `${zoneId}:${relay.relay}`;
      const normalizedState = (relay.state === 'ON' || relay.state === 'CLOSED') ? 'CLOSED' : 'OPEN';
      if (lastKnownRelayStates.get(relayKey) !== normalizedState) {
        relayStatesChanged = true;
        break;
      }
    }
  }

  // Only use transaction if something actually changed
  const needsTransaction = statusChanged || relayStatesChanged;

  try {

    if (needsTransaction) {
      await client.query('BEGIN');
      console.log(`[Telemetry] Using transaction: status changed=${statusChanged}, relay changed=${relayStatesChanged}`);
    }

    // Only update last_seen every 5 seconds to reduce database load
    const lastUpdate = lastSeenUpdateCache.get(device.device_id) || 0;
    const shouldUpdateLastSeen = (now - lastUpdate) > LAST_SEEN_UPDATE_INTERVAL;

    if (shouldUpdateLastSeen) {
      await client.query(
        `UPDATE "DeviceAgent" SET last_seen = NOW(), updated_at = NOW() WHERE device_id = $1`,
        [device.device_id]
      );
      lastSeenUpdateCache.set(device.device_id, now);
    }

    // Create a single sensor per zone for all readings (cached in memory - instant)
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

      const query = `INSERT INTO "SensorReading" (sensor_id, voltage, current, power, power_factor, energy, frequency, timestamp)
         VALUES ($1, ${voltageParam}, ${currentParam}, ${powerParam}, ${pfParam}, ${energyParam}, ${frequencyParam}, $${timestampParam})`;

      await client.query(query, insertParams);
    }

    // Batch relay updates (only if states actually changed)
    if (relayStatesChanged && input.relays && input.relays.length > 0) {
      const relayUpdates = input.relays.map(relay => {
        const normalizedState = (relay.state === 'ON' || relay.state === 'CLOSED') ? 'CLOSED' : 'OPEN';

        // Update cache
        const relayKey = `${zoneId}:${relay.relay}`;
        lastKnownRelayStates.set(relayKey, normalizedState);

        return client.query(
          `UPDATE "Relay" SET status = $1 WHERE zone_agent_id = $2 AND relay_number = $3`,
          [normalizedState, zoneId, relay.relay]
        );
      });
      await Promise.all(relayUpdates);
      console.log(`[Telemetry] Updated ${relayUpdates.length} relay states`);
    }

    // Update ZoneAgent (status + last_seen) in a SINGLE query to prevent deadlocks
    // Critical: Only update ZoneAgent ONCE per transaction to avoid lock contention
    // Only update last_seen every 5 seconds to reduce database load
    const zoneLastUpdate = lastSeenUpdateCache.get(`zone:${zoneId}`) || 0;
    const shouldUpdateZoneLastSeen = (now - zoneLastUpdate) > LAST_SEEN_UPDATE_INTERVAL;

    if (statusChanged) {
      // Only update status if it actually changed
      await client.query(
        `UPDATE "ZoneAgent" SET status = $1, last_seen = NOW() WHERE zone_agent_id = $2`,
        [input.status, zoneId]
      );
      lastSeenUpdateCache.set(`zone:${zoneId}`, now);
      lastKnownStatus.set(zoneId, input.status!);
      console.log(`[Telemetry] Status changed to ${input.status} for zone ${zoneId}`);
    } else if (shouldUpdateZoneLastSeen) {
      // Only update last_seen periodically if no status change
      await client.query(
        `UPDATE "ZoneAgent" SET last_seen = NOW() WHERE zone_agent_id = $1`,
        [zoneId]
      );
      lastSeenUpdateCache.set(`zone:${zoneId}`, now);
    }

    // Event log updates (only if status actually changed)
    if (statusChanged) {
      const eventLogUpdates = [
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
        eventLogUpdates.push(
          client.query(
            `UPDATE "EventLog" SET resolved = TRUE
             WHERE zone_agent_id = $1 AND event_type = 'FAULT' AND resolved = FALSE`,
            [zoneId]
          )
        );
      }

      await Promise.all(eventLogUpdates);
    }

    if (needsTransaction) {
      await client.query('COMMIT');
    }
  } catch (error) {
    if (needsTransaction) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}
