import { NextResponse } from 'next/server';
import { z } from 'zod';
import { findUserByEmail } from '../../../../lib/auth/user';
import { verifyPassword } from '../../../../lib/auth/password';
import { createSessionToken, setSessionCookie } from '../../../../lib/auth/session';

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = signinSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { message: 'Invalid payload', errors: parseResult.error.flatten() },
        { status: 400 },
      );
    }

    const { email, password } = parseResult.data;
    const user = await findUserByEmail(email);

    if (!user) {
      return NextResponse.json({ message: 'Invalid credentials.' }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ message: 'Invalid credentials.' }, { status: 401 });
    }

    const sessionToken = await createSessionToken(user.user_id, user.email);
    const response = NextResponse.json(
      {
        message: 'Signed in successfully.',
        user: {
          id: user.user_id,
          email: user.email,
        },
      },
      { status: 200 },
    );

    setSessionCookie(response, sessionToken);
    return response;
  } catch (error) {
    console.error('Signin error:', error);
    return NextResponse.json(
      { message: 'Unable to sign in.', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
