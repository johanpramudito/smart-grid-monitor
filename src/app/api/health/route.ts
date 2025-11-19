import { NextResponse } from 'next/server';
import { pool } from '../../../lib/database/connection';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/health
 * Health check endpoint that also keeps database connections warm
 */
export async function GET() {
  try {
    const client = await pool.connect();
    try {
      // Simple query to keep connection alive
      await client.query('SELECT 1');
      return NextResponse.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected'
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}
