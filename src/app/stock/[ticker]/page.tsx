import TopNav from "@/components/TopNav";
import SearchBox from "@/components/SearchBox";
import Link from "next/link";
import { getStockData } from "@/lib/mockData";
import StockChart from "@/components/StockChart";
import type { StockInfo } from "@/app/api/stock/[ticker]/route";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

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

  // Always fetch live price from Yahoo Finance
  let liveInfo: StockInfo | null = null;
  try {
    const res = await fetch(`${BASE}/api/stock/${encodeURIComponent(ticker)}`, { cache: 'no-store' });
    if (res.ok) liveInfo = await res.json();
  } catch {}

  // Extra data (short selling, issuance, news) from mock when available
  const mockData = getStockData(ticker);

  const notFound = !liveInfo && !mockData;
  const name = liveInfo?.name ?? mockData?.name ?? ticker.toUpperCase();
  const price = liveInfo?.price ?? null;
  const changePct = liveInfo?.changePct ?? null;
  const isUp = (changePct ?? 0) >= 0;

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
                {price != null && (
                  <div style={{ textAlign: "right" }}>
                    {/* 정규장 가격 행 */}
                    {(() => {
                      const regPrice   = liveInfo?.isAfterHours ? liveInfo.regularPrice! : price;
                      const regChgPct  = liveInfo?.isAfterHours ? (liveInfo.regularChangePct ?? 0) : (changePct ?? 0);
                      const regChgAmt  = liveInfo?.isAfterHours ? (liveInfo.regularChangeAmt ?? 0) : (liveInfo?.changeAmt ?? 0);
                      const regUp      = regChgPct >= 0;
                      const fmtPrice   = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: v < 100 ? 2 : 0, maximumFractionDigits: v < 100 ? 2 : 0 });
                      const fmtAmt     = (v: number) => Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: v < 100 ? 2 : 0, maximumFractionDigits: v < 100 ? 2 : 0 });
                      return (
                        <div style={{ display: "flex", alignItems: "baseline", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 36, fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.03em", lineHeight: 1 }}>
                            {fmtPrice(regPrice)}
                          </span>
                          <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 16, fontWeight: 700, color: regUp ? "var(--up)" : "var(--down)", whiteSpace: "nowrap" }}>
                            {regUp ? "▲" : "▼"}{fmtAmt(regChgAmt)}
                            <span style={{ fontSize: 14, marginLeft: 5, opacity: 0.9 }}>({Math.abs(regChgPct).toFixed(2)}%)</span>
                          </span>
                        </div>
                      );
                    })()}

                    {/* 시간외 / 프리장 / 애프터장 행 */}
                    {liveInfo?.isAfterHours && liveInfo.regularPrice != null && (
                      (() => {
                        const extUp  = liveInfo.changePct >= 0;
                        const fmtP   = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: v < 100 ? 2 : 0, maximumFractionDigits: v < 100 ? 2 : 0 });
                        const fmtA   = (v: number) => Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: v < 100 ? 2 : 0, maximumFractionDigits: v < 100 ? 2 : 0 });
                        const label  = liveInfo.session === 'PRE' ? 'Pre Market' : liveInfo.session === 'POST' ? 'After Market' : 'After Market';
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end", marginTop: 8, flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, fontWeight: 600, color: "var(--gray-500)", letterSpacing: "0.03em" }}>
                              {label}
                            </span>
                            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 18, fontWeight: 700, color: "var(--gray-800)" }}>
                              {fmtP(liveInfo.price)}
                            </span>
                            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 13, fontWeight: 600, color: extUp ? "var(--up)" : "var(--down)", whiteSpace: "nowrap" }}>
                              {extUp ? "▲" : "▼"}{fmtA(liveInfo.changeAmt ?? 0)}
                              <span style={{ fontSize: 12, marginLeft: 4, opacity: 0.9 }}>({Math.abs(liveInfo.changePct).toFixed(2)}%)</span>
                            </span>
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Chart — full width, same as header */}
            <div style={card}>
              <div style={sectionTitle}>
                Price & Volume
              </div>
              <StockChart ticker={ticker.toUpperCase()} initialIsUp={isUp} />
            </div>

            {/* Main layout */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                {mockData && (
                  <>
                    {/* Short Selling */}
                    <div style={card}>
                      <div style={sectionTitle}>
                        <span style={{ fontSize: 14 }}>⚡</span>
                        Short Selling
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--gray-200)" }}>
                            {["Date", "Short Ratio", "Short Volume"].map(h => (
                              <th key={h} style={{
                                fontFamily: "var(--font-mono), monospace", fontSize: 11,
                                color: "var(--gray-500)", textAlign: "left",
                                padding: "8px 0", letterSpacing: "0.08em", textTransform: "uppercase",
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {mockData.shortSelling.map((row, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid var(--gray-100)" }}>
                              <td style={{ fontFamily: "var(--font-mono), monospace", fontSize: 13, color: "var(--gray-600)", padding: "12px 0" }}>{row.date}</td>
                              <td style={{ padding: "12px 0" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ flex: 1, height: 6, background: "var(--gray-100)", borderRadius: 3, maxWidth: 120 }}>
                                    <div style={{ width: `${Math.min(row.ratio * 20, 100)}%`, height: "100%", background: "var(--down)", borderRadius: 3 }} />
                                  </div>
                                  <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 13, fontWeight: 600, color: "var(--down)" }}>
                                    {row.ratio}%
                                  </span>
                                </div>
                              </td>
                              <td style={{ fontFamily: "var(--font-mono), monospace", fontSize: 13, color: "var(--gray-700)", padding: "12px 0" }}>{row.amount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Share Issuance */}
                    <div style={card}>
                      <div style={sectionTitle}>
                        <span style={{ fontSize: 14 }}>📄</span>
                        Share Issuance
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {mockData.issuance.map((item, i) => (
                          <div key={i} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "14px 16px", background: "var(--gray-50)",
                            borderRadius: 10, border: "1px solid var(--gray-100)",
                          }}>
                            <div>
                              <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, color: "var(--gray-500)", marginBottom: 4 }}>{item.date}</div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--gray-800)" }}>{item.type}</div>
                            </div>
                            <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 14, fontWeight: 700, color: "var(--gray-900)" }}>
                              +{item.shares.toLocaleString()}
                              <span style={{ fontSize: 11, color: "var(--gray-400)", marginLeft: 4 }}>shares</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* News sidebar */}
              {mockData && (
                <div style={card}>
                  <div style={sectionTitle}>
                    <span style={{ fontSize: 14 }}>📰</span>
                    Latest News
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {mockData.news.map((item, i) => (
                      <div key={i} style={{
                        padding: "16px 0",
                        borderBottom: i < mockData.news.length - 1 ? "1px solid var(--gray-100)" : "none",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "var(--gray-500)", fontWeight: 600 }}>{item.source}</span>
                          <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "var(--gray-400)" }}>{item.time}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-900)", lineHeight: 1.4, marginBottom: 6 }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: "var(--gray-500)", lineHeight: 1.5 }}>{item.summary}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
