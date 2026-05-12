import { NextRequest, NextResponse } from 'next/server';

const UA = 'research-for wjddlswjs7398@gmail.com';
const cikCache: Record<string, number | null> = {};

export interface EarningsItem {
  quarter: string;           // "Q1 2026"
  headline: string | null;   // "Reports First Quarter 2026 Results"
  revenue: string | null;    // "$678M"
  revenueYoY: string | null; // "+2%"
  eps: string | null;        // "$0.03"
  netIncome: string | null;  // "$8M"
  opProfit: string | null;   // Non-GAAP operating profit
  ceoQuote: string | null;
  guidance: string | null;
  publishedAt: number;
  url: string;
}

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

function quarterLabel(date: string): string {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const q = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
  return `${q} ${d.getFullYear()}`;
}

async function getExhibit991Url(cik: number, accn: string): Promise<string | null> {
  const cleanAccn = accn.replace(/-/g, '');
  try {
    const res = await fetch(
      `https://www.sec.gov/Archives/edgar/data/${cik}/${cleanAccn}/${accn}-index.htm`,
      { headers: { 'User-Agent': UA }, cache: 'no-store' },
    );
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/EX-99\.1[\s\S]*?href="(\/Archives[^"]+\.htm[l]?)"/i);
    return match ? `https://www.sec.gov${match[1]}` : null;
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#8226;/g, '• ')
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#8211;|&#8212;/g, '–')
    .replace(/&#58;/g, ':')
    .replace(/&#59;/g, ';')
    .replace(/&#160;/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function fmtMoney(val: string, unit: string): string {
  const n = parseFloat(val.replace(/,/g, ''));
  const u = unit.toLowerCase().startsWith('b') ? 'B' : 'M';
  return `$${Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1)}${u}`;
}

function parseYoY(text: string, fromIndex: number): string | null {
  const nearby = text.slice(fromIndex, fromIndex + 400);
  const m = nearby.match(/(increase|decrease|up|down)\s+(?:of\s+)?([\d\.]+)%/i);
  if (!m) return null;
  const isUp = /increase|up/i.test(m[1]);
  return (isUp ? '+' : '-') + m[2] + '%';
}

function parseEarnings(text: string, fallbackQuarter: string): Omit<EarningsItem, 'publishedAt' | 'url'> {
  // Quarter
  const qMap: Record<string, string> = { first: 'Q1', second: 'Q2', third: 'Q3', fourth: 'Q4' };
  const qm = text.match(/(first|second|third|fourth)\s+quarter(?:\s+(?:of\s+)?(\d{4}))?/i);
  const quarter = qm
    ? `${qMap[qm[1].toLowerCase()] ?? ''}${qm[2] ? ' ' + qm[2] : ''}`
    : fallbackQuarter;

  // Headline: text between last "Exhibit 99.1" and first bullet "•"
  let headline: string | null = null;
  const exIdx = text.lastIndexOf('Exhibit 99.1');
  const bulletIdx = text.indexOf('•');
  if (exIdx !== -1 && bulletIdx > exIdx) {
    const between = text.slice(exIdx + 'Exhibit 99.1'.length, bulletIdx).trim();
    // Strip leading "DocumentExhibit 99.1" artifacts and take meaningful sentence
    const cleaned = between.replace(/^[Dd]ocument\s*/i, '').trim();
    if (cleaned.length > 10 && cleaned.length < 200) headline = cleaned;
  }
  // Fallback: look for "Reports ... Results" pattern
  if (!headline) {
    const m = text.match(/[A-Z][A-Za-z\s,]+(?:Reports?|Announces?)[^.]{10,120}(?:Results?|Earnings)[^.]*/i);
    if (m) headline = m[0].trim();
  }

  // Revenue
  let revenue: string | null = null;
  let revenueYoY: string | null = null;
  const revM = text.match(/[Rr]evenue(?:\s+was|\s+of)?\s+\$([\d,\.]+)\s*(billion|million)/i);
  if (revM) {
    revenue = fmtMoney(revM[1], revM[2]);
    revenueYoY = parseYoY(text, revM.index!);
  }

  // EPS (diluted)
  let eps: string | null = null;
  const epsM = text.match(/(?:earnings|income|loss)\s+per\s+(?:diluted\s+)?share[s]?(?:\s+was|\s+of|:)?\s+\$\(?([\d\.]+)\)?/i);
  if (epsM) {
    // Check if it's a loss (surrounded by parens in original)
    const ctxBefore = text.slice(Math.max(0, (epsM.index ?? 0) - 30), epsM.index ?? 0);
    const isLoss = /[Ll]oss/.test(ctxBefore + epsM[0].slice(0, 20));
    eps = (isLoss && !epsM[0].includes('earnings per')) ? `-$${epsM[1]}` : `$${epsM[1]}`;
  }

  // Net income / loss
  let netIncome: string | null = null;
  const niM = text.match(/[Nn]et\s+(income|loss)(?:\s+was|\s+of)?\s+\$?\(?([\d,\.]+)\)?\s*(billion|million)/i);
  if (niM) {
    const sign = niM[1].toLowerCase() === 'loss' ? '-' : '';
    netIncome = `${sign}${fmtMoney(niM[2], niM[3])}`;
  }

  // Non-GAAP operating profit
  let opProfit: string | null = null;
  const opM = text.match(/[Nn]on-GAAP\s+[Oo]perating\s+[Pp]rofit(?:\s+was|\s+of)?\s+\$([\d,\.]+)\s*(billion|million)/i);
  if (opM) opProfit = fmtMoney(opM[1], opM[2]);

  // CEO / CFO quote — first substantive quote after "stated" or name of exec
  let ceoQuote: string | null = null;
  const quoteRe = /(?:stated|said|commented)[,:]?\s+"([^"]{50,400})"/gi;
  const qResult = quoteRe.exec(text);
  if (qResult) ceoQuote = qResult[1].trim();

  // Guidance — next quarter or full year
  let guidance: string | null = null;
  const guidM = text.match(/[Ff]or (?:the\s+)?(?:second|third|fourth|full\s+year|fiscal)[^.]{0,300}(?:expects?|projects?|anticipates?)[^.]{0,200}\./i);
  if (guidM) {
    const g = guidM[0].trim();
    guidance = g.length > 200 ? g.slice(0, 197) + '...' : g;
  }

  return { quarter, headline, revenue, revenueYoY, eps, netIncome, opProfit, ceoQuote, guidance };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;

  try {
    const cik = await getCik(ticker);
    if (!cik) return NextResponse.json([]);

    const pad = String(cik).padStart(10, '0');
    const subRes = await fetch(`https://data.sec.gov/submissions/CIK${pad}.json`, {
      headers: { 'User-Agent': UA },
      cache: 'no-store',
    });
    if (!subRes.ok) return NextResponse.json([]);

    const data = await subRes.json();
    const recent = data.filings?.recent ?? {};
    const forms: string[]     = recent.form             ?? [];
    const dates: string[]     = recent.filingDate        ?? [];
    const accns: string[]     = recent.accessionNumber   ?? [];
    const itemCodes: string[] = recent.items             ?? [];

    // 2-year cutoff
    const cutoff = Math.floor(Date.now() / 1000) - 2 * 365 * 24 * 3600;

    const earningsFilings: { date: string; accn: string }[] = [];
    for (let i = 0; i < forms.length && earningsFilings.length < 8; i++) {
      if (forms[i] !== '8-K') continue;
      if (!(itemCodes[i] ?? '').includes('2.02')) continue;
      const ts = dates[i] ? Math.floor(new Date(dates[i]).getTime() / 1000) : 0;
      if (ts < cutoff) break; // filings are sorted newest-first; stop early
      earningsFilings.push({ date: dates[i], accn: accns[i] });
    }

    if (earningsFilings.length === 0) return NextResponse.json([]);

    const results: EarningsItem[] = await Promise.all(
      earningsFilings.map(async ({ date, accn }): Promise<EarningsItem> => {
        const fallbackQuarter = quarterLabel(date);
        const publishedAt = date ? Math.floor(new Date(date).getTime() / 1000) : 0;
        const fallbackUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=8-K&dateb=&owner=include&count=10`;

        try {
          const ex991Url = await getExhibit991Url(cik, accn);
          if (!ex991Url) {
            return { quarter: fallbackQuarter, headline: null, revenue: null, revenueYoY: null, eps: null, netIncome: null, opProfit: null, ceoQuote: null, guidance: null, publishedAt, url: fallbackUrl };
          }
          const htmlRes = await fetch(ex991Url, { headers: { 'User-Agent': UA }, cache: 'no-store' });
          if (!htmlRes.ok) {
            return { quarter: fallbackQuarter, headline: null, revenue: null, revenueYoY: null, eps: null, netIncome: null, opProfit: null, ceoQuote: null, guidance: null, publishedAt, url: fallbackUrl };
          }
          const text = stripHtml(await htmlRes.text());
          return { ...parseEarnings(text, fallbackQuarter), publishedAt, url: ex991Url };
        } catch {
          return { quarter: fallbackQuarter, headline: null, revenue: null, revenueYoY: null, eps: null, netIncome: null, opProfit: null, ceoQuote: null, guidance: null, publishedAt, url: fallbackUrl };
        }
      })
    );

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
