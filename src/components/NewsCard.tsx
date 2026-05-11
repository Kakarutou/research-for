"use client";
import { useState, useMemo } from "react";
import type { NewsItem } from "@/app/api/stock/[ticker]/news/route";

type Tab = "호재" | "악재" | "공시";
const TABS: Tab[] = ["호재", "악재", "공시"];

function relTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function classify(item: NewsItem): Tab {
  const t = (item.title + " " + item.source).toLowerCase();
  const discKw = ["sec", "10-k", "10-q", "8-k", "proxy", "ipo ", "offering", "merger", "acquisition", "dividend", "buyback", "split", "filing", "공시", "보고"];
  if (discKw.some(w => t.includes(w))) return "공시";
  const posKw = ["beat", "surges", "jumps", "soars", "rally", "record", "profit", "gains", "upgrade", "strong", "deal", "rises", "climbs", "launch", "approved", "raised", "growth", "wins", "high"];
  const negKw = ["misses", "falls", "drops", "decline", "loss", "cuts", "warns", "downgrade", "weak", "concern", "risk", "fine", "recall", "layoff", "deficit", "plunges", "crash", "delays", "suspends", "probe", "sued", "low"];
  const pos = posKw.filter(w => t.includes(w)).length;
  const neg = negKw.filter(w => t.includes(w)).length;
  return neg > pos ? "악재" : "호재";
}

const TC: Record<Tab, { bg: string; on: string; text: string }> = {
  호재: { bg: "rgba(22,163,74,0.1)",  on: "#16a34a", text: "#16a34a" },
  악재: { bg: "rgba(220,38,38,0.1)",  on: "#dc2626", text: "#dc2626" },
  공시: { bg: "rgba(37,99,235,0.1)",  on: "#2563eb", text: "#2563eb" },
};

export default function NewsCard({ news }: { news: NewsItem[] }) {
  const [tab, setTab]           = useState<Tab>("호재");
  const [expanded, setExpanded] = useState(false);

  const cats = useMemo(() => {
    const r: Record<Tab, NewsItem[]> = { 호재: [], 악재: [], 공시: [] };
    for (const n of news) r[classify(n)].push(n);
    return r;
  }, [news]);

  const items   = cats[tab];
  const hasMore = items.length > 5;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

      {/* Header + tabs */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexShrink: 0, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: "var(--font-display), serif", fontSize: 16, fontWeight: 600, fontStyle: "italic", color: "var(--gray-900)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>📰</span>
          Latest News
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map(t => {
            const active = tab === t;
            const c      = TC[t];
            const cnt    = cats[t].length;
            return (
              <button
                key={t}
                onClick={() => { setTab(t); setExpanded(false); }}
                style={{
                  fontFamily: "monospace", fontSize: 11, fontWeight: 700,
                  padding: "3px 10px", borderRadius: 6, cursor: "pointer", border: "none",
                  background: active ? c.on : c.bg,
                  color: active ? "#fff" : c.text,
                  transition: "all 0.12s",
                  position: "relative",
                }}
              >
                {t}
                {cnt > 0 && (
                  <span style={{
                    position: "absolute", top: -4, right: -4,
                    minWidth: 14, height: 14, borderRadius: 7, padding: "0 2px",
                    background: active ? "rgba(255,255,255,0.9)" : c.on,
                    color: active ? c.text : "#fff",
                    fontSize: 9, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {cnt > 9 ? "9+" : cnt}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List area */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>

        {/* Scrollable inner */}
        <div style={{ position: "absolute", inset: 0, overflowY: expanded ? "auto" : "hidden" }}>
          {items.length === 0
            ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--gray-400)", fontFamily: "monospace", fontSize: 12 }}>
                관련 {tab} 뉴스 없음
              </div>
            )
            : items.map((n, i) => (
              <div key={i} style={{ padding: "13px 0", borderBottom: i < items.length - 1 ? "1px solid var(--gray-100)" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--gray-500)", fontWeight: 600, marginRight: 8 }}>{n.source}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--gray-400)", whiteSpace: "nowrap" }}>{relTime(n.publishedAt)}</span>
                </div>
                {n.url
                  ? <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-900)", lineHeight: 1.4, textDecoration: "none", display: "block" }}>
                      {n.title}
                    </a>
                  : <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-900)", lineHeight: 1.4 }}>{n.title}</div>
                }
              </div>
            ))
          }
        </div>

        {/* Gradient fade + more button */}
        {!expanded && hasMore && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 80,
            background: "linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.97))",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            paddingBottom: 8,
            pointerEvents: "none",
          }}>
            <button
              onClick={() => setExpanded(true)}
              style={{
                pointerEvents: "auto",
                fontFamily: "monospace", fontSize: 11, fontWeight: 700,
                padding: "5px 22px", borderRadius: 20, cursor: "pointer",
                border: "1px solid rgba(0,0,0,0.08)",
                background: "rgba(255,255,255,0.55)",
                backdropFilter: "blur(6px)",
                color: "var(--gray-400)",
                opacity: 0.85,
                transition: "opacity 0.15s",
              }}
            >
              more ▾
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
