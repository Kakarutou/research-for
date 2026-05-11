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

function yahooLabel(ts: number, range: string): string {
  const d = new Date(ts * 1000);
  if (range === '1d') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (range === '5d') return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function naverDateStr(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}000000`;
}

function parseKoreanCode(ticker: string): string | null {
  const m = ticker.match(/^(\d{6})\.(KS|KQ)$/i);
  if (m) return m[1];
  if (/^\d{6}$/.test(ticker)) return ticker;
  return null;
}

export interface ChartResponse {
  data: { date: string; close: number; volume: number }[];
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
  const end = naverDateStr(now);
  const start = new Date(now);
  if (range === '1d')       start.setDate(now.getDate() - 10);
  else if (range === '5d')  start.setDate(now.getDate() - 14);
  else if (range === '1mo') start.setMonth(now.getMonth() - 1);
  else if (range === '3mo') start.setMonth(now.getMonth() - 3);
  else if (range === '1y')  start.setFullYear(now.getFullYear() - 1);
  else                      start.setMonth(now.getMonth() - 1);

  const [chartRes, basicRes] = await Promise.all([
    fetch(`https://api.stock.naver.com/chart/domestic/item/${code}/day?startDateTime=${naverDateStr(start)}&endDateTime=${end}`, {
      headers: NAVER_HEADERS, cache: 'no-store',
    }),
    fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
      headers: NAVER_HEADERS, cache: 'no-store',
    }),
  ]);

  if (!chartRes.ok || !basicRes.ok) return null;
  const chartData: { localDate: string; closePrice: number; accumulatedTradingVolume: number }[] = await chartRes.json();
  const basic = await basicRes.json();

  const data = chartData.map(item => ({
    date: `${parseInt(item.localDate.slice(4, 6))}/${parseInt(item.localDate.slice(6, 8))}`,
    close: item.closePrice,
    volume: item.accumulatedTradingVolume,
  }));

  const sign = (f: { name?: string } | undefined) => f?.name === 'FALLING' ? -1 : 1;
  const regularPrice = Number(String(basic.closePrice).replace(/,/g, ''));
  const over = basic.overMarketPriceInfo;
  const overPrice = over?.overPrice ? Number(String(over.overPrice).replace(/,/g, '')) : 0;

  const price = overPrice > 0 ? overPrice : regularPrice;
  const changePct = overPrice > 0
    ? parseFloat(over.fluctuationsRatio) * sign(over.compareToPreviousPrice)
    : parseFloat(basic.fluctuationsRatio) * sign(basic.compareToPreviousPrice);
  const changeAmt = overPrice > 0
    ? Number(String(over.compareToPreviousClosePrice).replace(/,/g, '')) * sign(over.compareToPreviousPrice)
    : Number(String(basic.compareToPreviousClosePrice).replace(/,/g, '')) * sign(basic.compareToPreviousPrice);

  return {
    data,
    price,
    changePct,
    changeAmt,
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
    const quote = result.indicators.quote[0];
    const data = timestamps
      .map((ts, i) => ({ date: yahooLabel(ts, range), close: quote.close[i], volume: quote.volume[i] ?? 0 }))
      .filter((d): d is { date: string; close: number; volume: number } => d.close != null);

    const meta = result.meta;
    const price = meta.regularMarketPrice as number;
    let changePct: number = meta.regularMarketChangePercent ?? 0;
    let changeAmt: number = meta.regularMarketChange ?? 0;
    if (!changePct && data.length >= 2) {
      const prev = data[data.length - 2].close;
      const curr = data[data.length - 1].close;
      changePct = ((curr - prev) / prev) * 100;
      changeAmt = curr - prev;
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
