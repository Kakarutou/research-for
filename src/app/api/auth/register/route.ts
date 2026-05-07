import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findByEmail, findByUsername, createUser } from '@/lib/userStore';
import { sendVerificationEmail } from '@/lib/mailer';

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  const { email, username, password } = await req.json();

  if (!email || !username || !password)
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });

  if (password.length < 6)
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });

  if (username.length < 2 || username.length > 20)
    return NextResponse.json({ error: 'Username must be 2–20 characters.' }, { status: 400 });

  if (await findByEmail(email))
    return NextResponse.json({ error: 'This email is already in use.' }, { status: 409 });

  if (await findByUsername(username))
    return NextResponse.json({ error: 'This username is already taken.' }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  const code = generateCode();
  const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await createUser({
    email, username, passwordHash,
    emailVerified: false,
    emailVerifyCode: code,
    emailVerifyExpiry: expiry,
  });

  await sendVerificationEmail(email, username, code);

  return NextResponse.json({ ok: true, message: 'Verification code sent to your email.' });
}
