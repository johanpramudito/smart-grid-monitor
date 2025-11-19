import { NextResponse } from 'next/server';
import { pool } from '../../../../lib/database/connection';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/zones/[id]
 * Fetches details and historical sensor data for a specific zone.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: zoneId } = await context.params;
  const client = await pool.connect();
  try {
    // Basic validation for UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(zoneId)) {
      return NextResponse.json({ message: 'Invalid Zone ID format.' }, { status: 400 });
    }

    // Query for zone details and its historical sensor readings in parallel
    // Optimized to use indexes and avoid expensive LATERAL joins
    const [detailsResult, historyResult, faultResult, deviceResult] = await Promise.all([
      // Basic zone info (fastest query)
      client.query(
        `SELECT * FROM "ZoneAgent" WHERE zone_agent_id = $1`,
        [zoneId]
      ),
      // Sensor readings - last 120 readings (60 seconds at 500ms intervals)
      // This provides better visibility of recent spikes and transients
      client.query(`
        SELECT r.timestamp, r.voltage, r.current, r.power, r.power_factor, r.energy, r.frequency
        FROM "SensorReading" r
        JOIN "Sensor" s ON r.sensor_id = s.sensor_id
        WHERE s.zone_agent_id = $1
        ORDER BY r.timestamp DESC
        LIMIT 120
      `, [zoneId]),
      // Fault info (uses idx_eventlog_zone_type_resolved)
      client.query(`
        SELECT
          COUNT(*) as fault_event_count,
          (SELECT event_id FROM "EventLog"
           WHERE zone_agent_id = $1 AND event_type = 'FAULT' AND resolved = FALSE
           ORDER BY timestamp DESC LIMIT 1) as active_fault_event_id,
          (SELECT description FROM "EventLog"
           WHERE zone_agent_id = $1 AND event_type = 'FAULT' AND resolved = FALSE
           ORDER BY timestamp DESC LIMIT 1) as fault_description,
          (SELECT timestamp FROM "EventLog"
           WHERE zone_agent_id = $1 AND event_type = 'FAULT' AND resolved = FALSE
           ORDER BY timestamp DESC LIMIT 1) as fault_timestamp
        FROM "EventLog"
        WHERE zone_agent_id = $1 AND event_type = 'FAULT' AND resolved = FALSE
      `, [zoneId]),
      // Device info (uses idx_deviceagent_zone_lastseen)
      client.query(`
        SELECT device_id, last_seen
        FROM "DeviceAgent"
        WHERE zone_agent_id = $1
        ORDER BY last_seen DESC NULLS LAST
        LIMIT 1
      `, [zoneId])
    ]);

    if (detailsResult.rows.length === 0) {
      return NextResponse.json({ message: `Zone with ID ${zoneId} not found.` }, { status: 404 });
    }

    // Combine results from parallel queries
    const zoneDetails = detailsResult.rows[0];
    const faultData = faultResult.rows[0] || {};
    const deviceData = deviceResult.rows[0] || {};

    // Merge fault and device data into zone details
    zoneDetails.active_faults = Number(faultData.fault_event_count ?? 0);
    zoneDetails.active_fault_event_id = faultData.active_fault_event_id ?? null;
    zoneDetails.fault_description = faultData.fault_description ?? null;
    zoneDetails.fault_timestamp = faultData.fault_timestamp ?? null;
    zoneDetails.device_id = deviceData.device_id ?? null;
    zoneDetails.device_last_seen = deviceData.last_seen ?? null;

    // Sensor readings - convert to numbers, omit undefined fields
    const chartData = historyResult.rows.map(reading => {
      const dataPoint: Record<string, string | number> = {
        time: new Date(reading.timestamp).toISOString(),
      };

      if (reading.voltage !== null && reading.voltage !== undefined) {
        dataPoint.voltage = Number(reading.voltage);
      }
      if (reading.current !== null && reading.current !== undefined) {
        dataPoint.current = Number(reading.current);
      }
      if (reading.power !== null && reading.power !== undefined) {
        dataPoint.power = Number(reading.power);
      }
      if (reading.power_factor !== null && reading.power_factor !== undefined) {
        dataPoint.power_factor = Number(reading.power_factor);
      }
      if (reading.energy !== null && reading.energy !== undefined) {
        dataPoint.energy = Number(reading.energy);
      }
      if (reading.frequency !== null && reading.frequency !== undefined) {
        dataPoint.frequency = Number(reading.frequency);
      }

      return dataPoint;
    });

    return NextResponse.json({
      details: zoneDetails,
      history: chartData,
    });

  } catch (error) {
    console.error(`Error fetching data for zone ${zoneId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
  } finally {
    client.release();
  }
}
