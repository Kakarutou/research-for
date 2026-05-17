import { NextRequest, NextResponse } from 'next/server';
import type { NewsItem } from '../news/route';

const UA = 'research-for wjddlswjs7398@gmail.com';

function getKoreanCode(ticker: string): string | null {
  if (/^\d{6}$/.test(ticker)) return ticker;
  const upper = ticker.toUpperCase();
  if (upper.endsWith('.KS') || upper.endsWith('.KQ')) return ticker.slice(0, 6);
  return null;
}

function classifyDart(title: string): string {
  if (/사업보고서|분기보고서|반기보고서|감사보고서/.test(title)) return '정기공시';
  if (/주요사항/.test(title)) return '주요사항';
  if (/전환사채|유상증자|신주인수권|증권신고서|신주발행/.test(title)) return '발행공시';
  if (/대량보유|주식등의대량|임원.*변동|소유주식변동/.test(title)) return '지분공시';
  return '수시공시';
}

const dartCodeCache: Record<string, string | null> = {};

async function getDartCode(stockCode: string): Promise<string | null> {
  if (stockCode in dartCodeCache) return dartCodeCache[stockCode];
  try {
    const res = await fetch('https://dart.fss.or.kr/corp/searchCorp.ax', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://dart.fss.or.kr',
      },
      body: `currentPage=1&maxResults=5&textCrpNm=${encodeURIComponent(stockCode)}`,
      cache: 'no-store',
    });
    if (!res.ok) { dartCodeCache[stockCode] = null; return null; }
    const html = await res.text();
    const m = html.match(/name='hiddenCikCD\d+'\s+value='(\d{8})'/);
    const code = m ? m[1] : null;
    dartCodeCache[stockCode] = code;
    return code;
  } catch {
    dartCodeCache[stockCode] = null;
    return null;
  }
}

async function fetchDartDisclosures(stockCode: string): Promise<NewsItem[]> {
  try {
    const dartCode = await getDartCode(stockCode);
    if (!dartCode) return [];

    const res = await fetch('https://dart.fss.or.kr/dsab007/detailSearch.ax', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://dart.fss.or.kr',
        'Accept': 'text/html,application/xhtml+xml',
      },
      body: `currentPage=1&maxResults=30&textCrpCik=${encodeURIComponent(dartCode)}`,
      cache: 'no-store',
    });

    if (!res.ok) return [];

    const html = await res.text();
    const results: NewsItem[] = [];

    for (const [, row] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const linkMatch = row.match(/href="\/dsaf001\/main\.do\?rcpNo=(\d+)"/);
      if (!linkMatch) continue;
      const rcpNo = linkMatch[1];

      const titleMatch = row.match(/openReportViewer\('[^']*','[^']*'\)[^>]*>([\s\S]*?)<\/a>/);
      if (!titleMatch) continue;
      const title = titleMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (!title) continue;

      const dateMatches = [...row.matchAll(/>(\d{4}\.\d{2}\.\d{2})</g)];
      if (!dateMatches.length) continue;
      const dateStr = dateMatches[dateMatches.length - 1][1];
      const publishedAt = Math.floor(new Date(dateStr.replace(/\./g, '-')).getTime() / 1000);

      const category = classifyDart(title);
      const url = `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rcpNo}`;
      results.push({ title: `[${category}] ${title}`, source: 'DART', publishedAt, url });
    }

    return results.slice(0, 30);
  } catch {
    return [];
  }
}

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
  // ── 미국 정기 보고서 ──
  '8-K':        '수시공시 (8-K)',
  '8-K/A':      '수시공시 수정 (8-K/A)',
  '10-K':       '연간보고서 (10-K)',
  '10-K/A':     '연간보고서 수정 (10-K/A)',
  '10-Q':       '분기보고서 (10-Q)',
  '10-Q/A':     '분기보고서 수정 (10-Q/A)',
  'NT 10-K':    '연간보고서 제출 지연',
  'NT 10-Q':    '분기보고서 제출 지연',
  // ── 주주총회·위임장 ──
  'DEF 14A':    '주주총회 위임장',
  'DEFA14A':    '주주총회 위임장 보완',
  'PRE 14A':    '주주총회 위임장 사전본',
  // ── 증권 신고서 (IPO·유상증자) ──
  'S-1':        'IPO 신고서',
  'S-1/A':      'IPO 신고서 수정',
  'S-3':        '유가증권 신고서',
  'S-3/A':      '유가증권 신고서 수정',
  'S-3ASR':     '자동선반신고서 (증자 예고)',
  'S-4':        '합병·교환공모 신고서',
  'S-4/A':      '합병·교환공모 신고서 수정',
  '424B2':      '투자설명서',
  '424B3':      '투자설명서',
  '424B4':      '투자설명서',
  '424B5':      '투자설명서 추가',
  // ── 대량보유·지분 보고서 (SC 13G/D) — 약식·정식 둘 다 ──
  'SC 13G':         '대량보유 보고서',
  'SC 13G/A':       '대량보유 보고서 수정',
  'SC 13D':         '대량보유 변경 보고서',
  'SC 13D/A':       '대량보유 변경 수정',
  'SCHEDULE 13G':   '대량보유 보고서',
  'SCHEDULE 13G/A': '대량보유 보고서 수정',
  'SCHEDULE 13D':   '대량보유 변경 보고서',
  'SCHEDULE 13D/A': '대량보유 변경 수정',
  // ── 공개매수 ──
  'SC TO-T':    '공개매수 신고서 (제3자)',
  'SC TO-T/A':  '공개매수 신고서 수정',
  'SC TO-I':    '자사주 공개매수 신고서',
  'SC TO-I/A':  '자사주 공개매수 수정',
  // ── 내부자 거래 ──
  '4':          '내부자 거래 (Form 4)',
  '4/A':        '내부자 거래 수정 (Form 4/A)',
  '3':          '임원·주요주주 초기신고 (Form 3)',
  '3/A':        '임원·주요주주 초기신고 수정',
  // ── 외국 기업 (ADR·외국 상장사) ──
  '6-K':        '수시공시 (6-K)',
  '6-K/A':      '수시공시 수정 (6-K/A)',
  '20-F':       '연간보고서 (20-F)',
  '20-F/A':     '연간보고서 수정 (20-F/A)',
  'NT 20-F':    '연간보고서 제출 지연 (외국기업)',
  '40-F':       '연간보고서 (40-F)',
  '40-F/A':     '연간보고서 수정 (40-F/A)',
  'NT 40-F':    '연간보고서 제출 지연 (캐나다)',
  'F-1':        'IPO 신고서 (외국기업)',
  'F-1/A':      'IPO 신고서 수정 (외국기업)',
  'F-3':        '유가증권 신고서 (외국기업)',
  'F-3/A':      '유가증권 신고서 수정 (외국기업)',
  'F-3ASR':     '자동선반신고서 (외국기업)',
  'F-4':        '합병·교환공모 신고서 (외국기업)',
  'F-4/A':      '합병·교환공모 신고서 수정 (외국기업)',
};

