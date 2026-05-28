import { NextResponse } from 'next/server';

export interface IndexQuote {
  id: string;
  name: string;
  symbol: string;
  price: string;
  rawPrice: number;
  change: string;
  changePct: number;
  isUp: boolean;
}

export interface CountryGroup {
  region: string;
  indices: IndexQuote[];
}

// 지역별 지수 세트 (Yahoo Finance 심볼)
const COUNTRIES = [
  { region: 'US', indices: [
    { id: 'SPX',  name: 'S&P 500',   symbol: '^GSPC'     },
    { id: 'IXIC', name: 'Nasdaq',    symbol: '^IXIC'     },
    { id: 'DJI',  name: 'Dow Jones', symbol: '^DJI'      },
  ]},
  { region: 'Europe', indices: [
    { id: 'STOXX', name: 'STOXX 50',  symbol: '^STOXX50E' },
    { id: 'DAX',   name: 'DAX',       symbol: '^GDAXI'    },
    { id: 'FTSE',  name: 'FTSE 100',  symbol: '^FTSE'     },
  ]},
  { region: 'Korea', indices: [
    { id: 'KOSPI',  name: 'KOSPI',  symbol: '^KS11' },
    { id: 'KOSDAQ', name: 'KOSDAQ', symbol: '^KQ11' },
  ]},
  { region: 'China', indices: [
    { id: 'SSEC',   name: 'Shanghai', symbol: '000001.SS' },
    { id: 'CSI300', name: 'CSI 300',  symbol: '000300.SS' },
  ]},
  { region: 'Hong Kong', indices: [
    { id: 'HSI', name: 'Hang Seng', symbol: '^HSI' },
  ]},
  { region: 'Japan', indices: [
    { id: 'N225', name: 'Nikkei 225', symbol: '^N225' },
  ]},
  { region: 'Crypto', indices: [
    { id: 'BTC', name: 'Bitcoin',  symbol: 'BTC-USD' },
    { id: 'ETH', name: 'Ethereum', symbol: 'ETH-USD' },
  ]},
  { region: 'Others', indices: [
    { id: 'RUT', name: 'Russell 2000', symbol: '^RUT' },
    { id: 'VIX', name: 'VIX',          symbol: '^VIX' },
  ]},
  { region: 'Metals', indices: [
    { id: 'GOLD',   name: 'Gold',   symbol: 'GC=F' },
    { id: 'SILVER', name: 'Silver', symbol: 'SI=F' },
    { id: 'COPPER', name: 'Copper', symbol: 'HG=F' },
  ]},
  { region: 'Energy', indices: [
    { id: 'WTI',    name: 'WTI',     symbol: 'CL=F' },
    { id: 'BRENT',  name: 'Brent',   symbol: 'BZ=F' },
    { id: 'NATGAS', name: 'Nat Gas', symbol: 'NG=F' },
  ]},
] as const;

async function fetchYahoo(symbol: string): Promise<{ rawPrice: number; changePct: number }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Yahoo ${symbol} ${res.status}`);
  const json = await res.json();
  const meta = json.chart.result[0].meta;
  const rawPrice: number = meta.regularMarketPrice;

  if (meta.regularMarketChangePercent != null) {
    return { rawPrice, changePct: meta.regularMarketChangePercent };
  }

  const closes: (number | null)[] = json.chart.result[0].indicators.quote[0].close ?? [];
  const valid = closes.filter((c): c is number => c != null);
  let prevClose: number | null = null;
  if (valid.length >= 2) prevClose = valid[valid.length - 2];
  else if (valid.length === 1) prevClose = valid[0];
  if (prevClose != null) {
    return { rawPrice, changePct: ((rawPrice - prevClose) / prevClose) * 100 };
  }

  const prev: number = meta.previousClose ?? meta.chartPreviousClose;
  return { rawPrice, changePct: ((rawPrice - prev) / prev) * 100 };
}

function fmt(price: number): string {
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

export async function GET() {
  try {
    // 모든 심볼을 한 번에 병렬 요청
    const flat = COUNTRIES.flatMap(c => c.indices.map(idx => idx.symbol));
    const settled = await Promise.allSettled(flat.map(fetchYahoo));

    const quoteBySymbol = new Map<string, { rawPrice: number; changePct: number }>();
    flat.forEach((sym, i) => {
      const r = settled[i];
      quoteBySymbol.set(sym, r.status === 'fulfilled' ? r.value : { rawPrice: 0, changePct: 0 });
    });

    const data: CountryGroup[] = COUNTRIES.map(c => ({
      region: c.region,
      indices: c.indices.map(idx => {
        const v = quoteBySymbol.get(idx.symbol) ?? { rawPrice: 0, changePct: 0 };
        return {
          id: idx.id,
          name: idx.name,
          symbol: idx.symbol,
          rawPrice: v.rawPrice,
          changePct: v.changePct,
          price: v.rawPrice ? fmt(v.rawPrice) : '—',
          change: v.rawPrice ? fmtPct(v.changePct) : '—',
          isUp: v.changePct >= 0,
        };
      }),
    }));

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
