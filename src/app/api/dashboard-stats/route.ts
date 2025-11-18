import { NextResponse } from 'next/server';
import { pool } from '../../../lib/database/connection';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/dashboard-stats
 * Fetches high-level statistics for the main dashboard.
 */
export async function GET() {
  const client = await pool.connect();
  try {
    // Offline threshold: 15 seconds (3x the normal 5-second MQTT publish interval)
    const OFFLINE_THRESHOLD_SECONDS = 15;

    // Run queries in parallel for efficiency
    const [totalZonesResult, activeFaultsResult, offlineZonesResult] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM "ZoneAgent"`),
      client.query(`SELECT COUNT(*) FROM "EventLog" WHERE event_type = 'FAULT' AND resolved = FALSE`),
      client.query(
        `SELECT COUNT(*) FROM "ZoneAgent"
         WHERE last_seen IS NULL
            OR last_seen < NOW() - INTERVAL '${OFFLINE_THRESHOLD_SECONDS} seconds'`
      ),
    ]);

    const totalZones = parseInt(totalZonesResult.rows[0].count, 10);
    const activeFaults = parseInt(activeFaultsResult.rows[0].count, 10);
    const offlineZones = parseInt(offlineZonesResult.rows[0].count, 10);

    // Determine overall system status
    let systemStatus = 'Operational';

    // Priority: Offline > Fault > Operational
    if (offlineZones > 0 || totalZones === 0) {
      systemStatus = 'Offline';
    } else if (activeFaults > 0) {
      systemStatus = 'Fault Detected';
    }

    const stats = {
      totalZones,
      activeFaults,
      systemStatus,
      offlineZones, // Include offline count for debugging
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
  } finally {
    client.release();
  }
}
