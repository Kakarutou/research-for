import { NextRequest, NextResponse } from 'next/server';
import type { NewsItem } from '../news/route';

const HEADERS = { 'User-Agent': 'research-for wjddlswjs7398@gmail.com' };

// ticker → CIK (cached in memory per process)
const cikCache: Record<string, number | null> = {};

async function getCik(ticker: string): Promise<number | null> {
  if (ticker in cikCache) return cikCache[ticker];
  cikCache[ticker] = null;

  // 1차: company_tickers.json
  try {
    const res = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: HEADERS, next: { revalidate: 86400 } });
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

  // 2차 fallback: EDGAR 직접 검색 (외국기업·최근상장)
  try {
    const res = await fetch(
      `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=&CIK=${encodeURIComponent(ticker)}&type=&dateb=&owner=include&count=1&search_text=&output=atom`,
      { headers: HEADERS, signal: AbortSignal.timeout(8000) },
    );
    if (res.ok) {
      const xml = await res.text();
      const m = xml.match(/<cik>(\d+)<\/cik>/i);
      if (m) { cikCache[ticker] = parseInt(m[1], 10); return cikCache[ticker]; }
    }
  } catch {}

  return null;
}

// transaction code → label
const CODE: Record<string, string> = {
  S: 'sells', P: 'buys', A: 'awarded', D: 'disposed', F: 'tax withheld',
  G: 'gifted', M: 'option exercised', X: 'option expired',
};

interface Form4Row {
  name: string;
  title: string;
  date: string;       // YYYY-MM-DD
  code: string;       // S / P / A …
  shares: string;
  price: string;
  accn: string;
  cik: number;        // 회사 CIK (URL 생성에 필요)
}

async function getRecentForm4s(cik: number): Promise<Form4Row[]> {
  const pad = String(cik).padStart(10, '0');
  const res = await fetch(`https://data.sec.gov/submissions/CIK${pad}.json`, { headers: HEADERS, cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json();
  const recent = data.filings?.recent ?? {};
  const forms: string[]  = recent.form          ?? [];
  const dates: string[]  = recent.filingDate    ?? [];
  const accns: string[]  = recent.accessionNumber ?? [];

  const rows: { date: string; accn: string }[] = [];
  for (let i = 0; i < forms.length && rows.length < 15; i++) {
    if (forms[i] === '4') rows.push({ date: dates[i], accn: accns[i] });
  }
  return rows.length === 0 ? [] : parseForm4s(cik, rows);
}

async function parseForm4s(cik: number, rows: { date: string; accn: string }[]): Promise<Form4Row[]> {
  const results: Form4Row[] = [];

  await Promise.all(rows.map(async ({ date, accn }) => {
    try {
      const cleanAccn = accn.replace(/-/g, '');
      // index page to find the XML filename
      const idxRes = await fetch(
        `https://www.sec.gov/Archives/edgar/data/${cik}/${cleanAccn}/${accn}-index.htm`,
        { headers: HEADERS, cache: 'no-store' },
      );
      if (!idxRes.ok) return;
      const html = await idxRes.text();
      // skip XSL-styled variant (xslF345X06/...) — grab the raw XML
      const xmlMatches = [...html.matchAll(/href="([^"]*\.xml)"/g)];
      const rawXml = xmlMatches.find(m => !m[1].includes('xslF'));
      if (!rawXml) return;

      const xmlUrl = `https://www.sec.gov${rawXml[1]}`;
      const xmlRes = await fetch(xmlUrl, { headers: HEADERS, cache: 'no-store' });
      if (!xmlRes.ok) return;
      const xml = await xmlRes.text();

      const get = (tag: string) => xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<`))?.[1]?.trim() ?? '';

      const name  = get('rptOwnerName');
      const title = get('officerTitle');

      const txnBlocks = [...xml.matchAll(/<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/g)];
      for (const [, block] of txnBlocks) {
        const getB = (tag: string) => block.match(new RegExp(`<${tag}[^>]*>([^<]*)<`))?.[1]?.trim() ?? '';
        const code   = getB('transactionCode');
        const sharesDeep = block.match(/<transactionShares>[\s\S]*?<value>([^<]*)</)?.[1]?.trim() ?? '';
        const shares = getB('transactionShares') || sharesDeep;
        const price  = block.match(/<transactionPricePerShare>[\s\S]*?<value>([^<]*)</)?.[1]?.trim() ?? '';
        if (code && name) results.push({ name, title, date, code, shares, price, accn, cik });
      }
    } catch { /* skip malformed filings */ }
  }));

  return results;
}

function toNewsItem(row: Form4Row): NewsItem {
  const verb  = CODE[row.code] ?? row.code;
  const num   = row.shares ? `${Number(row.shares).toLocaleString()} shares` : '';
  const at    = row.price && row.price !== '0' ? ` @ $${Number(row.price).toFixed(2)}` : '';
  const role  = row.title ? ` (${row.title})` : '';
  const title = `Insider ${verb} shares — ${row.name}${role}: ${num}${at}`;

  const ts = row.date ? Math.floor(new Date(row.date).getTime() / 1000) : Math.floor(Date.now() / 1000);
  const cleanAccn = row.accn.replace(/-/g, '');
  return {
    title,
    source: 'SEC Form 4',
    publishedAt: ts,
    url: `https://www.sec.gov/Archives/edgar/data/${row.cik}/${cleanAccn}/${row.accn}-index.htm`,
  };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  try {
    const cik = await getCik(ticker);
    if (!cik) return NextResponse.json([]);
    const rows = await getRecentForm4s(cik);
    return NextResponse.json(rows.map(toNewsItem));
  } catch {
    return NextResponse.json([]);
  }
}
