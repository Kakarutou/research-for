import { NextRequest, NextResponse } from 'next/server';
import type { NewsItem } from '../news/route';

const UA = 'research-for wjddlswjs7398@gmail.com';

// 8-K 아이템 코드 → 한국어 설명
const ITEM_LABELS: Record<string, string> = {
  '1.01': '중요 계약 체결',
  '1.02': '중요 계약 해지',
  '1.03': '파산/회생절차',
  '2.01': '인수·합병 완료',
  '2.02': '실적 발표',
  '2.03': '직접금융의무 발생',
  '2.04': '재무 트리거 이벤트',
  '2.05': '자산 손상',
  '2.06': '자산 손상 추가',
  '4.01': '감사인 변경',
  '4.02': '회계 재검토',
  '5.01': '경영권 변동',
  '5.02': '임원 변경',
  '5.03': '정관 변경',
  '5.04': '배당 정지',
  '5.05': '주주총회 의안',
  '5.06': '미등록 주식 판매',
  '5.07': '주주총회 결과',
  '5.08': '공시 유예 적용',
  '7.01': 'Reg FD 공시',
  '8.01': '기타 공시',
  '9.01': '재무제표 첨부',
};

// 폼 타입 → 한국어 레이블
const FORM_LABELS: Record<string, string> = {
  '8-K':     '수시공시 (8-K)',
  '10-K':    '연간보고서 (10-K)',
  '10-Q':    '분기보고서 (10-Q)',
  'DEF 14A': '주주총회 위임장',
  'S-1':     'IPO 신고서',
  'S-3':     '유가증권 신고서',
  '424B4':   '투자설명서',
  'SC 13G':  '대량보유 보고서',
  'SC 13D':  '대량보유 변경 보고서',
  'SC 13G/A':'대량보유 보고서 수정',
  'SC 13D/A':'대량보유 변경 수정',
};

const TARGET_FORMS = new Set(Object.keys(FORM_LABELS));

const cikCache: Record<string, number | null> = {};

async function getCik(ticker: string): Promise<number | null> {
  if (ticker in cikCache) return cikCache[ticker];
  const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': UA },
    next: { revalidate: 86400 },
  });
  if (!res.ok) { cikCache[ticker] = null; return null; }
  const data: Record<string, { cik_str: number; ticker: string }> = await res.json();
  for (const v of Object.values(data)) {
    if (v.ticker.toUpperCase() === ticker.toUpperCase()) {
      cikCache[ticker] = v.cik_str;
      return v.cik_str;
    }
  }
  cikCache[ticker] = null;
  return null;
}

function buildTitle(form: string, items: string, ticker: string): string {
  const base = FORM_LABELS[form] ?? form;

  if (form === '8-K' && items) {
    const codes = items.split(',').map(s => s.trim()).filter(c => c !== '9.01');
    const labels = codes.map(c => ITEM_LABELS[c]).filter(Boolean);
    if (labels.length > 0) return `[${ticker}] ${base} — ${labels.join(' / ')}`;
  }

  return `[${ticker}] ${base}`;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;

  try {
    const cik = await getCik(ticker);
    if (!cik) return NextResponse.json([]);

    const pad = String(cik).padStart(10, '0');
    const res = await fetch(`https://data.sec.gov/submissions/CIK${pad}.json`, {
      headers: { 'User-Agent': UA },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json([]);

    const data = await res.json();
    const recent = data.filings?.recent ?? {};
    const forms: string[]  = recent.form          ?? [];
    const dates: string[]  = recent.filingDate     ?? [];
    const accns: string[]  = recent.accessionNumber ?? [];
    const items: string[]  = recent.items          ?? [];

    const result: NewsItem[] = [];

    for (let i = 0; i < forms.length && result.length < 30; i++) {
      if (!TARGET_FORMS.has(forms[i])) continue;

      const form  = forms[i];
      const date  = dates[i];
      const accn  = accns[i];
      const item  = items[i] ?? '';

      const title       = buildTitle(form, item, ticker.toUpperCase());
      const publishedAt = date ? Math.floor(new Date(date).getTime() / 1000) : 0;
      const cleanAccn   = accn.replace(/-/g, '');
      const url         = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=${encodeURIComponent(form)}&dateb=&owner=include&count=10`;

      result.push({ title, source: 'SEC EDGAR', publishedAt, url } satisfies NewsItem);
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json([]);
  }
}
