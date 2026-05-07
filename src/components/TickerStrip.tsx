"use client";
import { useEffect, useState } from "react";
import type { MarketItem } from "@/app/api/market/live/route";

const FALLBACK: MarketItem[] = [
  { id: "NASDAQ", name: "Nasdaq Composite", price: "—",     rawPrice: 0, change: "—",    changePct: 0, isUp: true },
  { id: "KOSPI",  name: "Korea Composite",  price: "—",     rawPrice: 0, change: "—",    changePct: 0, isUp: true },
  { id: "N225",   name: "Nikkei 225",       price: "—",     rawPrice: 0, change: "—",    changePct: 0, isUp: true },
  { id: "BTC",    name: "Bitcoin",          price: "—",     rawPrice: 0, change: "—",    changePct: 0, isUp: true },
];

export default function TickerStrip() {
  const [markets, setMarkets] = useState<MarketItem[]>(FALLBACK);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/market/live");
        if (!res.ok) return;
        const data: MarketItem[] = await res.json();
        setMarkets(data);
        setLastUpdated(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
      } catch {}
    };
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(9,9,11,0.7)",
      backdropFilter: "blur(12px)",
      position: "relative", zIndex: 9,
    }}>
      <div style={{
        maxWidth: 1080, margin: "0 auto", padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 44,
      }}>
        <div style={{ display: "flex", alignItems: "stretch" }}>
          {markets.map((m, i) => (
            <div key={m.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "0 28px", paddingLeft: i === 0 ? 0 : undefined,
              borderRight: i < markets.length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none",
            }}>
              <span style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 11, fontWeight: 600,
                color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em",
              }}>{m.id}</span>
              <span style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 13, fontWeight: 500,
                color: "rgba(255,255,255,0.9)",
              }}>{m.price}</span>
              <span style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 11, fontWeight: 600,
                color: m.isUp ? "#4ade80" : "#f87171",
              }}>{m.change}</span>
            </div>
          ))}
        </div>

        {lastUpdated && (
          <span style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em",
          }}>
            Updated {lastUpdated}
          </span>
        )}
      </div>
    </div>
  );
}
