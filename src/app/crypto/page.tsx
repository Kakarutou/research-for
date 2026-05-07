import TopNav from "@/components/TopNav";
import Link from "next/link";

export default function Page() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--page-bg)" }}>
      <TopNav />
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", minHeight: "70vh", gap: 16, padding: "0 24px",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.15)",
          display: "grid", placeItems: "center", fontSize: 28,
        }}>🚧</div>
        <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "-0.03em" }}>
          Crypto · Coming Soon
        </div>
        <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 15, color: "rgba(255,255,255,0.5)", textAlign: "center", maxWidth: 380, lineHeight: 1.65 }}>
          This section is under construction. We&apos;re building something great — check back soon.
        </div>
        <Link href="/" style={{
          marginTop: 8, fontFamily: "var(--font-sans), sans-serif", fontSize: 13, fontWeight: 600,
          color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px 20px",
          textDecoration: "none",
        }}>← Back to Home</Link>
      </div>
    </div>
  );
}
