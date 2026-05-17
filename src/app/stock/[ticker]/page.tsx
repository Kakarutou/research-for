import TopNav from "@/components/TopNav";
import SearchBox from "@/components/SearchBox";
import Link from "next/link";
import StockChart from "@/components/StockChart";
import LivePriceDisplay from "@/components/LivePriceDisplay";
import NewsCard from "@/components/NewsCard";
import type { StockInfo } from "@/app/api/stock/[ticker]/route";
import type { NewsItem } from "@/app/api/stock/[ticker]/news/route";
import type { EarningsItem } from "@/app/api/stock/[ticker]/earnings/route";
import { headers } from 'next/headers';

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(24px)",
  border: "1px solid rgba(0,0,0,0.07)",
  borderRadius: 16,
  padding: "24px 28px",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)",
};

const sectionTitle: React.CSSProperties = {
  fontFamily: "var(--font-display), serif",
  fontSize: 16, fontWeight: 600, fontStyle: "italic",
  color: "var(--gray-900)", marginBottom: 18,
  display: "flex", alignItems: "center", gap: 8,
};

export default async function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;

  const headersList = await headers();
  const host = headersList.get('host') ?? 'localhost:3000';
  const proto = headersList.get('x-forwarded-proto') ?? 'http';
  const BASE = `${proto}://${host}`;

  const [liveInfo, newsRaw, insiders, disclosures, earnings] = await Promise.all([
    fetch(`${BASE}/api/stock/${encodeURIComponent(ticker)}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() as Promise<StockInfo | null> : null)
      .catch(() => null),
    fetch(`${BASE}/api/stock/${encodeURIComponent(ticker)}/news`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() as Promise<NewsItem[]> : [])
      .catch(() => [] as NewsItem[]),
    fetch(`${BASE}/api/stock/${encodeURIComponent(ticker)}/insiders`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() as Promise<NewsItem[]> : [])
      .catch(() => [] as NewsItem[]),
    fetch(`${BASE}/api/stock/${encodeURIComponent(ticker)}/disclosures`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() as Promise<NewsItem[]> : [])
      .catch(() => [] as NewsItem[]),
    fetch(`${BASE}/api/stock/${encodeURIComponent(ticker)}/earnings`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() as Promise<EarningsItem[]> : [])
      .catch(() => [] as EarningsItem[]),
  ]);

  // Merge news (excluding earnings, which go into a separate tab)
  const seen = new Set<string>();
  const news: NewsItem[] = [];
  for (const item of [...newsRaw, ...insiders, ...disclosures]) {
    const key = item.title.toLowerCase().slice(0, 60);
    if (!seen.has(key)) { seen.add(key); news.push(item); }
  }
  news.sort((a, b) => b.publishedAt - a.publishedAt);

  const notFound = !liveInfo;
  const name = liveInfo?.name ?? ticker.toUpperCase();
  const changePct = liveInfo?.changePct ?? null;
  const isUp = (changePct ?? 0) >= 0;
  const hasContent = news.length > 0 || earnings.length > 0;

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", opacity: 0.6, zIndex: 1, mixBlendMode: "multiply",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.04 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />

      <TopNav wide />

      {/* Breadcrumb + search */}
      <div style={{ position: "relative", zIndex: 5, maxWidth: 1080, padding: "20px 40px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono), monospace", fontSize: 15 }}>
          <Link href="/" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Home</Link>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>/</span>
          <span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>{name}</span>
          <span style={{ color: "rgba(255,255,255,0.45)" }}>· {ticker.toUpperCase()}</span>
        </div>
        <SearchBox hideTabs compact />
      </div>

      <div style={{ position: "relative", zIndex: 5, maxWidth: 1080, padding: "0 40px 48px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Not found */}
        {notFound && (
          <div style={{ ...card, textAlign: "center", padding: "60px 40px" }}>
            <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 32, marginBottom: 16 }}>¿</div>
            <div style={{ fontFamily: "var(--font-display), serif", fontSize: 22, fontWeight: 600, color: "var(--gray-900)", marginBottom: 8 }}>
              No data for {ticker.toUpperCase()}
            </div>
            <div style={{ color: "var(--gray-500)", fontSize: 14 }}>
              Could not find this ticker. Please check the symbol and try again.
            </div>
          </div>
        )}

        {!notFound && (
          <>
            {/* Header card — live price */}
            <div style={card}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 13, color: "var(--gray-500)", marginBottom: 6 }}>
                    {ticker.toUpperCase()}
                  </div>
                  <div style={{ fontFamily: "var(--font-display), serif", fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--gray-900)" }}>
                    {name}
                  </div>
                </div>
                {liveInfo && <LivePriceDisplay ticker={ticker.toUpperCase()} initial={liveInfo} />}
              </div>
            </div>

            {/* Main layout */}
            <div style={{ display: "grid", gridTemplateColumns: hasContent ? "1fr 360px" : "1fr", gap: 24, alignItems: "stretch" }}>
              {/* Chart */}
              <div style={card}>
                <StockChart ticker={ticker.toUpperCase()} initialIsUp={isUp} />
              </div>

              {/* News + Earnings sidebar */}
              {hasContent && (
                <div style={{ ...card, display: "flex", flexDirection: "column" }}>
                  <NewsCard news={news} earnings={earnings} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
