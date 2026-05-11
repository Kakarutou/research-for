import { NextRequest, NextResponse } from 'next/server';

export interface StockInfo {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  changeAmt?: number;
  isAfterHours?: boolean;
  regularPrice?: number;
  session?: 'PRE' | 'POST' | 'REGULAR';
}

function parseKoreanCode(ticker: string): string | null {
  const m = ticker.match(/^(\d{6})\.(KS|KQ)$/i);
  if (m) return m[1];
  if (/^\d{6}$/.test(ticker)) return ticker;
  return null;
}

const NAVER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://m.stock.naver.com/',
};

async function fetchNaverInfo(code: string): Promise<StockInfo | null> {
  const res = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
    headers: NAVER_HEADERS,
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const d = await res.json();

  const name: string = d.stockName;
  const sign = (field: { name?: string } | undefined) => field?.name === 'FALLING' ? -1 : 1;

  const regularPrice = Number(String(d.closePrice).replace(/,/g, ''));
  const regularChangePct = parseFloat(d.fluctuationsRatio) * sign(d.compareToPreviousPrice);
  const regularChangeAmt = Number(String(d.compareToPreviousClosePrice).replace(/,/g, '')) * sign(d.compareToPreviousPrice);

  const over = d.overMarketPriceInfo;
  const overPrice = over?.overPrice ? Number(String(over.overPrice).replace(/,/g, '')) : 0;

  if (overPrice > 0) {
    return {
      symbol: code,
      name,
      price: overPrice,
      changePct: parseFloat(over.fluctuationsRatio) * sign(over.compareToPreviousPrice),
      changeAmt: Number(String(over.compareToPreviousClosePrice).replace(/,/g, '')) * sign(over.compareToPreviousPrice),
      isAfterHours: true,
      regularPrice,
    };
  }

  return { symbol: code, name, price: regularPrice, changePct: regularChangePct, changeAmt: regularChangeAmt, isAfterHours: false };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;

  const krCode = parseKoreanCode(ticker);
  if (krCode) {
    const info = await fetchNaverInfo(krCode).catch(() => null);
    return NextResponse.json(info);
  }

  // Yahoo Finance for US stocks / crypto
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=5m&range=1d&includePrePost=true`,
      { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, cache: 'no-store' },
    );
    if (!res.ok) return NextResponse.json(null);
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return NextResponse.json(null);

    const meta = result.meta;
    const name: string = meta.shortName || meta.longName || ticker.toUpperCase();
    const regularPrice: number = meta.regularMarketPrice;
    const previousClose: number = meta.chartPreviousClose ?? regularPrice;

    // Determine session from last candle timestamp vs currentTradingPeriod
    const timestamps: number[] = result.timestamp ?? [];
    const closes: (number | null)[] = result.indicators.quote[0].close ?? [];
    const validPairs = timestamps
      .map((ts, i) => ({ ts, close: closes[i] }))
      .filter((p): p is { ts: number; close: number } => p.close != null);

    const tp = meta.currentTradingPeriod;
    const lastTs = validPairs.at(-1)?.ts ?? 0;
    const lastClose = validPairs.at(-1)?.close ?? regularPrice;

    const inPre  = tp?.pre  && lastTs >= tp.pre.start  && lastTs < tp.pre.end;
    const inPost = tp?.post && lastTs >= tp.post.start && lastTs <= tp.post.end;
    const isExtended = (inPre || inPost) && lastClose !== regularPrice;

    const price  = isExtended ? lastClose : regularPrice;
    const changePct = ((price - previousClose) / previousClose) * 100;
    const changeAmt = price - previousClose;

    return NextResponse.json({
      symbol: ticker.toUpperCase(),
      name,
      price,
      changePct,
      changeAmt,
      isAfterHours: !!isExtended,
      regularPrice: isExtended ? regularPrice : undefined,
      session: inPre ? 'PRE' : inPost ? 'POST' : 'REGULAR',
    } satisfies StockInfo);
  } catch {
    return NextResponse.json(null);
  }
}
