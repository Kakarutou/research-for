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
interface SecDoc { url: string; description: string; type: string; isXml?: boolean; }

// SEC 폼 커버페이지 보일러플레이트 패턴
const SEC_BOILERPLATE = /check\s*mark|form\s+8-k|exchange\s+act|file\s+number|emerging\s+growth|pursuant\s+to\s+rule|IRS\s+Employer|EDGAR|state\s+or\s+other\s+jurisdiction|exact\s+name\s+of\s+registrant/i;

// Schedule 13G/D XML 파싱 — 대량보유 공시 요약
function parseSchedule13Xml(xml: string): string[] {
  const get = (tag: string) => xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, 'i'))?.[1]?.trim() ?? '';

  const name    = get('reportingPersonName') || get('filingPersonName');
  const issuer  = get('issuerName');
  const shares  = get('reportingPersonBeneficiallyOwnedAggregateNumberOfShares');
  const pct     = get('classPercent');
  const sole    = get('soleVotingPower');
  const shared  = get('sharedVotingPower');
  const secType = get('securitiesClassTitle') || 'Common Stock';

  if (!name) return [];

  const results: string[] = [];
  const sharesNum = parseFloat((shares ?? '0').replace(/,/g, ''));

  let line = `${name}`;
  if (issuer) line += ` — ${issuer}`;
  if (sharesNum > 0) line += ` ${sharesNum.toLocaleString('en-US', { maximumFractionDigits: 0 })}주(${secType}) 보유`;
  if (pct)   line += ` / 지분율 ${pct}%`;
  results.push(line);

  const soleN   = parseFloat((sole   ?? '0').replace(/,/g, ''));
  const sharedN = parseFloat((shared ?? '0').replace(/,/g, ''));
  if (soleN   > 0) results.push(`단독 의결권: ${soleN.toLocaleString('en-US', { maximumFractionDigits: 0 })}주`);
  if (sharedN > 0) results.push(`공동 의결권: ${sharedN.toLocaleString('en-US', { maximumFractionDigits: 0 })}주`);

  return results;
}

