import { NextRequest, NextResponse } from 'next/server';

export interface NewsItem {
  title: string;
  source: string;
  publishedAt: number; // unix seconds
  url: string;
  summary?: string;
  image?: string;
}

const FINNHUB_KEY = process.env.FINNHUB_KEY ?? process.env.FINNHUB_API_KEY ?? '';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// ── 회사 키워드 조회 (Finnhub 프로필) ─────────────────────────────────────────
async function getCompanyKeywords(ticker: string): Promise<string[]> {
  const base = [ticker.toLowerCase()];
  if (!FINNHUB_KEY) return base;
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_KEY}`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return base;
    const { name }: { name?: string } = await res.json();
    if (!name) return base;
    // "Rackspace Technology Inc" → ["rackspace technology", "rackspace", "rxt"]
    const clean     = name.toLowerCase().replace(/\s+(inc\.?|corp\.?|ltd\.?|llc|co\.?|plc)$/i, '').trim();
    const firstWord = clean.split(' ')[0];
    return [...new Set([clean, firstWord, ticker.toLowerCase()])];
  } catch { return base; }
}

// ── 라운드업/무관 기사 패턴 ──────────────────────────────────────────────────
const ROUNDUP_RE = [
  /top gainers? and losers?/i,
  /unusual volume/i,
  /\d+\s+stocks?\s+moving/i,
  /here are \d+\s+stocks?/i,
  /stocks?\s+(making the most noise|in motion|experiencing notable|are the most active|to watch today)/i,
  /top stock movements?/i,
  /notable gap.?ups? and gap.?downs?/i,
  /^dow (dips?|rises?|falls?|jumps?|surges?|plunges?)/i,
  /^(s&p|nasdaq|us stocks?)\s+(mixed|higher|lower|open|fall|rise)/i,
  /intraday session$/i,
  /today's session\.?$/i,
  /monday's session|tuesday's session|wednesday's session|thursday's session|friday's session/i,
  /^\d+ (information technology|tech|financial|energy|health)/i, // "12 IT stocks moving..."
  /upbeat q\d results.+joins/i,          // "Company A Posts Upbeat Q1, Joins Company B..."
  /posts (upbeat|downbeat).+joins/i,
];

function isRelevant(item: NewsItem, keywords: string[]): boolean {
  // GlobeNewswire는 이미 티커로 필터된 공식 보도자료 — 항상 포함
  if (item.source === 'GlobeNewswire') return true;

  // 라운드업 패턴 걸리면 제외
  if (ROUNDUP_RE.some(re => re.test(item.title))) return false;

  const title   = item.title.toLowerCase();
  const summary = (item.summary ?? '').toLowerCase();

  // 제목에 회사명/티커 포함 여부
  if (keywords.some(kw => title.includes(kw))) return true;

  // 제목에는 없지만 요약에 명확히 언급된 경우 (짧은 제목 한정)
  if (title.length < 70 && keywords.some(kw => summary.includes(kw))) return true;

  return false;
}

// ── 중복 제거 (단순 60자 → 의미 유사도 기반) ────────────────────────────────
function keyWords(title: string): Set<string> {
  return new Set(
    title.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !/^(that|this|with|from|have|will|were|they|their|been|more|than|into|also|when|what|about|after|before|which|would|could|should)$/.test(w))
  );
}

function isSimilar(a: string, b: string): boolean {
  const wa = keyWords(a);
  const wb = keyWords(b);
  if (wa.size === 0 || wb.size === 0) return false;
  const shared = [...wa].filter(w => wb.has(w)).length;
  return shared / Math.min(wa.size, wb.size) >= 0.65;
}

// ── Finnhub 뉴스 ──────────────────────────────────────────────────────────────
async function fetchFinnhub(ticker: string): Promise<NewsItem[]> {
  if (!FINNHUB_KEY) return [];
  try {
    const to   = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(ticker)}&from=${fmt(from)}&to=${fmt(to)}&token=${FINNHUB_KEY}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return [];
    const data: { headline: string; source: string; datetime: number; url: string; summary?: string; image?: string }[] = await res.json();
    return (Array.isArray(data) ? data : [])
      .filter(n => n.headline && n.url)
      .map(n => ({
        title:       n.headline,
        source:      n.source ?? 'Finnhub',
        publishedAt: n.datetime,
        url:         n.url,
        summary:     n.summary   || undefined,
        image:       n.image     || undefined,
      }));
  } catch { return []; }
}

// ── Stock Titan RSS (near real-time press releases) ───────────────────────────
async function fetchStockTitan(ticker: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(
      `https://www.stocktitan.net/rss/news/${encodeURIComponent(ticker)}`,
      { headers: { 'User-Agent': UA }, cache: 'no-store' },
    );
    if (!res.ok) return [];
    const xml = await res.text();
    if (!xml.includes('<item>')) return [];
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 20).map(([, b]) => {
      const plain = (tag: string) => b.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`))?.[1]?.trim()
                                  ?? b.match(new RegExp(`<${tag}[^>]*>([^<]*)<`))?.[1]?.trim() ?? '';
      const title       = plain('title').replace(/\s*\|\s*[A-Z]+ Stock News\s*$/, '').trim();
      const url         = plain('link') || plain('guid');
      const publishedAt = plain('pubDate') ? Math.floor(new Date(plain('pubDate')).getTime() / 1000) : 0;
      return { title, source: 'Stock Titan', publishedAt, url } satisfies NewsItem;
    }).filter(n => n.title && n.url);
  } catch { return []; }
}

// ── GlobeNewswire RSS ─────────────────────────────────────────────────────────
async function fetchGlobeNewswire(ticker: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(
      `https://www.globenewswire.com/RssFeed/keyword/${encodeURIComponent(ticker)}`,
      { headers: { 'User-Agent': UA }, cache: 'no-store' },
    );
    if (!res.ok) return [];
    const xml = await res.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 15).map(([, b]) => {
      const cdata = (tag: string) => b.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`))?.[1]?.trim() ?? '';
      const plain = (tag: string) => b.match(new RegExp(`<${tag}[^>]*>([^<]*)<`))?.[1]?.trim() ?? '';
      const title       = cdata('title') || plain('title');
      const url         = plain('link')  || plain('guid');
      const publishedAt = plain('pubDate') ? Math.floor(new Date(plain('pubDate')).getTime() / 1000) : 0;
      const rawDesc     = cdata('description');
      const summary     = rawDesc ? rawDesc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300) || undefined : undefined;
      return { title, source: 'GlobeNewswire', publishedAt, url, summary } satisfies NewsItem;
    }).filter(n => n.title && n.url);
  } catch { return []; }
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
export async function GET(_: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;

  const [keywords, finnhub, globe, stocktitan] = await Promise.all([
    getCompanyKeywords(ticker),
    fetchFinnhub(ticker),
    fetchGlobeNewswire(ticker),
    fetchStockTitan(ticker),
  ]);

  // 1) 관련성 필터 — Stock Titan은 티커 피드이므로 항상 관련
  const relevant = [
    ...finnhub.filter(item => isRelevant(item, keywords)),
    ...globe,          // GlobeNewswire: already ticker-filtered
    ...stocktitan,     // Stock Titan: per-ticker RSS, always relevant
  ];

  // 2) 중복 제거 (날짜순 정렬 후, 유사도 높은 이후 기사 제거)
  relevant.sort((a, b) => b.publishedAt - a.publishedAt);
  const deduped: NewsItem[] = [];
  for (const item of relevant) {
    if (!deduped.some(existing => isSimilar(item.title, existing.title))) {
      deduped.push(item);
    }
  }

  return NextResponse.json(deduped);
}
