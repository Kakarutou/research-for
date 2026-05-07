import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { findById, updateUser } from '@/lib/userStore';
import { isBettingOpen, shouldSettle } from '@/lib/marketSchedule';
import {
  addBet, getUserBetForDate, getUserBets, getBetsForMarketDate, settleBatch,
} from '@/lib/betsStore';

function getKST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export const BET_AMOUNT = 100;
const VALID_MARKETS = ['NASDAQ', 'KOSPI', 'N225', 'BTC'];

async function fetchIsUp(marketId: string): Promise<boolean | null> {
  try {
    if (marketId === 'BTC') {
      const r = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true',
        { cache: 'no-store' },
      );
      if (!r.ok) return null;
      const j = await r.json();
      return (j.bitcoin.usd_24h_change ?? 0) >= 0;
    }
    const sym = { NASDAQ: '^IXIC', KOSPI: '^KS11', N225: '^N225' }[marketId];
    if (!sym) return null;
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=2d`,
      { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, cache: 'no-store' },
    );
    if (!r.ok) return null;
    const j = await r.json();
    const meta = j.chart.result[0].meta;
    return (meta.regularMarketPrice as number) >= (meta.previousClose ?? meta.chartPreviousClose);
  } catch { return null; }
}

async function trySettle(userId: string): Promise<void> {
  const myBets = (await getUserBets(userId, 60)).filter(b => !b.settled);
  if (myBets.length === 0) return;

  const buckets = new Set(myBets.map(b => `${b.market}|${b.kstDate}`));
  for (const key of buckets) {
    const [market, kstDate] = key.split('|');
    if (!shouldSettle(market, kstDate)) continue;

    const existing = await getBetsForMarketDate(market, kstDate);
    if (existing.every(b => b.settled)) continue;

    const isUp = await fetchIsUp(market);
    if (isUp === null) continue;

    const payouts = await settleBatch(market, kstDate, isUp);
    for (const { userId: uid, payout } of payouts) {
      if (payout > 0) {
        const u = await findById(uid);
        if (u) await updateUser(uid, { rfcBalance: u.rfcBalance + payout });
      }
    }
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return NextResponse.json({ bet: null });

  try {
    const payload = await verifyToken(auth.slice(7));
    const userId = String(payload.id);
    await trySettle(userId);

    const user = await findById(userId);
    if (!user) return NextResponse.json({ bet: null });

    const bet = await getUserBetForDate(userId, getKST());
    return NextResponse.json({ bet: bet ?? null, rfcBalance: user.rfcBalance });
  } catch {
    return NextResponse.json({ bet: null });
  }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer '))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const payload = await verifyToken(auth.slice(7));
    const userId = String(payload.id);
    const user = await findById(userId);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const today = getKST();
    if (await getUserBetForDate(userId, today))
      return NextResponse.json({ error: 'You have already placed a bet today.' }, { status: 409 });

    const { market, side } = await req.json();
    if (!VALID_MARKETS.includes(market) || !['long', 'short'].includes(side))
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

    if (!isBettingOpen(market))
      return NextResponse.json({ error: 'Betting is not open for this market right now.' }, { status: 400 });

    if (user.rfcBalance < BET_AMOUNT)
      return NextResponse.json({ error: 'Insufficient RFC balance.' }, { status: 400 });

    const updated = await updateUser(userId, { rfcBalance: user.rfcBalance - BET_AMOUNT });
    const bet = await addBet({
      userId, market, side: side as 'long' | 'short',
      amount: BET_AMOUNT, kstDate: today, placedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, bet, rfcBalance: updated!.rfcBalance });
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer '))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const payload = await verifyToken(auth.slice(7));
    const userId = String(payload.id);
    await trySettle(userId);
    const bets = await getUserBets(userId, 20);
    return NextResponse.json({ bets });
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}
