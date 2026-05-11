import { NextRequest, NextResponse } from 'next/server';

export interface StockInfo {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2d`,
      { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, cache: 'no-store' },
    );
    if (!res.ok) return NextResponse.json(null);
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return NextResponse.json(null);

    const meta = result.meta;
    const name: string = meta.shortName || meta.longName || ticker.toUpperCase();
    const price: number = meta.regularMarketPrice;

    let changePct: number = meta.regularMarketChangePercent ?? null;
    if (changePct == null) {
      const closes: (number | null)[] = result.indicators.quote[0].close ?? [];
      const valid = closes.filter((c): c is number => c != null);
      if (valid.length >= 2) changePct = ((price - valid[valid.length - 2]) / valid[valid.length - 2]) * 100;
      else if (valid.length === 1) changePct = ((price - valid[0]) / valid[0]) * 100;
      else changePct = 0;
    }

    return NextResponse.json({ symbol: ticker.toUpperCase(), name, price, changePct } satisfies StockInfo);
  } catch {
    return NextResponse.json(null);
  }
}
