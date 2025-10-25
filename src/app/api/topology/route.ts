import { NextResponse } from 'next/server';
import { pool } from '../../../lib/database/connection';

/**
 * GET /api/topology
 * Fetches the grid structure from the database and formats it for React Flow.
 */
export async function GET() {
  const client = await pool.connect();
  try {
    // Fetch enriched zone metadata (active faults, latest fault event info)
    const zonesResult = await client.query(`
      SELECT
        z.zone_agent_id,
        z.agent_system_id,
        z.feeder_number,
        z.location_description,
        z.status,
        z.created_at,
        COALESCE(f.fault_event_count, 0) AS active_faults,
        fe.event_id AS active_fault_event_id,
        fe.description AS fault_description,
        fe.timestamp AS fault_timestamp,
        da.device_id AS device_id,
        da.last_seen AS device_last_seen
      FROM "ZoneAgent" z
      LEFT JOIN (
        SELECT zone_agent_id, COUNT(*) AS fault_event_count
        FROM "EventLog"
        WHERE zone_agent_id IS NOT NULL
          AND event_type = 'FAULT'
          AND resolved = FALSE
        GROUP BY zone_agent_id
      ) f ON f.zone_agent_id = z.zone_agent_id
      LEFT JOIN LATERAL (
        SELECT e.event_id, e.description, e.timestamp
        FROM "EventLog" e
        WHERE e.zone_agent_id = z.zone_agent_id
          AND e.event_type = 'FAULT'
          AND e.resolved = FALSE
        ORDER BY e.timestamp DESC
        LIMIT 1
      ) fe ON TRUE
      LEFT JOIN LATERAL (
        SELECT d.device_id, d.last_seen
        FROM "DeviceAgent" d
        WHERE d.zone_agent_id = z.zone_agent_id
        ORDER BY d.last_seen DESC NULLS LAST
        LIMIT 1
      ) da ON TRUE
      ORDER BY z.created_at;
    `);

    // Fetch all connections along with any active waveform-associated fault event.
    const connectionsResult = await client.query(`
      SELECT
        gc.*,
        fe.event_id AS active_fault_event_id
      FROM "GridConnection" gc
      LEFT JOIN LATERAL (
        SELECT fw.event_id
        FROM "FaultWaveform" fw
        JOIN "EventLog" e ON e.event_id = fw.event_id
        WHERE fw.grid_connection_id = gc.grid_connection_id
          AND e.resolved = FALSE
        ORDER BY e.timestamp DESC
        LIMIT 1
      ) fe ON TRUE;
    `);

    const zones = zonesResult.rows;
    const connections = connectionsResult.rows;

    // --- Format Data for React Flow ---

    // 1. Create Nodes from ZoneAgents
    // We'll calculate positions to lay them out in a simple row.
    const nodes = zones.map((zone) => ({
      id: zone.zone_agent_id.toString(), // React Flow requires string IDs
      type: 'default', // or a custom node type
      data: {
        label: `${zone.location_description || `Zone ${zone.feeder_number}`}`,
        status: zone.status,
        feederNumber: zone.feeder_number,
        isTie: zone.feeder_number === 99,
        activeFaults: Number(zone.active_faults),
        faultEventId: zone.active_fault_event_id ?? null,
        faultDescription: zone.fault_description ?? null,
        lastFaultAt: zone.fault_timestamp ?? null,
        deviceId: zone.device_id ?? null,
        deviceLastSeen: zone.device_last_seen ?? null,
      },
      // Apply styles based on status
      style: {
        background: zone.status === 'FAULT' ? '#EF4444' : (zone.status === 'NORMAL' ? '#22C55E' : '#64748B'),
        color: 'white',
        border: '1px solid #1E293B',
        width: 180,
      },
    }));

    // 2. Create Edges from GridConnections
    const edges = connections.map(conn => ({
      id: conn.grid_connection_id.toString(),
      source: conn.from_zone_agent_id.toString(),
      target: conn.to_zone_agent_id.toString(),
      animated: conn.connection_status === 'ACTIVE' && !conn.is_faulty,
      label: conn.is_faulty ? 'FAULT' : '',
      // Apply styles based on fault status
      style: {
        stroke: conn.is_faulty ? '#EF4444' : '#3B82F6',
        strokeWidth: 2,
      },
      data: {
        status: conn.connection_status,
        isFaulty: conn.is_faulty,
        faultEventId: conn.active_fault_event_id ?? null,
        updatedAt: conn.updated_at,
      },
    }));

    const tieClosed = zones
      .filter((zone) => zone.feeder_number !== 99)
      .some((zone) => zone.status === 'FAULT');

    return NextResponse.json({ nodes, edges, tieClosed });

  } catch (error) {
    console.error('Error fetching topology data:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
  } finally {
    client.release();
  }
}
