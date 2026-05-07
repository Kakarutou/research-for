import TopNav from "@/components/TopNav";
import SearchBox from "@/components/SearchBox";
import PredictionsSection from "@/components/PredictionsSection";

const FEATURES = [
  {
    num: "01",
    label: "Research",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        <path d="M11 8v6M8 11h6" strokeLinecap="round"/>
      </svg>
    ),
    title: "One screen, every signal",
    desc: "Short interest, filings, ATM offerings, share counts, news — all in one place per ticker.",
  },
  {
    num: "02",
    label: "Predict",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
      </svg>
    ),
    title: "Daily market calls",
    desc: "Predict NASDAQ, KOSPI, Nikkei, or BTC direction each session. Compete globally.",
  },
  {
    num: "03",
    label: "Earn",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
      </svg>
    ),
    title: "On-chain rewards",
    desc: "Accuracy earns RFC tokens. Build streaks. Your track record lives on-chain.",
  },
];

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", opacity: 0.6, zIndex: 1, mixBlendMode: "multiply",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.04 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />

      <TopNav />
      {/* Hero */}
      <section style={{ position: "relative", zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center", padding: "64px 24px 56px" }}>
        <div style={{
          fontFamily: "var(--font-mono), monospace", fontSize: 13,
          color: "var(--hero-label)", letterSpacing: "0.22em", textTransform: "uppercase",
          marginBottom: 20, display: "inline-flex", alignItems: "center", gap: 12,
          textShadow: "0 1px 10px rgba(0,0,0,0.5)",
        }}>
          <span style={{ width: 20, height: 1, background: "var(--hero-rule)", display: "inline-block" }} />
          For Independent Investors
          <span style={{ width: 20, height: 1, background: "var(--hero-rule)", display: "inline-block" }} />
        </div>

        <h1 style={{
          fontFamily: "var(--font-display), serif",
          fontSize: "clamp(44px, 6.5vw, 82px)",
          fontWeight: 300, letterSpacing: "-0.04em", lineHeight: 1.05,
          textAlign: "center", marginBottom: 20, color: "var(--hero-title)",
          textShadow: "0 2px 24px rgba(0,0,0,0.45)",
        }}>
          Research, <em style={{ fontStyle: "italic", fontWeight: 600, color: "var(--hero-title)" }}>before</em> you bet.
        </h1>

        <p style={{
          fontFamily: "var(--font-sans), sans-serif",
          fontSize: 17, fontWeight: 400, color: "var(--hero-desc)",
          letterSpacing: "0.01em", marginBottom: 44, textAlign: "center",
          textShadow: "0 1px 12px rgba(0,0,0,0.4)",
        }}>
          Turn market noise into signal — then act on it.
        </p>

        <SearchBox />
      </section>

      <PredictionsSection />

      {/* Feature cards */}
      <section style={{ position: "relative", zIndex: 5, padding: "96px 24px 0" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{
            fontFamily: "var(--font-mono), monospace", fontSize: 11,
            letterSpacing: "0.22em", textTransform: "uppercase",
            color: "var(--gray-500)", marginBottom: 48, textAlign: "center",
          }}>
            — What&apos;s coming
          </div>

          <div className="feature-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {FEATURES.map(f => (
              <div key={f.num} className="feature-card" style={{
                background: "white",
                border: "1px solid rgba(0,0,0,0.07)",
                borderRadius: 18, padding: "32px 28px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.06), 0 12px 24px rgba(0,0,0,0.07), 0 24px 48px rgba(0,0,0,0.05)",
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: "var(--gray-100)",
                  border: "1px solid var(--gray-200)",
                  display: "grid", placeItems: "center",
                  color: "var(--gray-500)", marginBottom: 24,
                }}>
                  {f.icon}
                </div>
                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, color: "var(--gray-400)", letterSpacing: "0.2em", marginBottom: 10, textTransform: "uppercase" }}>
                  {f.num} / {f.label}
                </div>
                <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 17, fontWeight: 600, color: "var(--gray-900)", marginBottom: 12, letterSpacing: "-0.02em" }}>
                  {f.title}
                </div>
                <div style={{ fontSize: 13, color: "var(--gray-500)", lineHeight: 1.65 }}>
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        position: "relative", zIndex: 5,
        maxWidth: 1080, margin: "80px auto 0", padding: "32px 24px 48px",
        borderTop: "1px solid var(--gray-200)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontFamily: "var(--font-mono), monospace", fontSize: 11,
        color: "var(--gray-400)", letterSpacing: "0.1em",
      }} className="footer-row">
        <span>RESEARCH FOR · 2026</span>
        <span>v0.1 PROTOTYPE</span>
      </footer>
    </div>
  );
}
