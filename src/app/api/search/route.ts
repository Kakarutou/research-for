import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import krStocksRaw from '@/lib/kr-stocks.json';
import usStocksKrRaw from '@/lib/us-stocks-kr.json';
import jpStocksKrRaw from '@/lib/jp-stocks-kr.json';

export interface SearchResult {
  symbol: string;
  name: string;
}

const KR_STOCKS = krStocksRaw as Record<string, { symbol: string; name: string }>;
const KR_ENTRIES = Object.values(KR_STOCKS);

const KR_US = usStocksKrRaw as Record<string, { symbol: string; name: string }>;
const KR_JP = jpStocksKrRaw as Record<string, { symbol: string; name: string }>;
const KR_US_ENTRIES = Object.entries(KR_US);
const KR_JP_ENTRIES = Object.entries(KR_JP);

// 한글 코인명 → Yahoo Finance symbol
const KR_CRYPTO: Record<string, { symbol: string; name: string }> = {
  '비트코인':       { symbol: 'BTC-USD', name: 'Bitcoin' },
  '이더리움':       { symbol: 'ETH-USD', name: 'Ethereum' },
  '리플':           { symbol: 'XRP-USD', name: 'XRP' },
  '솔라나':         { symbol: 'SOL-USD', name: 'Solana' },
  '도지코인':       { symbol: 'DOGE-USD', name: 'Dogecoin' },
  '카르다노':       { symbol: 'ADA-USD', name: 'Cardano' },
  '에이다':         { symbol: 'ADA-USD', name: 'Cardano' },
  '아발란체':       { symbol: 'AVAX-USD', name: 'Avalanche' },
  '폴카닷':         { symbol: 'DOT-USD', name: 'Polkadot' },
  '체인링크':       { symbol: 'LINK-USD', name: 'Chainlink' },
  '바이낸스코인':   { symbol: 'BNB-USD', name: 'BNB' },
  '수이':           { symbol: 'SUI-USD', name: 'Sui' },
  '트론':           { symbol: 'TRX-USD', name: 'TRON' },
  '라이트코인':     { symbol: 'LTC-USD', name: 'Litecoin' },
  '비트코인캐시':   { symbol: 'BCH-USD', name: 'Bitcoin Cash' },
  '이더리움클래식': { symbol: 'ETC-USD', name: 'Ethereum Classic' },
  '폴리곤':         { symbol: 'POL-USD', name: 'POL (Polygon)' },
  '스텔라':         { symbol: 'XLM-USD', name: 'Stellar' },
  '유니스왑':       { symbol: 'UNI-USD', name: 'Uniswap' },
  '에이브':         { symbol: 'AAVE-USD', name: 'Aave' },
  '코스모스':       { symbol: 'ATOM-USD', name: 'Cosmos' },
  '앱토스':         { symbol: 'APT-USD', name: 'Aptos' },
  '아비트럼':       { symbol: 'ARB-USD', name: 'Arbitrum' },
  '옵티미즘':       { symbol: 'OP-USD', name: 'Optimism' },
  '니어':           { symbol: 'NEAR-USD', name: 'NEAR Protocol' },
  '파일코인':       { symbol: 'FIL-USD', name: 'Filecoin' },
  '샌드박스':       { symbol: 'SAND-USD', name: 'The Sandbox' },
  '시바이누':       { symbol: 'SHIB-USD', name: 'Shiba Inu' },
  '페페':           { symbol: 'PEPE-USD', name: 'Pepe' },
  '알고랜드':       { symbol: 'ALGO-USD', name: 'Algorand' },
  '칠리즈':         { symbol: 'CHZ-USD', name: 'Chiliz' },
};
const KR_CRYPTO_ENTRIES = Object.entries(KR_CRYPTO);

function searchKorean(q: string): SearchResult[] {
  const lower = q.toLowerCase();
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  const push = (entry: { symbol: string; name: string }) => {
    if (!seen.has(entry.symbol)) { seen.add(entry.symbol); results.push(entry); }
  };

  // 1. 코인 한글명 (정확히 시작하는 것)
  for (const [key, entry] of KR_CRYPTO_ENTRIES) {
    if (key.startsWith(q) || q.startsWith(key)) push(entry);
    if (results.length >= 6) return results;
  }

  // 2. 미국 주식 한국어명 (정확 일치 우선, 그 다음 포함)
  for (const [key, entry] of KR_US_ENTRIES) {
    if (key === q || key.startsWith(q)) push(entry);
    if (results.length >= 6) return results;
  }
  for (const [key, entry] of KR_US_ENTRIES) {
    if (!key.startsWith(q) && key.includes(q)) push(entry);
    if (results.length >= 6) return results;
  }

  // 3. 일본 주식 한국어명
  for (const [key, entry] of KR_JP_ENTRIES) {
    if (key === q || key.startsWith(q)) push(entry);
    if (results.length >= 6) return results;
  }
  for (const [key, entry] of KR_JP_ENTRIES) {
    if (!key.startsWith(q) && key.includes(q)) push(entry);
    if (results.length >= 6) return results;
  }

  // 4. 한국 주식 앞에서 시작하는 것
  for (const entry of KR_ENTRIES) {
    if (entry.name.startsWith(q)) push(entry);
    if (results.length >= 6) return results;
  }
  // 한국 주식 포함하는 것
  for (const entry of KR_ENTRIES) {
    if (!entry.name.startsWith(q) && entry.name.includes(q)) {
      push(entry);
      if (results.length >= 6) break;
    }
  }

  // 5. 코드로도 검색 (예: 005930)
  if (results.length === 0) {
    for (const entry of KR_ENTRIES) {
      if (entry.symbol.toLowerCase().startsWith(lower)) {
        push(entry);
        if (results.length >= 6) break;
      }
    }
  }

  return results.slice(0, 6);
}

