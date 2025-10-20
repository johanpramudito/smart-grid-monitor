import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createUser, findUserByEmail } from '../../../../lib/auth/user';
import { hashPassword } from '../../../../lib/auth/password';
import { createSessionToken, setSessionCookie } from '../../../../lib/auth/session';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = signupSchema.safeParse(body);

    if (!parseResult.success) {
      const flattened = parseResult.error.flatten();
      const fieldMessages = Object.values(flattened.fieldErrors).flat().filter(Boolean) as string[];
      const detailMessage = flattened.formErrors[0] ?? fieldMessages[0] ?? 'Invalid payload';

      return NextResponse.json(
        { message: detailMessage, errors: flattened },
        { status: 400 },
      );
    }

    const { email, password } = parseResult.data;

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { message: 'An account with this email already exists.' },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser(email, passwordHash);

    const sessionToken = await createSessionToken(user.user_id, user.email);
    const response = NextResponse.json(
      {
        message: 'Account created successfully.',
        user: {
          id: user.user_id,
          email: user.email,
        },
      },
      { status: 201 },
    );

    setSessionCookie(response, sessionToken);
    return response;
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { message: 'Unable to create account.', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
