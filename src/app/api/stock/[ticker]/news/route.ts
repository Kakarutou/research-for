import { NextRequest, NextResponse } from 'next/server';

export interface NewsItem {
  title: string;
  source: string;
  publishedAt: number; // unix seconds
  url: string;
  summary?: string;    // pre-fetched summary from Finnhub
  image?: string;      // thumbnail
}

const FINNHUB_KEY = process.env.FINNHUB_KEY ?? process.env.FINNHUB_API_KEY ?? '';

async function fetchFinnhub(ticker: string): Promise<NewsItem[]> {
  if (!FINNHUB_KEY) return [];
  try {
    const to   = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30); // 최근 30일
    const fmt  = (d: Date) => d.toISOString().slice(0, 10);

    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(ticker)}&from=${fmt(from)}&to=${fmt(to)}&token=${FINNHUB_KEY}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return [];

    const data: {
      headline: string; source: string; datetime: number;
      url: string; summary?: string; image?: string;
    }[] = await res.json();

    return (Array.isArray(data) ? data : [])
      .filter(n => n.headline && n.url)
      .map(n => ({
        title:       n.headline,
        source:      n.source ?? 'Finnhub',
        publishedAt: n.datetime,
        url:         n.url,
        summary:     n.summary || undefined,
        image:       n.image   || undefined,
      }));
  } catch { return []; }
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const news = await fetchFinnhub(ticker);
  return NextResponse.json(news);
}
