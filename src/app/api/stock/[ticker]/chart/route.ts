import { NextRequest, NextResponse } from 'next/server';

const RANGE_INTERVAL: Record<string, string> = {
  '1d':  '5m',
  '5d':  '30m',
  '1mo': '1d',
  '3mo': '1d',
  '1y':  '1wk',
};

const NAVER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://m.stock.naver.com/',
};

function naverDateStr(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}000000`;
}

function naverDateToUnix(s: string): number {
  return Math.floor(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)) / 1000);
}

function parseKoreanCode(ticker: string): string | null {
  const m = ticker.match(/^(\d{6})\.(KS|KQ)$/i);
  if (m) return m[1];
  if (/^\d{6}$/.test(ticker)) return ticker;
  return null;
}

export interface ChartPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartResponse {
  data: ChartPoint[];
  price: number;
  changePct: number;
  changeAmt: number;
  name: string;
  symbol: string;
  isAfterHours?: boolean;
  regularPrice?: number;
}

async function fetchNaverChart(code: string, range: string): Promise<ChartResponse | null> {
  const now = new Date();
  const start = new Date(now);
  if      (range === '1d')  start.setDate(now.getDate() - 10);
  else if (range === '5d')  start.setDate(now.getDate() - 14);
  else if (range === '1mo') start.setMonth(now.getMonth() - 1);
  else if (range === '3mo') start.setMonth(now.getMonth() - 3);
  else if (range === '1y')  start.setFullYear(now.getFullYear() - 1);
  else                      start.setMonth(now.getMonth() - 1);

  const [chartRes, basicRes] = await Promise.all([
    fetch(`https://api.stock.naver.com/chart/domestic/item/${code}/day?startDateTime=${naverDateStr(start)}&endDateTime=${naverDateStr(now)}`, {
      headers: NAVER_HEADERS, cache: 'no-store',
    }),
    fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
      headers: NAVER_HEADERS, cache: 'no-store',
    }),
  ]);
  if (!chartRes.ok || !basicRes.ok) return null;

  const raw: { localDate: string; openPrice: number; highPrice: number; lowPrice: number; closePrice: number; accumulatedTradingVolume: number }[] = await chartRes.json();
  const basic = await basicRes.json();

  const data: ChartPoint[] = raw.map(r => ({
    time:   naverDateToUnix(r.localDate),
    open:   r.openPrice,
    high:   r.highPrice,
    low:    r.lowPrice,
    close:  r.closePrice,
    volume: r.accumulatedTradingVolume,
  }));

  const sign = (f: { name?: string } | undefined) => f?.name === 'FALLING' ? -1 : 1;
  const regularPrice = Number(String(basic.closePrice).replace(/,/g, ''));
  const over = basic.overMarketPriceInfo;
  const overPrice = over?.overPrice ? Number(String(over.overPrice).replace(/,/g, '')) : 0;

  return {
    data,
    price:     overPrice > 0 ? overPrice : regularPrice,
    changePct: overPrice > 0 ? parseFloat(over.fluctuationsRatio) * sign(over.compareToPreviousPrice) : parseFloat(basic.fluctuationsRatio) * sign(basic.compareToPreviousPrice),
    changeAmt: overPrice > 0 ? Number(String(over.compareToPreviousClosePrice).replace(/,/g, '')) * sign(over.compareToPreviousPrice) : Number(String(basic.compareToPreviousClosePrice).replace(/,/g, '')) * sign(basic.compareToPreviousPrice),
    name: basic.stockName,
    symbol: code,
    isAfterHours: overPrice > 0,
    regularPrice: overPrice > 0 ? regularPrice : undefined,
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const range = new URL(req.url).searchParams.get('range') || '1mo';

  const krCode = parseKoreanCode(ticker);
  if (krCode) {
    const result = await fetchNaverChart(krCode, range).catch(() => null);
    return NextResponse.json(result);
  }

  // Yahoo Finance
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
    const q = result.indicators.quote[0];

    const data: ChartPoint[] = timestamps
      .map((ts, i) => ({
        time:   ts,
        open:   q.open[i],
        high:   q.high[i],
        low:    q.low[i],
        close:  q.close[i],
        volume: q.volume[i] ?? 0,
      }))
      .filter(d => d.close != null && d.open != null);

    const meta = result.meta;
    const price: number = meta.regularMarketPrice;
    let changePct: number = meta.regularMarketChangePercent ?? 0;
    let changeAmt: number = meta.regularMarketChange ?? 0;
    if (!changePct && data.length >= 2) {
      changePct = ((data.at(-1)!.close - data.at(-2)!.close) / data.at(-2)!.close) * 100;
      changeAmt = data.at(-1)!.close - data.at(-2)!.close;
    }

    return NextResponse.json({
      data, price, changePct, changeAmt,
      name: (meta.shortName || meta.longName || ticker.toUpperCase()) as string,
      symbol: ticker.toUpperCase(),
    } satisfies ChartResponse);
  } catch {
    return NextResponse.json(null);
  }
}
