"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { TrendingItem } from "@/app/api/search/trending/route";

export default function TrendingBox() {
  const router = useRouter();
  const [trending, setTrending] = useState<TrendingItem[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/search/trending");
        if (res.ok) setTrending(await res.json());
      } catch {}
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const handleClick = (item: TrendingItem) => {
    fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: item.symbol, name: item.name }),
    }).catch(() => {});
    router.push(`/stock/${item.symbol}`);
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.85)", backdropFilter: "blur(24px)",
      border: "1px solid var(--gray-200)", borderRadius: 24,
      boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 12px 40px rgba(0,0,0,0.08)",
      padding: "16px 20px", width: 220, flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid var(--gray-100)" }}>
        <span style={{
          fontFamily: "var(--font-mono), monospace", fontSize: 10,
          color: "var(--gray-500)", letterSpacing: "0.1em", textTransform: "uppercase",
        }}>
          실시간 검색 순위
        </span>
      </div>

      {/* Rankings */}
      {trending.length === 0 ? (
        <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 12, color: "var(--gray-400)", textAlign: "center", padding: "16px 0" }}>
          검색 기록이 없어요
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {trending.map((item, i) => (
            <div
              key={item.symbol}
              onClick={() => handleClick(item)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "5px 6px", borderRadius: 8, cursor: "pointer",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "#f9fafb"}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}
            >
              <span style={{
                fontFamily: "var(--font-mono), monospace", fontSize: 11, fontWeight: 700,
                color: i < 3 ? "#f97316" : "var(--gray-400)",
                minWidth: 16, textAlign: "right",
              }}>
                {i + 1}
              </span>
              <span style={{
                fontFamily: "var(--font-mono), monospace", fontSize: 12, fontWeight: 700,
                color: "var(--gray-900)",
              }}>
                {item.symbol}
              </span>
              <span style={{
                fontFamily: "var(--font-sans), sans-serif", fontSize: 11,
                color: "var(--gray-400)", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {item.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
