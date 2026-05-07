import Link from "next/link";
import { getStockData } from "@/lib/mockData";
import StockChart from "@/components/StockChart";

const card: React.CSSProperties = {
  background: "white",
  border: "1px solid var(--gray-200)",
  borderRadius: 16,
  padding: "24px 28px",
};

const sectionTitle: React.CSSProperties = {
  fontFamily: "var(--font-display), serif",
  fontSize: 16, fontWeight: 600, fontStyle: "italic",
  color: "var(--gray-900)", marginBottom: 18,
  display: "flex", alignItems: "center", gap: 8,
};

export default function StockPage({ params }: { params: { ticker: string } }) {
  const data = getStockData(params.ticker);

  return (
    <div style={{ background: "var(--gray-50)", minHeight: "100vh" }}>
      {/* Top bar */}
      <div style={{
        background: "white", borderBottom: "1px solid var(--gray-200)",
        padding: "16px 40px", display: "flex", alignItems: "center", gap: 24,
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <Link href="/" style={{
          fontFamily: "var(--font-display), serif", fontSize: 20, fontWeight: 600,
          color: "var(--gray-900)", textDecoration: "none", letterSpacing: "-0.02em",
        }}>Research For</Link>
        <span style={{ color: "var(--gray-300)" }}>·</span>
        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 13, color: "var(--gray-500)" }}>
          {params.ticker.toUpperCase()}
        </span>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Not found state */}
        {!data && (
          <div style={{ ...card, textAlign: "center", padding: "60px 40px" }}>
            <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 32, marginBottom: 16 }}>¿</div>
            <div style={{ fontFamily: "var(--font-display), serif", fontSize: 22, fontWeight: 600, color: "var(--gray-900)", marginBottom: 8 }}>
              No data for {params.ticker.toUpperCase()}
            </div>
            <div style={{ color: "var(--gray-500)", fontSize: 14 }}>
              This ticker is not in our mock data. Try searching <strong>NVDA</strong> or <strong>AAPL</strong>.
            </div>
          </div>
        )}

        {data && <>
          {/* Header */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 13, color: "var(--gray-500)", marginBottom: 6 }}>
                  {data.ticker}
                </div>
                <div style={{ fontFamily: "var(--font-display), serif", fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--gray-900)" }}>
                  {data.name}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 32, fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.02em" }}>
                  {data.price}
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
                  <span style={{
                    fontFamily: "var(--font-mono), monospace", fontSize: 14, fontWeight: 600,
                    padding: "3px 10px", borderRadius: 6,
                    color: data.isUp ? "var(--up)" : "var(--down)",
                    background: data.isUp ? "var(--up-bg)" : "var(--down-bg)",
                  }}>{data.change}</span>
                  <span style={{
                    fontFamily: "var(--font-mono), monospace", fontSize: 14,
                    color: data.isUp ? "var(--up)" : "var(--down)",
                  }}>{data.changeAmt}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

              {/* Chart */}
              <div style={card}>
                <div style={sectionTitle}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: data.isUp ? "var(--up)" : "var(--down)", display: "inline-block" }} />
                  Price & Volume
                </div>
                <StockChart data={data.chartData} isUp={data.isUp} />
              </div>

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
                    {data.shortSelling.map((row, i) => (
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
                  {data.issuance.map((item, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "14px 16px", background: "var(--gray-50)",
                      borderRadius: 10, border: "1px solid var(--gray-100)",
                    }}>
                      <div>
                        <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, color: "var(--gray-500)", marginBottom: 4 }}>{item.date}</div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--gray-800)" }}>{item.type}</div>
                      </div>
                      <div style={{
                        fontFamily: "var(--font-mono), monospace", fontSize: 14, fontWeight: 700,
                        color: "var(--gray-900)",
                      }}>
                        +{item.shares.toLocaleString()}
                        <span style={{ fontSize: 11, color: "var(--gray-400)", marginLeft: 4 }}>shares</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* News sidebar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={card}>
                <div style={sectionTitle}>
                  <span style={{ fontSize: 14 }}>📰</span>
                  Latest News
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {data.news.map((item, i) => (
                    <div key={i} style={{
                      padding: "16px 0",
                      borderBottom: i < data.news.length - 1 ? "1px solid var(--gray-100)" : "none",
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
            </div>
          </div>
        </>}
      </div>
    </div>
  );
}
