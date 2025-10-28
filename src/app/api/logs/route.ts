import { NextResponse } from 'next/server';
import { pool } from '../../../lib/database/connection';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/logs
 * Fetches all system events from the EventLog table.
 */
export async function GET() {
  const client = await pool.connect();
  try {
    const query = `
      SELECT
        e.event_id,
        e.event_type,
        e.description,
        e.timestamp,
        e.resolved,
        z.location_description AS zone_name
      FROM "EventLog" e
      LEFT JOIN "ZoneAgent" z ON e.zone_agent_id = z.zone_agent_id
      ORDER BY e.timestamp DESC
      LIMIT 100; -- Limit to the latest 100 events to avoid overloading the client
    `;

    const result = await client.query(query);
    
    return NextResponse.json(result.rows);

  } catch (error) {
    console.error('Error fetching event logs:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
  } finally {
    client.release();
  }
}
