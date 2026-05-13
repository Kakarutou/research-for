import { NextRequest, NextResponse } from 'next/server';

const UA     = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const UA_SEC = 'research-for wjddlswjs7398@gmail.com';

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/g, ' ');
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function extractMeta(html: string, prop: string): string {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']{10,400})["']`, 'i'))
         ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']{10,400})["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
  return m ? decodeEntities(m[1].trim()) : '';
}

function extractParagraphs(html: string): string[] {
  const cleaned = html
    .replace(/<(script|style|nav|header|footer|aside|figure|noscript|iframe)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const areaMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
                 ?? cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
                 ?? cleaned.match(/<div[^>]+(?:class|id)="[^"]*(?:article|content|story|body|text)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const area = areaMatch?.[1] ?? cleaned;

  return [...area.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => stripTags(m[1]))
    .filter(p => p.length > 55 && !/cookie|privacy|subscribe|copyright|all rights reserved/i.test(p));
}

function scoreSentences(sentences: string[]): string[] {
  const financialKw = /\$|revenue|profit|loss|earnings|eps|growth|decline|quarter|billion|million|percent|%|guidance|forecast|beat|miss|raised|cut|upgrade|downgrade|acquire|merge|deal|announce|report|appointed|warrant|offering|agreement/i;
  const scored = sentences.map(s => ({
    s,
    score:
      (financialKw.test(s) ? 3 : 0) +
      (s.length > 80 && s.length < 280 ? 2 : 0) +
      (/said|announced|reported|stated|noted|according|appointed|agreed|entered/i.test(s) ? 1 : 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 4).map(x => x.s);
}

function buildBullets(paragraphs: string[], ogDesc: string): string[] {
  if (paragraphs.length === 0 && ogDesc) return [ogDesc];

  const allSentences: string[] = [];
  for (const p of paragraphs.slice(0, 12)) {
    const sents = p.split(/(?<=[.!?])\s+(?=[A-Z"'])/).filter(s => s.length > 40);
    allSentences.push(...sents);
  }

  if (allSentences.length === 0) return ogDesc ? [ogDesc] : [];

  const top = scoreSentences(allSentences);
  if (ogDesc && !top.some(s => s.slice(0, 40) === ogDesc.slice(0, 40))) {
    top.unshift(ogDesc);
  }
  return top.slice(0, 4);
}

// ── SEC EDGAR 공시 내용 추출 ──────────────────────────────────────────────────
interface SecDoc { url: string; description: string; type: string; }

// SEC 폼 커버페이지 보일러플레이트 패턴
const SEC_BOILERPLATE = /check\s*mark|form\s+8-k|exchange\s+act|file\s+number|emerging\s+growth|pursuant\s+to\s+rule|IRS\s+Employer|EDGAR|state\s+or\s+other\s+jurisdiction|exact\s+name\s+of\s+registrant/i;

async function fetchSecFilingContent(indexUrl: string): Promise<string[]> {
  try {
    const idxUrl = indexUrl.replace(/-index\.htm$/, '-index.html');
    const idxRes = await fetch(idxUrl, {
      headers: { 'User-Agent': UA_SEC },
      signal: AbortSignal.timeout(6000),
    }).catch(() => fetch(indexUrl, { headers: { 'User-Agent': UA_SEC }, signal: AbortSignal.timeout(6000) }));

    if (!idxRes.ok) return [];
    const idxHtml = await idxRes.text();

    // filing index table 파싱
    const docs: SecDoc[] = [];
    let ex99Url = '';
    let primaryUrl = '';

    for (const [, row] of idxHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      // iXBRL viewer URL (/ix?doc=/Archives/...) 또는 일반 /Archives/... 처리
      const hrefRaw = row.match(/href="([^"]+\.htm[l]?)"/i)?.[1] ?? '';
      const archivePath = hrefRaw.includes('/ix?doc=')
        ? hrefRaw.replace(/^.*\/ix\?doc=/, '')
        : hrefRaw.startsWith('/Archives') ? hrefRaw : '';
      if (!archivePath) continue;
      const full = `https://www.sec.gov${archivePath}`;

      const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => stripTags(m[1]).trim());
      const desc = tds[1] ?? '';
      const type = tds[3] ?? '';

      if (!/graphic|image|jpg|png|gif/i.test(type) && desc) {
        docs.push({ url: full, description: desc, type });
      }
      if (/ex[.-]?99\.?1\b/i.test(type) && !ex99Url)  ex99Url    = full;
      if (!primaryUrl && />\s*1\s*</.test(row))         primaryUrl = full;
    }

    // 문서 텍스트 추출 (iXBRL 포함) — boilerplate 필터 적용
    const extractContent = async (url: string): Promise<string[]> => {
      const r = await fetch(url, { headers: { 'User-Agent': UA_SEC }, signal: AbortSignal.timeout(10000) });
      if (!r.ok) return [];
      const html = await r.text();

      // iXBRL ix 태그 → 내용 보존하면서 제거
      const cleaned = html
        .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<ix:[a-z]+[^>]*>/gi, '')
        .replace(/<\/ix:[a-z]+>/gi, '');

      // 전체 텍스트: non-breaking space( ) 정규화
      const fullText = stripTags(cleaned).replace(/ /g, ' ');

      // 문장 분리 + boilerplate 필터
      const sentences = fullText
        .split(/(?<=[.!?])\s+(?=[A-Z"'])/)
        .map(s => s.trim().replace(/\s+/g, ' '))
        .filter(s =>
          s.length > 60 && s.length < 450 &&
          !SEC_BOILERPLATE.test(s) &&
          !/^\s*[\d.,\s%$\-–]+\s*$/.test(s) &&
          !/copyright|all rights|cookie/i.test(s)
        );

      // 커버페이지 감지: 실질 내용이 없으면 empty → docList fallback
      const hasRealContent = sentences.some(s =>
        /\$[\d,]+|\d+\s*%|appointed|agreed|entered|completed|announced|acquired|billion|million|quarter|warrant|offering|agreement/i.test(s)
      );
      if (!hasRealContent || sentences.length === 0) return [];

      return buildBullets(sentences.slice(0, 30), '');
    };

    // 1순위: EX-99.1 press release
    if (ex99Url) {
      const bullets = await extractContent(ex99Url);
      if (bullets.length > 0) return bullets;
    }

    // 2순위: primary document 본문
    if (primaryUrl) {
      const bullets = await extractContent(primaryUrl);
      if (bullets.length > 0) return bullets;
    }

    // 3순위: 인덱스 문서 목록 (6-K, 20-F 등 cover-page형 공시)
    const docList = docs
      .filter(d => !/^(GRAPHIC|IMAGE|XML|EX-101)/i.test(d.type))
      .slice(0, 6)
      .map(d => d.description && d.description.toUpperCase() !== d.type.toUpperCase()
        ? `[${d.type}] ${d.description}`
        : `[${d.type}]`);
    if (docList.length > 0) return docList;

    return [];
  } catch {
    return [];
  }
}

