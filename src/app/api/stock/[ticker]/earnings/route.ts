import { NextRequest, NextResponse } from 'next/server';
import type { NewsItem } from '../news/route';

const UA = 'research-for wjddlswjs7398@gmail.com';
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
    // Match EX-99.1 document row, get first .htm (skip .xml)
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

interface ParsedEarnings {
  revenue: string | null;
  eps: string | null;
  quarter: string | null;
  ceoQuotes: string[];
  guidance: string | null;
  headline: string | null;
}

function parseEarningsText(text: string): ParsedEarnings {
  // Revenue: "$678 million" or "$1.2 billion"
  const revMatch = text.match(/[Rr]evenue(?:\s+was|\s+of)?\s+\$?([\d,\.]+)\s*(billion|million|B\b|M\b)/i);
  let revenue: string | null = null;
  if (revMatch) {
    const val = revMatch[1].replace(/,/g, '');
    const unit = revMatch[2].toLowerCase().startsWith('b') ? 'B' : 'M';
    revenue = `$${parseFloat(val) < 10 && unit === 'B' ? parseFloat(val).toFixed(1) : val}${unit}`;
  }

  // EPS: "per diluted share was $0.03" or "loss per diluted share of $(0.31)"
  const epsMatch = text.match(/(?:earnings|loss)\s+per\s+(?:diluted\s+)?share[s]?(?:\s+was|\s+of)?\s+\$?\(?([\d\.]+)\)?/i);
  const eps = epsMatch ? `$${epsMatch[1]}` : null;

  // Quarter from text like "first quarter 2026" or "third quarter ended September"
  const qMap: Record<string, string> = { first: 'Q1', second: 'Q2', third: 'Q3', fourth: 'Q4' };
  const quarterMatch = text.match(/(first|second|third|fourth)\s+quarter(?:\s+(?:of\s+)?(\d{4}))?/i);
  let quarter: string | null = null;
  if (quarterMatch) {
    const q = qMap[quarterMatch[1].toLowerCase()] ?? '';
    const yr = quarterMatch[2] ?? '';
    quarter = yr ? `${q} ${yr}` : q;
  }

  // Headline line (usually the first bullet point or first sentence with company name)
  const headlineMatch = text.match(/(?:•\s*)([^•]{20,120}(?:Revenue|Results|Sales|Quarter)[^•]{0,60})/i);
  const headline = headlineMatch ? headlineMatch[1].trim() : null;

  // CEO / CFO quotes (after "stated," or "said," pattern)
  const ceoQuotes: string[] = [];
  const quoteRe = /(?:CEO|Chief Executive|CFO|Chief Financial|President|stated|said|commented),?\s+"([^"]{40,300})"/gi;
  let m: RegExpExecArray | null;
  while ((m = quoteRe.exec(text)) !== null && ceoQuotes.length < 2) {
    const q = m[1].trim();
    if (!ceoQuotes.some(existing => existing.slice(0, 30) === q.slice(0, 30))) {
      ceoQuotes.push(q);
    }
  }

  // Guidance: look for "full year" or "second quarter" guidance/outlook sentences
  const guidanceMatch = text.match(/[Ff]ull.?[Yy]ear\s+(?:\d{4}\s+)?(?:[Gg]uidance|[Oo]utlook)[^.]{0,200}\./);
  const guidance = guidanceMatch ? guidanceMatch[0].trim() : null;

  return { revenue, eps, quarter, ceoQuotes, guidance, headline };
}

function buildItems(
  ticker: string,
  quarter: string,
  parsed: ParsedEarnings,
  publishedAt: number,
  url: string,
): NewsItem[] {
  const items: NewsItem[] = [];
  const src = 'SEC 실적발표';

  // Main earnings headline
  let mainTitle = `[${ticker}] ${quarter} Earnings Call`;
  const metrics: string[] = [];
  if (parsed.revenue) metrics.push(`Revenue ${parsed.revenue}`);
  if (parsed.eps) metrics.push(`EPS ${parsed.eps}`);
  if (metrics.length > 0) mainTitle += ` — ${metrics.join(', ')}`;
  items.push({ title: mainTitle, source: src, publishedAt, url });

  // CEO quotes
  for (const [i, quote] of parsed.ceoQuotes.entries()) {
    const shortQuote = quote.length > 120 ? quote.slice(0, 117) + '...' : quote;
    items.push({
      title: `[${ticker}] ${quarter} 어닝콜 경영진 코멘트: "${shortQuote}"`,
      source: src,
      publishedAt: publishedAt - i,  // slight offset to keep order
      url,
    });
  }

  // Guidance
  if (parsed.guidance) {
    const shortGuide = parsed.guidance.length > 140 ? parsed.guidance.slice(0, 137) + '...' : parsed.guidance;
    items.push({
      title: `[${ticker}] ${quarter} guidance — ${shortGuide}`,
      source: src,
      publishedAt: publishedAt - 10,
      url,
    });
  }

  return items;
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
    const forms: string[] = recent.form ?? [];
    const dates: string[] = recent.filingDate ?? [];
    const accns: string[] = recent.accessionNumber ?? [];
    const itemCodes: string[] = recent.items ?? [];

    // Collect earnings 8-K filings (item 2.02 = Results of Operations)
    const earningsFilings: { date: string; accn: string }[] = [];
    for (let i = 0; i < forms.length && earningsFilings.length < 6; i++) {
      if (forms[i] === '8-K' && (itemCodes[i] ?? '').includes('2.02')) {
        earningsFilings.push({ date: dates[i], accn: accns[i] });
      }
    }

    if (earningsFilings.length === 0) return NextResponse.json([]);

    // Fetch and parse each earnings press release
    const allItems = await Promise.all(
      earningsFilings.map(async ({ date, accn }) => {
        const quarter = quarterLabel(date);
        const publishedAt = date ? Math.floor(new Date(date).getTime() / 1000) : 0;
        const fallbackUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=8-K&dateb=&owner=include&count=10`;

        try {
          const ex991Url = await getExhibit991Url(cik, accn);
          if (!ex991Url) {
            return [{ title: `[${ticker.toUpperCase()}] ${quarter} Earnings Call`, source: 'SEC 실적발표', publishedAt, url: fallbackUrl }];
          }

          const htmlRes = await fetch(ex991Url, { headers: { 'User-Agent': UA }, cache: 'no-store' });
          if (!htmlRes.ok) {
            return [{ title: `[${ticker.toUpperCase()}] ${quarter} Earnings Call`, source: 'SEC 실적발표', publishedAt, url: fallbackUrl }];
          }

          const text = stripHtml(await htmlRes.text());
          const parsed = parseEarningsText(text);
          const effectiveQuarter = parsed.quarter ?? quarter;

          return buildItems(ticker.toUpperCase(), effectiveQuarter, parsed, publishedAt, ex991Url);
        } catch {
          return [{ title: `[${ticker.toUpperCase()}] ${quarter} Earnings Call`, source: 'SEC 실적발표', publishedAt, url: fallbackUrl }];
        }
      })
    );

    return NextResponse.json(allItems.flat());
  } catch {
    return NextResponse.json([]);
  }
}