function hasKorean(s: string) {
  return /[가-힣]/.test(s);
}

async function yahooSearch(q: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=6&newsCount=0`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://finance.yahoo.com',
        },
        cache: 'no-store',
      },
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json.quotes ?? [])
      .filter((r: Record<string, string>) => r.symbol && (r.shortname || r.longname))
      .slice(0, 6)
      .map((r: Record<string, string>) => ({ symbol: r.symbol, name: r.shortname || r.longname }));
  } catch {
    return [];
  }
}

async function finnhubSearch(q: string): Promise<SearchResult[]> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${key}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json.result ?? [])
      .filter((r: Record<string, string>) => r.symbol && r.description)
      .slice(0, 6)
      .map((r: Record<string, string>) => ({ symbol: r.symbol, name: r.description }));
  } catch {
    return [];
  }
}

// 한국어 음차 → 영어 변환 테이블 (자주 쓰이는 패턴)
const KO_TO_EN: [RegExp, string][] = [
  [/랙스페이스/g, 'Rackspace'], [/테크놀로지/g, 'Technology'], [/테크/g, 'Tech'],
  [/홀딩스/g, 'Holdings'], [/홀딩/g, 'Holdings'], [/파이낸셜/g, 'Financial'],
  [/그룹/g, 'Group'], [/코퍼레이션/g, 'Corporation'], [/코프/g, 'Corp'],
  [/인터내셔널/g, 'International'], [/인코퍼레이티드/g, 'Inc'], [/인크/g, 'Inc'],
  [/시스템즈/g, 'Systems'], [/시스템/g, 'Systems'], [/솔루션즈/g, 'Solutions'],
  [/솔루션/g, 'Solutions'], [/서비시즈/g, 'Services'], [/서비스/g, 'Services'],
  [/네트웍스/g, 'Networks'], [/네트워크/g, 'Networks'], [/커뮤니케이션즈/g, 'Communications'],
  [/커뮤니케이션/g, 'Communications'], [/인더스트리즈/g, 'Industries'],
  [/인더스트리/g, 'Industries'], [/에너지/g, 'Energy'], [/캐피탈/g, 'Capital'],
  [/마켓/g, 'Markets'], [/마케츠/g, 'Markets'], [/엔터프라이즈/g, 'Enterprise'],
  [/플랫폼/g, 'Platform'], [/플랫폼즈/g, 'Platforms'], [/파트너스/g, 'Partners'],
  [/파트너/g, 'Partner'], [/어소시에이츠/g, 'Associates'], [/벤처스/g, 'Ventures'],
  [/라이프사이언스/g, 'Life Sciences'], [/바이오사이언스/g, 'BioSciences'],
  [/바이오텍/g, 'Biotech'], [/파마슈티컬/g, 'Pharmaceuticals'], [/파마/g, 'Pharma'],
  [/모터스/g, 'Motors'], [/오토모티브/g, 'Automotive'], [/일렉트릭/g, 'Electric'],
  [/일렉트로닉스/g, 'Electronics'], [/글로벌/g, 'Global'], [/리소시즈/g, 'Resources'],
];

function koreanTranslit(q: string): string {
  let result = q;
  for (const [pattern, replacement] of KO_TO_EN) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/\s+/g, ' ').trim();
}

// GET: search
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q) return NextResponse.json([]);

  if (hasKorean(q)) {
    const local = searchKorean(q);
    if (local.length > 0) return NextResponse.json(local);

    // 로컬 매핑 없음 → 음차 변환 후 Finnhub + Yahoo 병렬 검색
    const translitQ = koreanTranslit(q);
    const searchQ = translitQ !== q ? translitQ : q;
    const [finnhub, yahoo] = await Promise.all([
      finnhubSearch(searchQ),
      yahooSearch(searchQ),
    ]);
    // 중복 제거 후 합치기
    const seen = new Set<string>();
    const merged: SearchResult[] = [];
    for (const r of [...finnhub, ...yahoo]) {
      if (!seen.has(r.symbol)) { seen.add(r.symbol); merged.push(r); }
    }
    return NextResponse.json(merged.slice(0, 6));
  }

  // 영어/티커 → Yahoo Finance
  const results = await yahooSearch(q);
  return NextResponse.json(results);
}

// POST: log a search to MongoDB
export async function POST(req: NextRequest) {
  try {
    const { symbol, name } = await req.json();
    if (!symbol || !name) return NextResponse.json({ ok: false });
    const db = await getDb();
    await db.collection('searches').insertOne({
      symbol: String(symbol).toUpperCase(),
      name: String(name),
      searchedAt: new Date(),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
