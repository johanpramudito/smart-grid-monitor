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
    // Run queries in parallel for efficiency
    const [totalZonesResult, activeFaultsResult] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM "ZoneAgent"`),
      client.query(`SELECT COUNT(*) FROM "EventLog" WHERE event_type = 'FAULT' AND resolved = FALSE`),
    ]);

    const totalZones = parseInt(totalZonesResult.rows[0].count, 10);
    const activeFaults = parseInt(activeFaultsResult.rows[0].count, 10);

    // Determine overall system status
    let systemStatus = 'Operational';
    if (activeFaults > 0) {
      systemStatus = 'Fault Detected';
    } else if (totalZones === 0) {
      systemStatus = 'Offline';
    }

    const stats = {
      totalZones,
      activeFaults,
      systemStatus,
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
