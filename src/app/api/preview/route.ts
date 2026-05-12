import { NextRequest, NextResponse } from 'next/server';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function extractText(html: string): string {
  // Remove noisy sections
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<figure[\s\S]*?<\/figure>/gi, '');

  // Prefer <article> or <main> content area
  const articleM = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const mainM    = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const body     = articleM?.[1] ?? mainM?.[1] ?? cleaned;

  // Collect paragraphs
  const paras = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m =>
      m[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#\d+;/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(p => p.length > 60);   // skip short snippets / captions

  if (paras.length > 0) return paras.slice(0, 7).join('\n\n');

  // Fallback: strip all tags from body area
  return body
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 502 });

    const html = await res.text();

    // Page title
    const titleM = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    const title  = titleM?.[1]?.replace(/\s+/g, ' ').trim() ?? '';

    // og:description as quick summary fallback
    const ogDescM = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]{10,400})"/i)
                 ?? html.match(/<meta[^>]+content="([^"]{10,400})"[^>]+property="og:description"/i);
    const ogDesc  = ogDescM?.[1]?.trim() ?? '';

    const bodyText = extractText(html);
    const summary  = bodyText.length > 80 ? bodyText : (ogDesc || bodyText);

    return NextResponse.json({ title, summary });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
