import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { verifyToken } from '@/lib/jwt';
import { findById, deleteUser } from '@/lib/userStore';

export async function DELETE(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer '))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const payload = await verifyToken(auth.slice(7));
    const user = await findById(String(payload.id));
    if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

    const { password } = await req.json();
    if (!password)
      return NextResponse.json({ error: 'Password is required to delete your account.' }, { status: 400 });

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid)
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 400 });

    await deleteUser(user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}
