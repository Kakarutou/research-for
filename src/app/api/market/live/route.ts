import { NextResponse } from 'next/server';

export interface MarketItem {
  id: string;
  name: string;
  price: string;
  rawPrice: number;
  change: string;
  changePct: number;
  isUp: boolean;
}

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

  // regularMarketChangePercent is reliable during live market hours
  if (meta.regularMarketChangePercent != null) {
    return { rawPrice, changePct: meta.regularMarketChangePercent };
  }

  // Use closes array for accurate day-over-day change.
  // range=2d returns [day1_close, day2_close] but day2 may be null if market not yet closed.
  // - If both valid (market closed): prevClose = closes[-2], today = closes[-1]
  // - If only one valid (market open/pre-market): that single value IS yesterday's close
  const closes: (number | null)[] = json.chart.result[0].indicators.quote[0].close ?? [];
  const valid = closes.filter((c): c is number => c != null);
  let prevClose: number | null = null;
  if (valid.length >= 2) {
    prevClose = valid[valid.length - 2]; // yesterday's close (both days available)
  } else if (valid.length === 1) {
    prevClose = valid[0]; // only yesterday available — today not yet closed
  }
  if (prevClose != null) {
    return { rawPrice, changePct: ((rawPrice - prevClose) / prevClose) * 100 };
  }

  // Last resort fallback
  const prev: number = meta.previousClose ?? meta.chartPreviousClose;
  return { rawPrice, changePct: ((rawPrice - prev) / prev) * 100 };
}

async function fetchBTC(): Promise<{ rawPrice: number; changePct: number }> {
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true',
    { next: { revalidate: 300 } }
  );
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const json = await res.json();
  return {
    rawPrice: json.bitcoin.usd,
    changePct: json.bitcoin.usd_24h_change,
  };
}

function fmt(price: number, isCrypto = false): string {
  if (isCrypto) return `$${Math.round(price).toLocaleString('en-US')}`;
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

export async function GET() {
  try {
    const [nasdaq, kospi, n225, hsi, dax, btc] = await Promise.allSettled([
      fetchYahoo('^IXIC'),
      fetchYahoo('^KS11'),
      fetchYahoo('^N225'),
      fetchYahoo('^HSI'),
      fetchYahoo('^GDAXI'),
      fetchBTC(),
    ]);

    const resolve = (r: PromiseSettledResult<{ rawPrice: number; changePct: number }>, fallback: { rawPrice: number; changePct: number }) =>
      r.status === 'fulfilled' ? r.value : fallback;

    const data: MarketItem[] = [
      {
        id: 'NASDAQ', name: 'Nasdaq Composite',
        ...resolve(nasdaq, { rawPrice: 18432.10, changePct: 1.42 }),
        price: '', change: '', isUp: true,
      },
      {
        id: 'KOSPI', name: 'Korea Composite',
        ...resolve(kospi, { rawPrice: 2683.45, changePct: 0.56 }),
        price: '', change: '', isUp: true,
      },
      {
        id: 'N225', name: 'Nikkei 225',
        ...resolve(n225, { rawPrice: 38210.55, changePct: -0.42 }),
        price: '', change: '', isUp: true,
      },
      {
        id: 'HSI', name: 'Hang Seng Index',
        ...resolve(hsi, { rawPrice: 22000, changePct: 0.30 }),
        price: '', change: '', isUp: true,
      },
      {
        id: 'DAX', name: 'DAX',
        ...resolve(dax, { rawPrice: 18500, changePct: 0.25 }),
        price: '', change: '', isUp: true,
      },
      {
        id: 'BTC', name: 'Bitcoin',
        ...resolve(btc, { rawPrice: 98420, changePct: 2.18 }),
        price: '', change: '', isUp: true,
      },
    ];

    const result = data.map(d => ({
      ...d,
      price: fmt(d.rawPrice, d.id === 'BTC'),
      change: fmtPct(d.changePct),
      isUp: d.changePct >= 0,
    }));

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
