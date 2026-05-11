import { NextRequest, NextResponse } from 'next/server';

export interface NewsItem {
  title: string;
  source: string;
  publishedAt: number; // unix seconds
  url: string;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=8&enableFuzzyQuery=false`,
      { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, cache: 'no-store' },
    );
    if (!res.ok) return NextResponse.json([]);

    const json = await res.json();
    const raw: { title?: string; publisher?: string; providerPublishTime?: number; link?: string }[] = json.news ?? [];

    return NextResponse.json(
      raw
        .filter(n => n.title)
        .map(n => ({
          title: n.title!,
          source: n.publisher ?? '',
          publishedAt: n.providerPublishTime ?? 0,
          url: n.link ?? '',
        } satisfies NewsItem)),
    );
  } catch {
    return NextResponse.json([]);
  }
}
