import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findByEmail, updateUser } from '@/lib/userStore';
import { signToken } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password)
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });

  const user = await findByEmail(email);
  if (!user)
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid)
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (adminEmail && user.email.toLowerCase() === adminEmail && user.role !== "admin") {
    await updateUser(user.id, { role: "admin" });
    user.role = "admin";
  }

  const token = await signToken({ id: user.id, email: user.email, username: user.username, role: user.role });

  return NextResponse.json({
    token,
    user: { id: user.id, email: user.email, username: user.username, rfcBalance: user.rfcBalance, role: user.role },
  });
}