// Form 4 XML 파싱 — insider 거래 요약
function parseForm4Xml(xml: string): string[] {
  const get = (tag: string) => xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, 'i'))?.[1]?.trim() ?? '';

  // 보고자 정보
  const ownerName = get('rptOwnerName');
  const isDirector = get('isDirector') === '1';
  const isOfficer  = get('isOfficer')  === '1';
  const officerTitle = get('officerTitle');
  const role = officerTitle || (isDirector ? 'Director' : isOfficer ? 'Officer' : '주요주주');

  // 거래 내역
  const results: string[] = [];
  const txBlocks = [...xml.matchAll(/<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/gi)];
  const derBlocks = [...xml.matchAll(/<derivativeTransaction>([\s\S]*?)<\/derivativeTransaction>/gi)];

  const codeLabel: Record<string, string> = {
    S: '매도', P: '매수', A: 'Award(부여)', M: '옵션행사', F: '세금원천징수',
    G: '증여', J: '기타', X: '파생만기',
  };

  for (const [, block] of [...txBlocks, ...derBlocks]) {
    const code   = block.match(/<transactionCode>([A-Z])<\/transactionCode>/i)?.[1] ?? '';
    const shares = block.match(/<transactionShares>\s*<value>([\d.,]+)<\/value>/i)?.[1] ?? '';
    const price  = block.match(/<transactionPricePerShare>\s*<value>([\d.,]+)<\/value>/i)?.[1] ?? '';
    const owned  = block.match(/<sharesOwnedFollowingTransaction>\s*<value>([\d.,]+)<\/value>/i)?.[1] ?? '';
    const secName = block.match(/<securityTitle>\s*<value>([^<]+)<\/value>/i)?.[1]?.trim() ?? '';

    if (!shares || !code) continue;
    const action = codeLabel[code] ?? code;
    const sharesNum = parseFloat(shares.replace(/,/g, ''));
    const sharesStr = sharesNum >= 1000
      ? sharesNum.toLocaleString('en-US', { maximumFractionDigits: 0 })
      : shares;

    let line = `${ownerName} (${role}) — ${secName || 'Common Stock'} ${action} ${sharesStr}주`;
    if (price && parseFloat(price) > 0) line += ` @ $${parseFloat(price).toFixed(2)}`;
    if (owned) {
      const ownedNum = parseFloat(owned.replace(/,/g, ''));
      line += ` (보유 후 잔량: ${ownedNum.toLocaleString('en-US', { maximumFractionDigits: 0 })}주)`;
    }
    results.push(line);
  }

  if (results.length === 0 && ownerName) {
    results.push(`${ownerName} (${role}) — 거래내역 없음 (Form 4 제출)`);
  }
  return results.slice(0, 5);
}

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
    let ex99Url      = '';
    let primaryUrl   = '';
    let form4XmlUrl  = '';
    let sched13XmlUrl = '';

    for (const [, row] of idxHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      // iXBRL viewer URL, /Archives HTML, 또는 /Archives XML 처리
      const hrefRaw = row.match(/href="([^"]+\.(htm[l]?|xml))"/i)?.[1] ?? '';
      const isXml = hrefRaw.toLowerCase().endsWith('.xml');
      const archivePath = hrefRaw.includes('/ix?doc=')
        ? hrefRaw.replace(/^.*\/ix\?doc=/, '')
        : hrefRaw.startsWith('/Archives') ? hrefRaw : '';
      if (!archivePath) continue;
      const full = `https://www.sec.gov${archivePath}`;

      const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => stripTags(m[1]).trim());
      const desc = tds[1] ?? '';
      const type = tds[3] ?? '';

      if (!/graphic|image|jpg|png|gif/i.test(type) && desc) {
        docs.push({ url: full, description: desc, type, isXml });
      }
      if (/ex[.-]?99\.?1\b/i.test(type) && !ex99Url)  ex99Url    = full;
      if (!primaryUrl && />\s*1\s*</.test(row) && !isXml) primaryUrl = full;

      // Form 4/3 XML 감지: xslF345 뷰어(HTML 반환)는 제외하고 직접 XML만 인식
      if (!form4XmlUrl && isXml && !hrefRaw.includes('/xslF345') && /^(4|4\/A|3|3\/A)$/i.test(type)) form4XmlUrl = full;
      if (!form4XmlUrl && isXml && !hrefRaw.includes('/xslF345') && /wk-form[34]/i.test(hrefRaw))    form4XmlUrl = full;

      // Schedule 13G/D XML 감지: xslSCHEDULE 뷰어 제외, 직접 XML만
      if (!sched13XmlUrl && isXml && !hrefRaw.includes('/xsl') && /SCHEDULE\s*13[GD]|SC\s*13[GD]/i.test(type)) sched13XmlUrl = full;
      if (!sched13XmlUrl && isXml && !hrefRaw.includes('/xsl') && /primary_doc\.xml/.test(hrefRaw) && /schedule13[gd]/i.test(idxHtml)) sched13XmlUrl = full;
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
        /\$[\d,]+|\d+\s*%|appointed|agreed|entered|completed|announced|acquired|billion|million|quarter|warrant|offering|agreement|resigned|resignation|director|officer|named|elected|effective|terminated|approved|partnership|license|collaboration|transaction|amendment|merger|acquisition|dividend|repurchase|default|waiver|settlement/i.test(s)
      );
      if (!hasRealContent || sentences.length === 0) return [];

      return buildBullets(sentences.slice(0, 30), '');
    };

    // 0순위: Form 4/3 XML 파싱
    if (form4XmlUrl) {
      try {
        const r = await fetch(form4XmlUrl, { headers: { 'User-Agent': UA_SEC }, signal: AbortSignal.timeout(8000) });
        if (r.ok) {
          const xml = await r.text();
          const bullets = parseForm4Xml(xml);
          if (bullets.length > 0) return bullets;
        }
      } catch { /* fall through */ }
    }

    // 0순위: Schedule 13G/D XML 파싱 (대량보유 공시)
    if (sched13XmlUrl) {
      try {
        const r = await fetch(sched13XmlUrl, { headers: { 'User-Agent': UA_SEC }, signal: AbortSignal.timeout(8000) });
        if (r.ok) {
          const xml = await r.text();
          const bullets = parseSchedule13Xml(xml);
          if (bullets.length > 0) return bullets;
        }
      } catch { /* fall through */ }
    }

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

// ── DART 전자공시 내용 추출 ───────────────────────────────────────────────────
const DART_BOILERPLATE = /금융감독원장\s*귀하|증권선물위원회\s*귀중|한국거래소\s*귀중|금융감독원\s*귀중|본\s*점\s*소\s*재\s*지|작\s*성\s*책\s*임\s*자|관련\s*법규|보고자.*확인합니다|기재상의\s*주의|공정공시\s*정보제공자|정보\s*수신자/;
const DART_USELESS = /^(정보제공내역|연락처|관련부서|전화번호|행사명|공시유보|기타\s*투자판단)/;

