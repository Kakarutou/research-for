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
  // 한국어 시황·라운드업 패턴
  /^\[애프터마켓\s*브리핑\]/,
  /^\[모닝\s*브리핑\]/,
  /^\[브리핑\]/,
  /^\[장\s*(마감|중)\s*시황\]/,
  /^\[시황\]/,
  /^\[마감\s*시황\]/,
  /^\[코스피\s*마감\]/,
  /^\[코스닥\s*마감\]/,
  /^\[서울데이터랩\]/,   // 다른 종목 상한가 기사
  /^\[주요\s*외신\]/,
  /코스피.*포인트.*(상승|하락)/,
  /코스닥.*포인트.*(상승|하락)/,
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

// SEC EDGAR 공시는 disclosures/route.ts에서 전담 처리 — news route에서 중복 생성 제거

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

// ── Yahoo Finance RSS (실시간, 소형주 포함) ───────────────────────────────────
async function fetchYahooFinance(ticker: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(
      `https://finance.yahoo.com/rss/headline?s=${encodeURIComponent(ticker)}`,
      { headers: { 'User-Agent': UA }, cache: 'no-store' },
    );
    if (!res.ok) return [];
    const xml = await res.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 20).flatMap(([, b]) => {
      const cdata = (tag: string) => b.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`))?.[1]?.trim() ?? '';
      const plain = (tag: string) => b.match(new RegExp(`<${tag}[^>]*>([^<]*)<`))?.[1]?.trim() ?? '';
      const title       = decodeEntities(cdata('title') || plain('title'));
      const url         = plain('link') || plain('guid');
      const pubStr      = plain('pubDate');
      const publishedAt = pubStr ? Math.floor(new Date(pubStr).getTime() / 1000) : 0;
      // description 태그에서 요약 추출 (HTML 태그 제거)
      const rawDesc = cdata('description') || plain('description');
      const summary = rawDesc
        ? decodeEntities(rawDesc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 300) || undefined
        : undefined;
      if (!title || !url) return [];
      return [{ title, source: 'Yahoo Finance', publishedAt, url, summary } satisfies NewsItem];
    }).filter(n => !ROUNDUP_RE.some(re => re.test(n.title)));
  } catch { return []; }
}

// ── Finnhub (실시간, 소형주/OTC 포함) ────────────────────────────────────────
async function fetchFinnhub(ticker: string): Promise<NewsItem[]> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return [];
  try {
    const to   = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 3600 * 1000); // 최근 30일
    const fmt  = (d: Date) => d.toISOString().slice(0, 10);
    const res  = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(ticker)}&from=${fmt(from)}&to=${fmt(to)}&token=${key}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return [];
    const data: { headline: string; source: string; datetime: number; url: string; summary?: string; image?: string }[] = await res.json();
    if (!Array.isArray(data)) return [];
    return data.slice(0, 30).flatMap(item => {
      if (!item.headline || !item.url) return [];
      if (ROUNDUP_RE.some(re => re.test(item.headline))) return [];
      return [{
        title: item.headline,
        source: item.source || 'Finnhub',
        publishedAt: item.datetime,
        url: item.url,
        summary: item.summary?.slice(0, 300) || undefined,
        image: item.image || undefined,
      } satisfies NewsItem];
    });
  } catch { return []; }
}

// ── 네이버 금융 뉴스 (국내 주식 전용) ────────────────────────────────────────
function isKoreanTicker(ticker: string): string | null {
  const m = ticker.match(/^(\d{6})(?:\.(KS|KQ))?$/i);
  return m ? m[1] : null;
}

function decodeNaverEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"').replace(/&lsquo;/g, "'").replace(/&rsquo;/g, "'")
    .replace(/&hellip;/g, '…').replace(/&middot;/g, '·').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/g, '').trim();
}

async function fetchNaverNews(code: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(
      `https://finance.naver.com/item/news_news.naver?code=${code}&page=1`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': `https://finance.naver.com/item/main.naver?code=${code}`,
          'Accept': 'text/html',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        },
        cache: 'no-store',
      }
    );
    if (!res.ok) return [];

    const buf = await res.arrayBuffer();
    const html = new TextDecoder('euc-kr').decode(buf);

    // 제목 링크
    const titleMatches = [...html.matchAll(/href="(\/item\/news_read\.naver\?[^"]+)"[^>]*class="tit"[^>]*>([^<]+)<\/a>/g)];
    // 언론사
    const sources = [...html.matchAll(/class="info">([^<]+)</g)].map(m => m[1].trim());
    // 날짜
    const dates = [...html.matchAll(/class="date">([^<]+)</g)].map(m => m[1].trim());

    return titleMatches.slice(0, 20).map((m, i) => {
      const title = decodeNaverEntities(m[2]);
      const url   = `https://finance.naver.com${m[1]}`;
      const dateStr = dates[i] ?? '';
      const publishedAt = dateStr
        ? Math.floor(new Date(dateStr.replace(/\./g, '-').replace(' ', 'T') + ':00').getTime() / 1000)
        : 0;
      return { title, source: sources[i] ?? 'Naver Finance', publishedAt, url } satisfies NewsItem;
    }).filter(n => n.title.length > 4);
  } catch { return []; }
}

// ── 관련성 필터 (다른 종목 기사 제거) ────────────────────────────────────────
const GENERIC_TITLES = new Set(['msn money', 'yahoo finance', 'google news', 'stock price, quote & chart']);

function isTickerRelevant(title: string, ticker: string): boolean {
  if (!title || title.trim().length < 10) return false;
  const lower = title.toLowerCase();
  if (GENERIC_TITLES.has(lower.trim())) return false;
  // 제목에 generic 플레이스홀더만 있는 경우 제거
  if (/^(msn money|stock price|stock chart|stock quote)\s*[-–]?\s*$/i.test(title.trim())) return false;

  const sym = ticker.toLowerCase();
  // 티커 직접 언급 → 관련 있음
  if (lower.includes(sym)) return true;
  // 다른 티커가 괄호 안에 뚜렷하게 등장하고 우리 티커는 없는 경우 → 제거
  // e.g. "Why Is Opendoor (OPEN) Stock Rocketing" when searching SRXH
  const m = title.match(/\((?:NYSE|NASDAQ|NYSEARCA|NYSEMKT|OTC[A-Z]*)?:?([A-Z]{1,5})\)/);
  if (m && m[1].toLowerCase() !== sym) return false;
  return true;
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
export async function GET(_: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;

  // 국내 주식 → 네이버 금융 뉴스
  const krCode = isKoreanTicker(ticker);
  if (krCode) {
    const raw = await fetchNaverNews(krCode);
    const news = raw.filter(n => !ROUNDUP_RE.some(re => re.test(n.title)));
    news.sort((a, b) => b.publishedAt - a.publishedAt);
    return NextResponse.json(news);
  }

  const [globe, google, yahoo, finnhub] = await Promise.all([
    fetchGlobeNewswire(ticker),
    fetchGoogleNews(ticker),
    fetchYahooFinance(ticker),
    fetchFinnhub(ticker),
  ]);

  // 합치기: Finnhub·Yahoo(실시간) > GlobeNewswire(공보) > Google News(집계)
  // SEC 공시는 disclosures/route.ts 전담 (중복 방지)
  const combined = [...finnhub, ...yahoo, ...globe, ...google]
    .filter(n => isTickerRelevant(n.title, ticker));

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
