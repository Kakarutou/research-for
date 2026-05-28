import { NextResponse } from 'next/server';

export interface InformItem {
  id: string;          // dedupe key (normalized title)
  title: string;
  source: string;      // GlobeNewswire / BusinessWire / TipRanks
  link: string;
  pubDate: number;     // unix seconds
  description: string; // short
}

interface Source {
  name: string;
  url: string;
}

// 호재성 키워드 — title + description 검사
const POSITIVE_KEYWORDS = [
  // M&A / Partnership
  'agreement', 'partnership', 'collaboration', 'joint venture', 'alliance',
  'acquires', 'acquisition', 'merger', 'to acquire', 'completes acquisition',
  // Contracts / Deals
  'contract', 'wins', 'awarded', 'selected', 'chosen', 'signs', 'deal',
  // Approval / Launch
  'fda approval', 'fda clearance', 'approved', 'clearance', 'cleared',
  'launch', 'launches', 'unveils', 'introduces', 'announces',
  // Earnings / Growth
  'beats', 'exceeds', 'tops', 'record', 'surges',
  'raises guidance', 'raises outlook', 'upgrade', 'upgraded',
  // Funding
  'raises ', 'funding', 'investment', 'closes', 'oversubscribed',
  // Buyback / Dividend
  'buyback', 'repurchase', 'dividend increase',
];

const SOURCES: Source[] = [
  {
    name: 'GlobeNewswire',
    url: 'https://www.globenewswire.com/RssFeed/orgclass/1/feedTitle/GlobeNewswire',
  },
  {
    name: 'BusinessWire',
    url: 'https://feed.businesswire.com/rss/home/?rss=G1QFDERJXkJeEFhAUg==',
  },
  {
    name: 'TipRanks',
    url: 'https://www.tipranks.com/news/feed',
  },
];

function unwrapCdata(s: string): string {
  const m = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(s.trim());
  return m ? m[1] : s.trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').trim();
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = re.exec(xml);
  if (!m) return '';
  return decodeEntities(unwrapCdata(m[1]));
}

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function isPositive(title: string, description: string): boolean {
  const haystack = (title + ' ' + description).toLowerCase();
  return POSITIVE_KEYWORDS.some(kw => haystack.includes(kw));
}

async function fetchSource(src: Source): Promise<InformItem[]> {
  const res = await fetch(src.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ResearchForBot/1.0)',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`${src.name} ${res.status}`);
  const xml = await res.text();

  const items: InformItem[] = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRe.exec(xml)) !== null) {
    const content = match[1];
    const title = extractTag(content, 'title');
    if (!title) continue;
    const link = extractTag(content, 'link');
    const pubDateRaw = extractTag(content, 'pubDate');
    const description = stripHtml(extractTag(content, 'description')).slice(0, 280);

    const ts = pubDateRaw ? Math.floor(new Date(pubDateRaw).getTime() / 1000) : 0;
    if (!ts) continue;

    items.push({
      id: normalizeTitle(title),
      title,
      source: src.name,
      link,
      pubDate: ts,
      description,
    });
  }
  return items;
}

export async function GET() {
  const settled = await Promise.allSettled(SOURCES.map(fetchSource));

  const all: InformItem[] = [];
  const errors: { source: string; error: string }[] = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') all.push(...r.value);
    else errors.push({ source: SOURCES[i].name, error: String(r.reason) });
  });

  // 호재 필터
  const positive = all.filter(it => isPositive(it.title, it.description));

  // 중복 제거 (id 기준)
  const seen = new Set<string>();
  const deduped = positive.filter(it => {
    if (seen.has(it.id)) return false;
    seen.add(it.id);
    return true;
  });

  // 최신순 정렬
  deduped.sort((a, b) => b.pubDate - a.pubDate);

  return NextResponse.json({
    items: deduped.slice(0, 50),
    errors,
    fetchedAt: Math.floor(Date.now() / 1000),
  });
}
