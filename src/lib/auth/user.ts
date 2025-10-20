import { pool } from '../database/connection';

export type UserRecord = {
  user_id: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
};

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const normalisedEmail = email.trim().toLowerCase();
  const client = await pool.connect();
  try {
    const result = await client.query<UserRecord>(
      `SELECT user_id, email, password_hash, created_at, updated_at
       FROM "UserAccount"
       WHERE email = $1`,
      [normalisedEmail],
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function createUser(email: string, passwordHash: string): Promise<UserRecord> {
  const normalisedEmail = email.trim().toLowerCase();
  const client = await pool.connect();
  try {
    const result = await client.query<UserRecord>(
      `INSERT INTO "UserAccount" (email, password_hash)
       VALUES ($1, $2)
       RETURNING user_id, email, password_hash, created_at, updated_at`,
      [normalisedEmail, passwordHash],
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}
