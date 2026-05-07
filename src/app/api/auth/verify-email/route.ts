import { NextRequest, NextResponse } from 'next/server';
import { findByEmail, updateUser } from '@/lib/userStore';
import { signToken } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  const { email, code } = await req.json();

  if (!email || !code)
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const user = await findByEmail(email);
  if (!user)
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  if (user.emailVerified)
    return NextResponse.json({ error: 'This account is already verified.' }, { status: 409 });

  if (!user.emailVerifyCode || user.emailVerifyCode !== code)
    return NextResponse.json({ error: 'Incorrect verification code.' }, { status: 400 });

  if (user.emailVerifyExpiry && new Date(user.emailVerifyExpiry) < new Date())
    return NextResponse.json({ error: 'Verification code has expired. Please register again.' }, { status: 400 });

  const updated = await updateUser(user.id, {
    emailVerified: true,
    emailVerifyCode: undefined,
    emailVerifyExpiry: undefined,
  });

  if (!updated) return NextResponse.json({ error: 'An error occurred.' }, { status: 500 });

  const token = await signToken({ id: updated.id, email: updated.email, username: updated.username, role: updated.role });

  return NextResponse.json({
    token,
    user: { id: updated.id, email: updated.email, username: updated.username, rfcBalance: updated.rfcBalance, role: updated.role },
  });
}