function formatKrw(n: number): string {
  const abs = Math.abs(n), sign = n < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)}조원`;
  if (abs >= 1e8)  return `${sign}${Math.round(abs / 1e8)}억원`;
  if (abs >= 1e4)  return `${sign}${Math.round(abs / 1e4)}만원`;
  return `${sign}${abs.toLocaleString()}원`;
}

// 잠정실적 등 재무 테이블 → bullets
function parseDartFinancial(tds: string[]): string[] {
  const unitCell = tds.find(t => /백만원/.test(t)) ?? '';
  const isMillion = /백만원/.test(unitCell);
  const ITEMS = ['매출액', '영업이익', '당기순이익', '지배기업\s*소유주지분\s*순이익'];
  const bullets: string[] = [];

  for (const pat of ITEMS) {
    const re = new RegExp(`^${pat}$`);
    const idx = tds.findIndex(t => re.test(t.trim()));
    if (idx < 0) continue;
    // 바로 다음 '당해실적' 찾기
    const hae = tds.slice(idx + 1, idx + 5).findIndex(t => t === '당해실적');
    if (hae < 0) continue;
    const base = idx + 1 + hae;
    const curr = tds[base + 1]?.replace(/,/g, '') ?? '';
    const chg  = tds[base + 3] ?? '';
    if (!/^-?\d+$/.test(curr)) continue;
    const num = parseInt(curr);
    const display = isMillion ? formatKrw(num * 1_000_000) : `${num.toLocaleString()}원`;
    let line = `${tds[idx].trim()}: ${display}`;
    if (/^-?[\d.]+$/.test(chg)) line += ` (전기대비 ${parseFloat(chg) >= 0 ? '+' : ''}${chg}%)`;
    bullets.push(line);
    if (bullets.length >= 3) break;
  }
  return bullets;
}

async function fetchDartContent(dartUrl: string): Promise<string[]> {
  try {
    const rcpNo = dartUrl.match(/rcpNo=(\d+)/)?.[1];
    if (!rcpNo) return [];

    // 1) main.do 페이지에서 viewDoc 파라미터 추출
    const pageRes = await fetch(`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rcpNo}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://dart.fss.or.kr' },
      signal: AbortSignal.timeout(7000),
    });
    if (!pageRes.ok) return [];
    const pageHtml = await pageRes.text();

    const vm = pageHtml.match(/viewDoc\("(\d+)",\s*"(\d+)",\s*"(\d+)",\s*"(\d+)",\s*"(\d+)",\s*"([^"]+)"/);
    if (!vm) return [];
    const [, rn, dcm, ele, off, lng, dtd] = vm;

    // 2) report/viewer.do 로 문서 내용 fetch
    const docUrl = `https://dart.fss.or.kr/report/viewer.do?rcpNo=${rn}&dcmNo=${dcm}&eleId=${ele}&offset=${off}&length=${lng}&dtd=${dtd}`;
    const docRes = await fetch(docUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rcpNo}`,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!docRes.ok) return [];

    // 인코딩 감지 (MS949/EUC-KR 처리)
    const ct = docRes.headers.get('content-type') ?? '';
    const charsetRaw = ct.match(/charset=([^\s;]+)/i)?.[1]?.toLowerCase() ?? 'utf-8';
    let text: string;
    if (charsetRaw === 'ms949' || charsetRaw === 'euc-kr' || charsetRaw === 'ks_c_5601-1987') {
      const buf = await docRes.arrayBuffer();
      text = new TextDecoder('euc-kr').decode(new Uint8Array(buf));
    } else {
      text = await docRes.text();
    }

    const cleaned = text
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    // 3) 재무 테이블 추출 시도 (잠정실적 등)
    const tds = [...cleaned.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(m => decodeEntities(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim())
      .filter(t => t.length > 0 && t !== ' ');
    const financial = parseDartFinancial(tds);
    if (financial.length > 0) return financial;

    // 4) 번호 섹션 분할 (수시공시 폼: 1. 항목 형식)
    const fullText = decodeEntities(cleaned.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    const sections = fullText
      .split(/(?<=\s)(?=\d{1,2}\.\s+[가-힣A-Z(])/)
      .slice(1)  // 섹션 번호 앞 헤더(회사명/폼명/날짜) 제거
      .map(s => s.replace(/\s+/g, ' ').trim())
      .filter(s =>
        s.length > 15 && s.length < 250 &&
        !DART_BOILERPLATE.test(s) &&
        !DART_USELESS.test(s) &&
        s.replace(/[-–\s]/g, '').length > 10
      )
      .map(s => s.slice(0, 120));

    if (sections.length > 0) return sections.slice(0, 4);

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

  // DART — report/viewer.do 를 통해 문서 내용 추출
  if (url.includes('dart.fss.or.kr')) {
    const bullets = await fetchDartContent(url);
    return NextResponse.json({ bullets, dartFiling: true });
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
