import { NextRequest, NextResponse } from 'next/server';

export interface NewsItem {
  title: string;
  source: string;
  publishedAt: number; // unix seconds
  url: string;
  summary?: string;
  image?: string;
}

const UA     = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const SEC_UA = 'research-for wjddlswjs7398@gmail.com'; // SEC EDGAR requires a real contact UA

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
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
  /^\d+ (information technology|tech|financial|energy|health)/i,
  /upbeat q\d results.+joins/i,
  /posts (upbeat|downbeat).+joins/i,
];

// ── 중복 제거 ──────────────────────────────────────────────────────────────
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

// ── SEC EDGAR 8-K 공시 (실시간, 정부 공개 데이터) ─────────────────────────────
const cikCache: Record<string, number | null> = {};

const ITEM_LABEL: Record<string, string> = {
  '1.01': 'Material Agreement Announced',
  '1.02': 'Material Agreement Terminated',
  '2.01': 'Acquisition / Asset Sale Completed',
  '2.03': 'Financial Obligation Created',
  '5.01': 'Change in Control',
  '5.02': 'Leadership / Board Change',
  '7.01': 'Regulation FD Disclosure',
  '8.01': 'Material Event',
};

async function fetchSecEdgar(ticker: string): Promise<NewsItem[]> {
  try {
    // CIK 조회 (일별 캐시)
    if (!(ticker in cikCache)) {
      const r = await fetch('https://www.sec.gov/files/company_tickers.json', {
        headers: { 'User-Agent': SEC_UA },
        next: { revalidate: 86400 },
      });
      if (!r.ok) { cikCache[ticker] = null; }
      else {
        const data: Record<string, { cik_str: number; ticker: string }> = await r.json();
        cikCache[ticker] = null;
        for (const v of Object.values(data)) {
          if (v.ticker.toUpperCase() === ticker.toUpperCase()) {
            cikCache[ticker] = v.cik_str; break;
          }
        }
      }
    }
    const cik = cikCache[ticker];
    if (!cik) return [];

    const pad = String(cik).padStart(10, '0');
    const sub = await fetch(`https://data.sec.gov/submissions/CIK${pad}.json`, {
      headers: { 'User-Agent': SEC_UA }, cache: 'no-store',
    });
    if (!sub.ok) return [];

    const data = await sub.json();
    const recent = data.filings?.recent ?? {};
    const forms: string[]  = recent.form         ?? [];
    const dates: string[]  = recent.filingDate   ?? [];
    const accns: string[]  = recent.accessionNumber ?? [];
    const itemCodes: string[] = recent.items     ?? [];

    const cutoff = Math.floor(Date.now() / 1000) - 90 * 24 * 3600; // 최근 90일
    const result: NewsItem[] = [];

    for (let i = 0; i < forms.length && result.length < 12; i++) {
      if (forms[i] !== '8-K' && forms[i] !== '6-K') continue;
      const ts = dates[i] ? Math.floor(new Date(dates[i]).getTime() / 1000) : 0;
      if (ts < cutoff) break;

      // 첫 번째 item 코드 추출
      const code = (itemCodes[i] ?? '').split(',')[0].replace(/\s/g, '');
      if (code === '2.02') continue; // 어닝은 별도 탭에서 처리

      const label = ITEM_LABEL[code] ?? `${forms[i]} Filing`;
      const accn  = accns[i];
      const url   = `https://www.sec.gov/Archives/edgar/data/${cik}/${accn.replace(/-/g, '')}/${accn}-index.htm`;

      result.push({
        title: label,
        source: 'SEC EDGAR',
        publishedAt: ts,
        url,
      });
    }
    return result;
  } catch { return []; }
}

// ── Google News RSS (무료, 상업용, 구글 집계 ~1-5분 딜레이) ──────────────────
async function fetchGoogleNews(ticker: string): Promise<NewsItem[]> {
  try {
    const query = encodeURIComponent(`${ticker} stock`);
    const res = await fetch(
      `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`,
      { headers: { 'User-Agent': UA }, cache: 'no-store' },
    );
    if (!res.ok) return [];
    const xml = await res.text();

    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 30).flatMap(([, b]) => {
      const plain = (tag: string) =>
        b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim() ?? '';

      const rawTitle  = plain('title');
      const url       = plain('link');
      const pubStr    = plain('pubDate');
      const sourceName = plain('source') || 'Google News';

      if (!rawTitle || !url) return [];

      // Strip " - Source Name" suffix and decode HTML entities
      const title = decodeEntities(rawTitle.replace(/\s*[-–]\s*.{3,30}$/, '').trim() || rawTitle);
      const publishedAt = pubStr ? Math.floor(new Date(pubStr).getTime() / 1000) : 0;

      return [{ title, source: sourceName, publishedAt, url } satisfies NewsItem];
    }).filter(n => !ROUNDUP_RE.some(re => re.test(n.title)));
  } catch { return []; }
}

// ── GlobeNewswire RSS (실시간 공식 보도자료) ──────────────────────────────────
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

  const [globe, google, sec] = await Promise.all([
    fetchGlobeNewswire(ticker),
    fetchGoogleNews(ticker),
    fetchSecEdgar(ticker),
  ]);

  // 합치기: GlobeNewswire(실시간 공보) + Google News(구글 집계) + SEC EDGAR(규제 공시)
  const combined = [...globe, ...google, ...sec];

  // 날짜순 정렬 후 유사 기사 중복 제거
  combined.sort((a, b) => b.publishedAt - a.publishedAt);
  const deduped: NewsItem[] = [];
  for (const item of combined) {
    if (!deduped.some(existing => isSimilar(item.title, existing.title))) {
      deduped.push(item);
    }
  }

  return NextResponse.json(deduped);
}
