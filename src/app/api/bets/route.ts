import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { findById, updateUser } from '@/lib/userStore';
import { isBettingOpen, shouldSettle, getSettlementDate, getKST } from '@/lib/marketSchedule';
import {
  addBet, getUserBetForDate, getUnsettledBetForDate, getUserBets,
  getBetsForMarketDate, settleBatch,
} from '@/lib/betsStore';

export const BET_AMOUNT = 100;
const VALID_MARKETS = ['NASDAQ', 'KOSPI', 'N225', 'HSI', 'DAX', 'BTC'];

async function fetchIsUp(marketId: string): Promise<boolean | null> {
  try {
    if (marketId === 'BTC') {
      const r = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true',
        { cache: 'no-store' },
      );
      if (!r.ok) { console.error(`[settle] BTC fetch failed: ${r.status}`); return null; }
      const j = await r.json();
      return (j.bitcoin.usd_24h_change ?? 0) >= 0;
    }
    const sym = { NASDAQ: '^IXIC', KOSPI: '^KS11', N225: '^N225', HSI: '^HSI', DAX: '^GDAXI' }[marketId];
    if (!sym) return null;
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=2d`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Accept: 'application/json' }, cache: 'no-store' },
    );
    if (!r.ok) { console.error(`[settle] Yahoo ${marketId} fetch failed: ${r.status}`); return null; }
    const j = await r.json();
    const meta = j.chart.result[0].meta;
    const currentPrice = meta.regularMarketPrice as number;

    const closes: (number | null)[] = j.chart.result[0].indicators.quote[0].close ?? [];
    const valid = closes.filter((c): c is number => c != null);
    let prevClose: number;
    if (valid.length >= 2) {
      prevClose = valid[valid.length - 2];
    } else if (valid.length === 1) {
      prevClose = valid[0];
    } else {
      prevClose = meta.previousClose ?? meta.chartPreviousClose;
    }

    const isUp = currentPrice >= prevClose;
    console.log(`[settle] ${marketId}: price=${currentPrice} prevClose=${prevClose} isUp=${isUp}`);
    return isUp;
  } catch (e) {
    console.error(`[settle] fetchIsUp error for ${marketId}:`, e);
    return null;
  }
}

async function trySettle(userId: string): Promise<void> {
  const myBets = (await getUserBets(userId, 60)).filter(b => !b.settled);
  if (myBets.length === 0) return;

  // Group by market + kstDate + settlesOn (one round per bucket)
  const buckets = new Set(
    myBets.map(b => `${b.market}|${b.kstDate}|${b.settlesOn ?? b.kstDate}`)
  );

  for (const key of buckets) {
    const [market, kstDate, settlesOn] = key.split('|');
    if (!shouldSettle(market, settlesOn)) continue;

    const existing = await getBetsForMarketDate(market, kstDate);
    if (existing.every(b => b.settled)) continue;

    const isUp = await fetchIsUp(market);
    if (isUp === null) continue;

    const payouts = await settleBatch(market, kstDate, settlesOn, isUp);
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

    // Return the most recent bet (settled or not) for today
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

    const { market, side } = await req.json();
    if (!VALID_MARKETS.includes(market) || !['long', 'short'].includes(side))
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

    if (!isBettingOpen(market))
      return NextResponse.json({ error: 'Betting is not open for this market right now.' }, { status: 400 });

    const today = getKST();

    // Block only if there is an UNSETTLED bet for today — settled bets belong to a previous round
    if (await getUnsettledBetForDate(userId, today))
      return NextResponse.json({ error: 'You already have an active bet today.' }, { status: 409 });

    if (user.rfcBalance < BET_AMOUNT)
      return NextResponse.json({ error: 'Insufficient RFC balance.' }, { status: 400 });

    const settlesOn = getSettlementDate(market);
    const updated = await updateUser(userId, { rfcBalance: user.rfcBalance - BET_AMOUNT });
    const bet = await addBet({
      userId, market, side: side as 'long' | 'short',
      amount: BET_AMOUNT, kstDate: today, settlesOn,
      placedAt: new Date().toISOString(),
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
