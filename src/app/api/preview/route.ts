import { NextRequest, NextResponse } from 'next/server';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

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
  // Remove noise sections
  const cleaned = html
    .replace(/<(script|style|nav|header|footer|aside|figure|noscript|iframe)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Try article / main first, fallback to full body
  const areaMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
                 ?? cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
                 ?? cleaned.match(/<div[^>]+(?:class|id)="[^"]*(?:article|content|story|body|text)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const area = areaMatch?.[1] ?? cleaned;

  // Collect <p> tags
  const paras = [...area.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => stripTags(m[1]))
    .filter(p => p.length > 55 && !/cookie|privacy|subscribe|copyright|all rights reserved/i.test(p));

  return paras;
}

// Score sentences by information density
function scoreSentences(sentences: string[]): string[] {
  const financialKw = /\$|revenue|profit|loss|earnings|eps|growth|decline|quarter|billion|million|percent|%|guidance|forecast|beat|miss|raised|cut|upgrade|downgrade|acquire|merge|deal|announce|report/i;
  const scored = sentences.map(s => ({
    s,
    score:
      (financialKw.test(s) ? 3 : 0) +
      (s.length > 80 && s.length < 280 ? 2 : 0) +
      (/said|announced|reported|stated|noted|according/i.test(s) ? 1 : 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 4).map(x => x.s);
}

function buildBullets(paragraphs: string[], ogDesc: string): string[] {
  if (paragraphs.length === 0 && ogDesc) return [ogDesc];

  // Split paragraphs into sentences
  const allSentences: string[] = [];
  for (const p of paragraphs.slice(0, 12)) {
    const sents = p.split(/(?<=[.!?])\s+(?=[A-Z"'])/).filter(s => s.length > 40);
    allSentences.push(...sents);
  }

  if (allSentences.length === 0) return ogDesc ? [ogDesc] : [];

  const top = scoreSentences(allSentences);
  // Prepend og:description as first bullet if it adds info
  if (ogDesc && !top.some(s => s.slice(0, 40) === ogDesc.slice(0, 40))) {
    top.unshift(ogDesc);
  }
  return top.slice(0, 4);
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 });

  // SEC EDGAR pages — return empty (no article content)
  if (url.includes('sec.gov/cgi-bin')) {
    return NextResponse.json({ bullets: [], secFiling: true });
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

    // og:description — often the best pre-written summary
    const ogDesc  = extractMeta(html, 'og:description') || extractMeta(html, 'description');
    const paras   = extractParagraphs(html);
    const bullets = buildBullets(paras, ogDesc);

    return NextResponse.json({ bullets });
  } catch {
    return NextResponse.json({ blocked: true });
  }
}
