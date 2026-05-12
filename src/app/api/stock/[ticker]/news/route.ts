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
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

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

// GlobeNewswire RSS — 기업 공식 보도자료
async function fetchGlobeNewswire(ticker: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(
      `https://www.globenewswire.com/RssFeed/ticker/${ticker}`,
      { headers: { 'User-Agent': UA }, cache: 'no-store' },
    );
    if (!res.ok) return [];
    const xml   = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    return items.slice(0, 15).map(([, b]) => {
      const cdata = (tag: string) => b.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`))?.[1]?.trim() ?? '';
      const plain = (tag: string) => b.match(new RegExp(`<${tag}[^>]*>([^<]*)<`))?.[1]?.trim() ?? '';
      const title       = cdata('title')  || plain('title');
      const url         = plain('link')   || plain('guid');
      const pubDateStr  = plain('pubDate');
      const publishedAt = pubDateStr ? Math.floor(new Date(pubDateStr).getTime() / 1000) : 0;
      const summary     = cdata('description') || undefined;
      return { title, source: 'GlobeNewswire', publishedAt, url, summary } satisfies NewsItem;
    }).filter(n => n.title);
  } catch { return []; }
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;

  const [finnhub, globe] = await Promise.all([
    fetchFinnhub(ticker),
    fetchGlobeNewswire(ticker),
  ]);

  // Merge & deduplicate (Finnhub first — higher quality)
  const seen = new Set<string>();
  const all:  NewsItem[] = [];
  for (const item of [...finnhub, ...globe]) {
    const key = item.title.toLowerCase().slice(0, 60);
    if (!seen.has(key)) { seen.add(key); all.push(item); }
  }
  all.sort((a, b) => b.publishedAt - a.publishedAt);

  return NextResponse.json(all);
}
