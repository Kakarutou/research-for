"use client";
import { useState, useEffect } from "react";
import type { InformItem } from "@/app/api/news/inform/route";

type Tab = "news" | "inform" | "report";
const TABS: { id: Tab; label: string }[] = [
  { id: "news",   label: "News" },
  { id: "inform", label: "Inform" },
  { id: "report", label: "Report" },
];

function relTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)         return "just now";
  if (diff < 3600)       return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)      return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

function InformList({ items, loading, error }: {
  items: InformItem[] | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading && items === null) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
        Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "rgba(248,113,113,0.85)", fontSize: 13 }}>
        Failed to load: {error}
      </div>
    );
  }
  if (!items || items.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
        No bullish news yet.
      </div>
    );
  }
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((it, i) => (
        <li
          key={it.id + i}
          style={{
            borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
          }}
        >
          <a
            href={it.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              padding: "12px 18px",
              textDecoration: "none",
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{
              fontFamily: "var(--font-sans), sans-serif",
              fontSize: 13.5, fontWeight: 600, color: "white", lineHeight: 1.4,
              marginBottom: 4,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {it.title}
            </div>
            <div style={{
              display: "flex", gap: 10, alignItems: "center",
              fontFamily: "var(--font-mono), monospace",
              fontSize: 11, color: "rgba(255,255,255,0.5)",
            }}>
              <span style={{ color: "rgba(74,222,128,0.85)", fontWeight: 600 }}>{it.source}</span>
              <span>·</span>
              <span>{relTime(it.pubDate)}</span>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div style={{
      height: "100%",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-sans), sans-serif",
      fontSize: 14, fontWeight: 500,
      color: "rgba(255,255,255,0.35)",
      letterSpacing: "0.02em",
    }}>
      {label}
    </div>
  );
}

export default function NewsBox() {
  const [tab, setTab] = useState<Tab>("news");
  const [informItems, setInformItems] = useState<InformItem[] | null>(null);
  const [informLoading, setInformLoading] = useState(false);
  const [informError, setInformError] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "inform") return;
    let cancelled = false;
    const load = async () => {
      setInformLoading(true);
      setInformError(null);
      try {
        const res = await fetch("/api/news/inform");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setInformItems(data.items ?? []);
      } catch (e) {
        if (!cancelled) setInformError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setInformLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [tab]);

  return (
    <section style={{ position: "relative", zIndex: 5, padding: "0 32px 48px", marginTop: -32 }}>
      <div style={{
        background: "rgba(255,255,255,0.06)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.2), 0 16px 48px rgba(0,0,0,0.28)",
        overflow: "hidden",
        // IndexBox의 US ~ Hong Kong (Japan 박스 앞 경계선까지)
        // minWidth 168이지만 콘텐츠가 더 길면 region이 늘어나서 실측 기반 조정
        width: 900,
        height: 600,
        display: "flex", flexDirection: "column",
      }}>
        {/* 상단 탭 (고정) */}
        <div style={{
          flexShrink: 0,
          display: "flex", justifyContent: "center", gap: 8,
          padding: "16px 16px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  fontFamily: "var(--font-sans), sans-serif",
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  letterSpacing: "0.02em",
                  color: active ? "white" : "rgba(255,255,255,0.55)",
                  background: active ? "rgba(255,255,255,0.12)" : "transparent",
                  border: "1px solid",
                  borderColor: active ? "rgba(255,255,255,0.18)" : "transparent",
                  borderRadius: 8,
                  padding: "8px 20px",
                  cursor: "pointer",
                  transition: "background 0.15s, color 0.15s, border-color 0.15s",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* 콘텐츠 영역 (휠 스크롤 가능) */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          overscrollBehavior: "contain",
        }}>
          {tab === "inform" ? (
            <InformList items={informItems} loading={informLoading} error={informError} />
          ) : (
            <Placeholder label={TABS.find(t => t.id === tab)?.label ?? ""} />
          )}
        </div>
      </div>
    </section>
  );
}