// 페이월 도메인
const PAYWALL_DOMAINS = [
  'wsj.com', 'ft.com', 'bloomberg.com', 'barrons.com',
  'seekingalpha.com', 'thestreet.com', 'marketwatch.com',
  'investors.com', 'morningstar.com',
];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 });

  // SEC EDGAR — 공시 문서 내용 추출
  if (url.includes('sec.gov/Archives')) {
    const bullets = await fetchSecFilingContent(url);
    return NextResponse.json({ bullets, secFiling: true });
  }

  // SEC 검색/CIK 페이지
  if (url.includes('sec.gov/cgi-bin')) {
    return NextResponse.json({ bullets: [], secFiling: true });
  }

  // DART — JS 뷰어라 서버 파싱 불가
  if (url.includes('dart.fss.or.kr')) {
    return NextResponse.json({ bullets: [], dartFiling: true });
  }

  // 페이월 도메인
  if (PAYWALL_DOMAINS.some(d => url.includes(d))) {
    return NextResponse.json({ bullets: [], paywall: true });
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NextResponse.json({ blocked: true }, { status: 200 });

    const html = await res.text();
    const ogDesc  = extractMeta(html, 'og:description') || extractMeta(html, 'description');
    const paras   = extractParagraphs(html);
    const bullets = buildBullets(paras, ogDesc);

    return NextResponse.json({ bullets });
  } catch {
    return NextResponse.json({ blocked: true });
  }
}
