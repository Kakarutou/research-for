import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { findById, updateUser } from '@/lib/userStore';

function getKSTDate() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function calcStreak(dates: string[], today: string): number {
  if (!dates.includes(today)) return 0;
  let streak = 1;
  const cursor = new Date(today);
  while (true) {
    cursor.setDate(cursor.getDate() - 1);
    const d = cursor.toISOString().slice(0, 10);
    if (dates.includes(d)) streak++;
    else break;
  }
  return streak;
}

// GET: fetch attendance status
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer '))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const payload = await verifyToken(auth.slice(7));
    const user = await findById(String(payload.id));
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const today = getKSTDate();
    const dates = user.attendanceDates ?? [];
    return NextResponse.json({
      attendanceDates: dates,
      checkedToday: dates.includes(today),
      streak: calcStreak(dates, today),
      rfcBalance: user.rfcBalance,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}

// POST: check in
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer '))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const payload = await verifyToken(auth.slice(7));
    const user = await findById(String(payload.id));
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const today = getKSTDate();
    const dates = user.attendanceDates ?? [];
    if (dates.includes(today))
      return NextResponse.json({ error: 'You have already checked in today.' }, { status: 409 });

    const newDates = [...dates, today];
    const streak = calcStreak(newDates, today);
    let reward = 10;
    let bonusMsg = '';
    if (streak % 7 === 0) { reward += 20; bonusMsg = `${streak}-day streak! Bonus +20 RFC`; }

    const updated = await updateUser(user.id, {
      attendanceDates: newDates,
      rfcBalance: user.rfcBalance + reward,
    });

    return NextResponse.json({
      ok: true, reward, bonusMsg, streak,
      rfcBalance: updated!.rfcBalance,
      attendanceDates: updated!.attendanceDates,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}
