import { getDb } from './mongodb';

export interface Bet {
  id: string;
  userId: string;
  market: string;
  side: 'long' | 'short';
  amount: number;
  kstDate: string;
  placedAt: string;
  settled: boolean;
  won?: boolean;
  payout?: number;
}

export async function addBet(data: Omit<Bet, 'id' | 'settled'>): Promise<Bet> {
  const db = await getDb();
  const bet: Bet = { ...data, id: crypto.randomUUID(), settled: false };
  await db.collection<Bet>('bets').insertOne(bet);
  return bet;
}

export async function getBetsForMarketDate(market: string, kstDate: string): Promise<Bet[]> {
  const db = await getDb();
  return db.collection<Bet>('bets').find({ market, kstDate }).toArray();
}

export async function getUserBets(userId: string, limit = 30): Promise<Bet[]> {
  const db = await getDb();
  return db.collection<Bet>('bets')
    .find({ userId })
    .sort({ placedAt: -1 })
    .limit(limit)
    .toArray();
}

export async function getUserBetForDate(userId: string, kstDate: string): Promise<Bet | null> {
  const db = await getDb();
  return db.collection<Bet>('bets').findOne({ userId, kstDate });
}

export async function settleBatch(
  market: string,
  kstDate: string,
  isUp: boolean,
): Promise<{ userId: string; payout: number }[]> {
  const db = await getDb();
  const bets = await db.collection<Bet>('bets').find({ market, kstDate, settled: false }).toArray();
  if (bets.length === 0) return [];

  const winningSide = isUp ? 'long' : 'short';
  const winners = bets.filter(b => b.side === winningSide);
  const losers  = bets.filter(b => b.side !== winningSide);

  const loserPool   = losers.reduce((sum, b) => sum + b.amount, 0);
  const profitEach  = winners.length > 0 ? Math.floor(loserPool / winners.length) : 0;
  const winnerPayout = winners.length > 0 ? bets[0].amount + profitEach : 0;

  const payouts: { userId: string; payout: number }[] = [];

  for (const bet of bets) {
    const isWinner = bet.side === winningSide;
    const payout   = isWinner ? winnerPayout : 0;
    await db.collection<Bet>('bets').updateOne(
      { id: bet.id },
      { $set: { settled: true, won: isWinner, payout } }
    );
    payouts.push({ userId: bet.userId, payout });
  }

  return payouts;
}
