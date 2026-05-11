"use client";
import { useState, useMemo } from "react";
import type { NewsItem } from "@/app/api/stock/[ticker]/news/route";

type Tab = "호재" | "악재" | "공시" | "어닝콜";
const TABS: Tab[] = ["호재", "악재", "공시", "어닝콜"];

function relTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function classify(item: NewsItem): Tab {
  const t = (item.title + " " + item.source).toLowerCase();

  const earningsKw = ["earnings", "eps", "quarterly", "q1 ", "q2 ", "q3 ", "q4 ", "guidance", "outlook", "revenue", "conference call", "results", "beat", "miss", "fiscal"];
  if (earningsKw.some(w => t.includes(w))) return "어닝콜";

  const discKw = ["sec", "10-k", "10-q", "8-k", "proxy", "ipo ", "offering", "merger", "acquisition", "dividend", "buyback", "split", "filing", "공시"];
  if (discKw.some(w => t.includes(w))) return "공시";

  const posKw = ["surges", "jumps", "soars", "rally", "record", "profit", "gains", "upgrade", "strong", "deal", "rises", "climbs", "launch", "approved", "raised", "growth", "wins", "high", "expands"];
  const negKw = ["falls", "drops", "decline", "loss", "cuts", "warns", "downgrade", "weak", "concern", "risk", "fine", "recall", "layoff", "deficit", "plunges", "crash", "delays", "suspends", "probe", "sued", "low"];
  const pos = posKw.filter(w => t.includes(w)).length;
  const neg = negKw.filter(w => t.includes(w)).length;
  return neg > pos ? "악재" : "호재";
}

export default function NewsCard({ news }: { news: NewsItem[] }) {
  const [tab, setTab]           = useState<Tab>("호재");
  const [expanded, setExpanded] = useState(false);

  const cats = useMemo(() => {
    const r: Record<Tab, NewsItem[]> = { 호재: [], 악재: [], 공시: [], 어닝콜: [] };
    for (const n of news) r[classify(n)].push(n);
    return r;
  }, [news]);

  const items   = cats[tab];
  const hasMore = items.length > 5;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

      {/* Nav-pill style tabs */}
      <div style={{
        display: "flex", alignItems: "stretch",
        height: 36, flexShrink: 0,
        marginBottom: 14,
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(0,0,0,0.09)",
        borderRadius: 10, overflow: "hidden",
        boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
      }}>
        {TABS.map((t, idx) => {
          const active = tab === t;
          const cnt    = cats[t].length;
          return (
            <button
              key={t}
              onClick={() => { setTab(t); setExpanded(false); }}
              style={{
                flex: 1,
                background: active ? "#18181b" : "none",
                border: "none",
                borderRight: idx < TABS.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                cursor: "pointer",
                fontFamily: "var(--font-sans), sans-serif",
                fontSize: 12, fontWeight: active ? 600 : 500,
                color: active ? "white" : "#52525b",
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
                transition: "background 0.12s, color 0.12s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}
            >
              {t}
              {cnt > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, lineHeight: 1,
                  background: active ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.07)",
                  color: active ? "rgba(255,255,255,0.85)" : "#71717a",
                  borderRadius: 4, padding: "2px 5px",
                }}>
                  {cnt > 9 ? "9+" : cnt}
                </span>
              )}
            </button>
          );
        })}
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
                fontFamily: "var(--font-sans), sans-serif", fontSize: 12, fontWeight: 500,
                padding: "5px 22px", borderRadius: 20, cursor: "pointer",
                border: "1px solid rgba(0,0,0,0.08)",
                background: "rgba(255,255,255,0.55)",
                backdropFilter: "blur(6px)",
                color: "#71717a",
                opacity: 0.85,
                transition: "opacity 0.15s",
                letterSpacing: "-0.01em",
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
