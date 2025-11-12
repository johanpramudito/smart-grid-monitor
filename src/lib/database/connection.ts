
import { Pool } from 'pg';

// It's a best practice to use a connection pool for server-side applications.
// The connection string should be stored in an environment variable (.env.local) 
// for security and portability. This avoids hard-coding credentials.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set. Please provide your NeonDB connection string.');
}

export const pool = new Pool({
  connectionString,
  max: 20, // Increase from default 10 to handle concurrent telemetry
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Fail fast if pool is exhausted
});

// Helper function for manual diagnostics (invoked explicitly when needed).
export async function verifyDatabaseConnectivity() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}
