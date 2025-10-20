import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies as nextCookies } from 'next/headers';
import type { NextResponse } from 'next/server';

export const SESSION_COOKIE_NAME = 'sgm_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

type BaseSessionPayload = {
  sub: string;
  email: string;
  iat: number;
  exp: number;
};

function getSecret(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is not set.');
  }
  return Buffer.from(secret, 'utf-8');
}

function encodePayload(payload: BaseSessionPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
}

function decodePayload(encoded: string): BaseSessionPayload | null {
  try {
    const buffer = Buffer.from(encoded, 'base64url');
    const parsed = JSON.parse(buffer.toString('utf-8')) as BaseSessionPayload;
    if (
      typeof parsed.sub !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.iat !== 'number' ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function sign(encodedPayload: string): string {
  const secret = getSecret();
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

export async function createSessionToken(userId: string, email: string): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: BaseSessionPayload = {
    sub: userId,
    email,
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_SECONDS,
  };

  const encodedPayload = encodePayload(payload);
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export type SessionUser = {
  userId: string;
  email: string;
};

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  const providedSig = Buffer.from(signature, 'base64url');
  const expectedSig = Buffer.from(expectedSignature, 'base64url');

  if (providedSig.length !== expectedSig.length || !timingSafeEqual(providedSig, expectedSig)) {
    return null;
  }

  const payload = decodePayload(encodedPayload);
  if (!payload) {
    return null;
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return {
    userId: payload.sub,
    email: payload.email,
  };
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });
}

export async function getSessionFromCookies(): Promise<SessionUser | null> {
  const store = await nextCookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}
