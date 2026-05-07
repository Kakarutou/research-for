"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const NAV_TABS = [
  { id: "forum",   label: "Forum",   href: "/forum" },
  { id: "crypto",  label: "Crypto",  href: "/crypto" },
  { id: "news",    label: "News",    href: "/news" },
  { id: "reports", label: "Reports", href: "/reports" },
];

export default function SearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("searchInput")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSearch = () => {
    if (!query.trim()) { document.getElementById("searchInput")?.focus(); return; }
    router.push(`/stock/${query.trim().toUpperCase()}`);
  };

  return (
    <div style={{ width: "100%", maxWidth: 600 }}>
      {/* Category navigation tabs */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 14 }}>
        {NAV_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => router.push(t.href)}
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 20, padding: "6px 18px",
              fontFamily: "var(--font-sans), sans-serif",
              fontSize: 13, fontWeight: 500,
              color: "rgba(255,255,255,0.82)",
              cursor: "pointer", letterSpacing: "-0.01em",
              backdropFilter: "blur(8px)",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.22)";
              (e.currentTarget as HTMLButtonElement).style.color = "white";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)";
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.82)";
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Ticker search */}
      <div style={{
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(24px)",
        border: "1px solid var(--gray-200)",
        borderRadius: 24,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 12px 40px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", padding: "6px 8px 6px 24px" }}>
          <svg style={{ color: "var(--gray-400)", marginRight: 14, flexShrink: 0 }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            id="searchInput"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Search any ticker or coin — AAPL, BTC, TSLA…"
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              padding: "22px 0",
              fontFamily: "var(--font-sans), sans-serif",
              fontSize: 17, color: "var(--gray-900)", minWidth: 0,
            }}
          />
          <button onClick={handleSearch} style={{
            background: "var(--gray-900)", color: "white",
            border: "none", width: 44, height: 44, borderRadius: 14,
            cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M13 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>

    </div>
  );
}
