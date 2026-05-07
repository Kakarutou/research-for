import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { verifyToken } from '@/lib/jwt';
import { findById, findByUsername, updateUser } from '@/lib/userStore';
import { signToken } from '@/lib/jwt';

export async function PATCH(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer '))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const payload = await verifyToken(auth.slice(7));
    const user = await findById(String(payload.id));
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.username !== undefined) {
      const u = String(body.username).trim();
      if (u.length < 2 || u.length > 20)
        return NextResponse.json({ error: 'Username must be 2–20 characters.' }, { status: 400 });
      const taken = await findByUsername(u);
      if (taken && taken.id !== user.id)
        return NextResponse.json({ error: 'This username is already taken.' }, { status: 409 });
      updates.username = u;
    }

    if (body.newPassword !== undefined) {
      if (!body.currentPassword)
        return NextResponse.json({ error: 'Please enter your current password.' }, { status: 400 });
      const match = await bcrypt.compare(String(body.currentPassword), user.passwordHash);
      if (!match)
        return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
      if (String(body.newPassword).length < 6)
        return NextResponse.json({ error: 'New password must be at least 6 characters.' }, { status: 400 });
      updates.passwordHash = await bcrypt.hash(String(body.newPassword), 10);
    }

    if (Object.keys(updates).length === 0)
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });

    const updated = await updateUser(user.id, updates);
    if (!updated) return NextResponse.json({ error: 'An error occurred.' }, { status: 500 });

    const token = await signToken({ id: updated.id, email: updated.email, username: updated.username, role: updated.role });

    return NextResponse.json({
      token,
      user: { id: updated.id, email: updated.email, username: updated.username, rfcBalance: updated.rfcBalance, role: updated.role },
    });
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}
