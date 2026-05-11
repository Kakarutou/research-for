import { NextRequest, NextResponse } from 'next/server';

const RANGE_INTERVAL: Record<string, string> = {
  '1d':  '5m',
  '5d':  '30m',
  '1mo': '1d',
  '3mo': '1d',
  '1y':  '1wk',
};

function label(ts: number, range: string): string {
  const d = new Date(ts * 1000);
  if (range === '1d') {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (range === '5d') {
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export interface ChartResponse {
  data: { date: string; close: number; volume: number }[];
  price: number;
  changePct: number;
  changeAmt: number;
  name: string;
  symbol: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const range = new URL(req.url).searchParams.get('range') || '1mo';
  const interval = RANGE_INTERVAL[range] ?? '1d';

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`,
      { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, cache: 'no-store' },
    );
    if (!res.ok) return NextResponse.json(null);
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return NextResponse.json(null);

    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators.quote[0];
    const closes: (number | null)[] = quote.close ?? [];
    const volumes: (number | null)[] = quote.volume ?? [];

    const data = timestamps
      .map((ts, i) => ({ date: label(ts, range), close: closes[i], volume: volumes[i] ?? 0 }))
      .filter((d): d is { date: string; close: number; volume: number } => d.close != null);

    const meta = result.meta;
    const price = meta.regularMarketPrice as number;
    let changePct: number = meta.regularMarketChangePercent ?? 0;
    let changeAmt: number = meta.regularMarketChange ?? 0;

    // When market is closed regularMarketChangePercent can be 0 — derive from last two closes
    if (changePct === 0 && data.length >= 2) {
      const prev = data[data.length - 2].close;
      const curr = data[data.length - 1].close;
      changePct = ((curr - prev) / prev) * 100;
      changeAmt = curr - prev;
    }

    return NextResponse.json({
      data,
      price,
      changePct,
      changeAmt,
      name: (meta.shortName || meta.longName || ticker.toUpperCase()) as string,
      symbol: ticker.toUpperCase(),
    } satisfies ChartResponse);
  } catch {
    return NextResponse.json(null);
  }
}
