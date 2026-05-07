import { NextResponse } from 'next/server';
import { readUsers } from '@/lib/userStore';
import { getDb } from '@/lib/mongodb';
import type { Bet } from '@/lib/betsStore';

export async function GET() {
  const [users, bets] = await Promise.all([
    readUsers(),
    getDb().then(db => db.collection<Bet>('bets').find({ settled: true }).toArray()),
  ]);

  const verified = users.filter(u => u.emailVerified);

  const statsMap: Record<string, { wins: number; total: number }> = {};
  for (const b of bets) {
    if (!statsMap[b.userId]) statsMap[b.userId] = { wins: 0, total: 0 };
    statsMap[b.userId].total++;
    if (b.won) statsMap[b.userId].wins++;
  }

  const ranked = verified
    .map(u => ({
      username: u.username,
      rfcBalance: u.rfcBalance,
      wins:  statsMap[u.id]?.wins  ?? 0,
      total: statsMap[u.id]?.total ?? 0,
      winRate: statsMap[u.id]?.total
        ? Math.round((statsMap[u.id].wins / statsMap[u.id].total) * 100)
        : null,
    }))
    .sort((a, b) => b.rfcBalance - a.rfcBalance)
    .slice(0, 20);

  return NextResponse.json(ranked);
}
