import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const HASH_KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, HASH_KEY_LENGTH)) as Buffer;
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, hashHex] = storedHash.split(':');
  if (!saltHex || !hashHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const hash = Buffer.from(hashHex, 'hex');
  const derivedKey = (await scrypt(password, salt, HASH_KEY_LENGTH)) as Buffer;

  if (hash.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(hash, derivedKey);
}
