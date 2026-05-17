import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getKST } from '@/lib/marketSchedule';

export interface MarketStats {
  longCount: number;
  shortCount: number;
  longRFC: number;
  shortRFC: number;
}

export type StatsResponse = Record<string, MarketStats> & { totalUsers: number };

const MARKETS = ['NASDAQ', 'KOSPI', 'N225', 'HSI', 'DAX', 'BTC'];

export async function GET() {
  try {
    const db = await getDb();
    const today = getKST();

    // Only count unsettled (active) bets for the current round
    const bets = await db.collection('bets')
      .find({ kstDate: today, settled: false })
      .toArray();

    const stats: Record<string, MarketStats> = Object.fromEntries(
      MARKETS.map(m => [m, { longCount: 0, shortCount: 0, longRFC: 0, shortRFC: 0 }])
    );

    const userIds = new Set<string>();

    for (const bet of bets) {
      if (!stats[bet.market]) continue;
      userIds.add(bet.userId);
      if (bet.side === 'long') {
        stats[bet.market].longCount++;
        stats[bet.market].longRFC += bet.amount;
      } else {
        stats[bet.market].shortCount++;
        stats[bet.market].shortRFC += bet.amount;
      }
    }

    return NextResponse.json({ ...stats, totalUsers: userIds.size });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