const TARGET_FORMS = new Set(Object.keys(FORM_LABELS));

const cikCache: Record<string, number | null> = {};

async function getCik(ticker: string): Promise<number | null> {
  if (ticker in cikCache) return cikCache[ticker];

  // 1차: company_tickers.json (미국 내국 기업 + 일부 외국기업)
  try {
    const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': UA },
      next: { revalidate: 86400 },
    });
    if (res.ok) {
      const data: Record<string, { cik_str: number; ticker: string }> = await res.json();
      for (const v of Object.values(data)) {
        if (v.ticker.toUpperCase() === ticker.toUpperCase()) {
          cikCache[ticker] = v.cik_str;
          return v.cik_str;
        }
      }
    }
  } catch {}

  // 2차 fallback: EDGAR 직접 검색 (외국계·최근상장·ADR 등 모든 SEC 등록 기업)
  try {
    const res = await fetch(
      `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=&CIK=${encodeURIComponent(ticker)}&type=&dateb=&owner=include&count=1&search_text=&output=atom`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) },
    );
    if (res.ok) {
      const xml = await res.text();
      const m = xml.match(/<cik>(\d+)<\/cik>/i);
      if (m) {
        const cik = parseInt(m[1], 10);
        cikCache[ticker] = cik;
        return cik;
      }
    }
  } catch {}

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

  const krCode = getKoreanCode(ticker);
  if (krCode) {
    const disclosures = await fetchDartDisclosures(krCode);
    return NextResponse.json(disclosures);
  }

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
    let form4Count = 0;
    let form3Count = 0;

    for (let i = 0; i < forms.length && result.length < 40; i++) {
      if (!TARGET_FORMS.has(forms[i])) continue;

      const form  = forms[i];
      const date  = dates[i];
      const accn  = accns[i];
      const item  = items[i] ?? '';

      // Form 4/3는 건수가 많으므로 제한
      if ((form === '4' || form === '4/A') && form4Count >= 10) continue;
      if (form === '4' || form === '4/A') form4Count++;
      if ((form === '3' || form === '3/A') && form3Count >= 5) continue;
      if (form === '3' || form === '3/A') form3Count++;

      const title       = buildTitle(form, item, ticker.toUpperCase());
      const publishedAt = date ? Math.floor(new Date(date).getTime() / 1000) : 0;
      const cleanAccn   = accn.replace(/-/g, '');
      // SC 13G/D, SC TO 등 제3자 제출 공시는 기관투자자 CIK로 저장됨
      // accn 앞 10자리가 실제 파일러 CIK (ex: "0002134513-26-000001" → 2134513)
      const THIRD_PARTY_FORMS = new Set([
        'SC 13G', 'SC 13G/A', 'SC 13D', 'SC 13D/A',
        'SCHEDULE 13G', 'SCHEDULE 13G/A', 'SCHEDULE 13D', 'SCHEDULE 13D/A',
        'SC TO-T', 'SC TO-T/A', 'SC TO-I', 'SC TO-I/A',
      ]);
      const filerCik = THIRD_PARTY_FORMS.has(form) ? parseInt(accn.slice(0, 10), 10) : cik;
      const url = `https://www.sec.gov/Archives/edgar/data/${filerCik}/${cleanAccn}/${accn}-index.htm`;

      result.push({ title, source: 'SEC EDGAR', publishedAt, url } satisfies NewsItem);
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json([]);
  }
}
