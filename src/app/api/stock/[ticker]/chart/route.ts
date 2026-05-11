import { NextRequest, NextResponse } from 'next/server';

// tf → Yahoo Finance fetch config
const TF: Record<string, { interval: string; range: string; aggMin?: number }> = {
  '1m':   { interval: '1m',  range: '1d' },
  '3m':   { interval: '1m',  range: '2d',  aggMin: 3 },
  '5m':   { interval: '5m',  range: '5d' },
  '10m':  { interval: '5m',  range: '5d',  aggMin: 10 },
  '15m':  { interval: '15m', range: '5d' },
  '30m':  { interval: '30m', range: '1mo' },
  '60m':  { interval: '60m', range: '1mo' },
  '120m': { interval: '60m', range: '3mo', aggMin: 120 },
  '240m': { interval: '60m', range: '3mo', aggMin: 240 },
  '1d':   { interval: '1d',  range: '1y' },
  '1w':   { interval: '1wk', range: '2y' },
  '1mo':  { interval: '1mo', range: '5y' },
  '1y':   { interval: '1mo', range: 'max', aggMin: -1 }, // -1 = group by year
};

const NAVER_TF: Record<string, number> = {
  '1d': 1, '1w': 7, '1mo': 30, '1y': 365,
};

const NAVER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://m.stock.naver.com/',
};

export interface ChartPoint {
  time: number;
  open: number; high: number; low: number; close: number;
  volume: number;
}

export interface ChartResponse {
  data: ChartPoint[];
  price: number; changePct: number; changeAmt: number;
  name: string; symbol: string;
  isAfterHours?: boolean; regularPrice?: number;
  isIntraday: boolean;
}

function aggregateMin(data: ChartPoint[], minutes: number): ChartPoint[] {
  const out: ChartPoint[] = [];
  const bucket = minutes * 60;
  let i = 0;
  while (i < data.length) {
    const slot = Math.floor(data[i].time / bucket) * bucket;
    const grp: ChartPoint[] = [];
    while (i < data.length && Math.floor(data[i].time / bucket) * bucket === slot) grp.push(data[i++]);
    out.push({
      time: slot,
      open: grp[0].open,
      high: Math.max(...grp.map(d => d.high)),
      low:  Math.min(...grp.map(d => d.low)),
      close: grp[grp.length - 1].close,
      volume: grp.reduce((s, d) => s + d.volume, 0),
    });
  }
  return out;
}

function aggregateYearly(data: ChartPoint[]): ChartPoint[] {
  const map = new Map<number, ChartPoint[]>();
  for (const d of data) {
    const yr = new Date(d.time * 1000).getUTCFullYear();
    if (!map.has(yr)) map.set(yr, []);
    map.get(yr)!.push(d);
  }
  return [...map.entries()].sort(([a], [b]) => a - b).map(([yr, pts]) => ({
    time:   Math.floor(Date.UTC(yr, 0, 1) / 1000),
    open:   pts[0].open,
    high:   Math.max(...pts.map(d => d.high)),
    low:    Math.min(...pts.map(d => d.low)),
    close:  pts[pts.length - 1].close,
    volume: pts.reduce((s, d) => s + d.volume, 0),
  }));
}

function parseKoreanCode(ticker: string): string | null {
  const m = ticker.match(/^(\d{6})\.(KS|KQ)$/i);
  if (m) return m[1];
  if (/^\d{6}$/.test(ticker)) return ticker;
  return null;
}

function naverDateStr(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}000000`;
}

async function fetchNaverChart(code: string, tf: string): Promise<ChartResponse | null> {
  if (!NAVER_TF[tf]) return null; // intraday not supported for KR

  const now = new Date();
  const start = new Date(now);
  const days = NAVER_TF[tf];
  if (tf === '1y') start.setFullYear(now.getFullYear() - 5);
  else start.setDate(now.getDate() - days * 60);

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

  let data: ChartPoint[] = raw.map(r => ({
    time:   Math.floor(Date.UTC(+r.localDate.slice(0,4), +r.localDate.slice(4,6)-1, +r.localDate.slice(6,8)) / 1000),
    open:   r.openPrice, high: r.highPrice, low: r.lowPrice, close: r.closePrice,
    volume: r.accumulatedTradingVolume,
  }));

  if (tf === '1w')  data = aggregateMin(data, 7 * 24 * 60);
  if (tf === '1mo') data = aggregateMin(data, 30 * 24 * 60);
  if (tf === '1y')  data = aggregateYearly(data);

  const sign = (f: { name?: string } | undefined) => f?.name === 'FALLING' ? -1 : 1;
  const regularPrice = Number(String(basic.closePrice).replace(/,/g, ''));
  const over = basic.overMarketPriceInfo;
  const overPrice = over?.overPrice ? Number(String(over.overPrice).replace(/,/g, '')) : 0;

  return {
    data,
    price:     overPrice > 0 ? overPrice : regularPrice,
    changePct: overPrice > 0 ? parseFloat(over.fluctuationsRatio) * sign(over.compareToPreviousPrice) : parseFloat(basic.fluctuationsRatio) * sign(basic.compareToPreviousPrice),
    changeAmt: overPrice > 0 ? Number(String(over.compareToPreviousClosePrice).replace(/,/g, '')) * sign(over.compareToPreviousPrice) : Number(String(basic.compareToPreviousClosePrice).replace(/,/g, '')) * sign(basic.compareToPreviousPrice),
    name: basic.stockName, symbol: code,
    isAfterHours: overPrice > 0,
    regularPrice: overPrice > 0 ? regularPrice : undefined,
    isIntraday: false,
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const tf = new URL(req.url).searchParams.get('tf') || '1d';

  const krCode = parseKoreanCode(ticker);
  if (krCode) {
    const result = await fetchNaverChart(krCode, tf).catch(() => null);
    if (!result) return NextResponse.json({ error: 'intraday_unavailable' });
    return NextResponse.json(result);
  }

  const cfg = TF[tf];
  if (!cfg) return NextResponse.json(null);

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${cfg.interval}&range=${cfg.range}`,
      { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, cache: 'no-store' },
    );
    if (!res.ok) return NextResponse.json(null);
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return NextResponse.json(null);

    const timestamps: number[] = result.timestamp ?? [];
    const q = result.indicators.quote[0];
    let data: ChartPoint[] = timestamps
      .map((ts, i) => ({ time: ts, open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume[i] ?? 0 }))
      .filter(d => d.close != null && d.open != null && d.high != null && d.low != null);

    if (cfg.aggMin && cfg.aggMin > 0) data = aggregateMin(data, cfg.aggMin);
    if (cfg.aggMin === -1) data = aggregateYearly(data);

    const meta = result.meta;
    const price: number = meta.regularMarketPrice;
    let changePct: number = meta.regularMarketChangePercent ?? 0;
    let changeAmt: number = meta.regularMarketChange ?? 0;
    if (!changePct && data.length >= 2) {
      changePct = ((data.at(-1)!.close - data.at(-2)!.close) / data.at(-2)!.close) * 100;
      changeAmt = data.at(-1)!.close - data.at(-2)!.close;
    }

    const isIntraday = !['1d', '1w', '1mo', '1y'].includes(tf);
    return NextResponse.json({
      data, price, changePct, changeAmt,
      name: (meta.shortName || meta.longName || ticker.toUpperCase()) as string,
      symbol: ticker.toUpperCase(),
      isIntraday,
    } satisfies ChartResponse);
  } catch {
    return NextResponse.json(null);
  }
}
