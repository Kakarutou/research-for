"use client";
import { useState, useEffect } from "react";
import type { StockInfo } from "@/app/api/stock/[ticker]/route";

const fmtP = (v: number) =>
  v.toLocaleString(undefined, { minimumFractionDigits: v < 100 ? 2 : 0, maximumFractionDigits: v < 100 ? 2 : 0 });
const fmtA = (v: number) =>
  Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: Math.abs(v) < 100 ? 2 : 0, maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 });

export default function LivePriceDisplay({ ticker, initial }: { ticker: string; initial: StockInfo }) {
  const [info, setInfo] = useState<StockInfo>(initial);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/stock/${encodeURIComponent(ticker)}`, { cache: "no-store" });
        if (res.ok) {
          const data: StockInfo | null = await res.json();
          if (data) setInfo(data);
        }
      } catch {}
    };
    const id = setInterval(poll, 60_000);
    return () => clearInterval(id);
  }, [ticker]);

  const regPrice  = info.isAfterHours ? info.regularPrice! : info.price;
  const regChgPct = info.isAfterHours ? (info.regularChangePct ?? 0) : info.changePct;
  const regChgAmt = info.isAfterHours ? (info.regularChangeAmt ?? 0) : (info.changeAmt ?? 0);
  const regUp     = regChgPct >= 0;

  return (
    <div style={{ textAlign: "right" }}>
      {/* Regular session row */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 36, fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.03em", lineHeight: 1 }}>
          {fmtP(regPrice)}
        </span>
        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 16, fontWeight: 700, color: regUp ? "var(--up)" : "var(--down)", whiteSpace: "nowrap" }}>
          {regUp ? "▲" : "▼"}{fmtA(regChgAmt)}
          <span style={{ fontSize: 14, marginLeft: 5, opacity: 0.9 }}>({Math.abs(regChgPct).toFixed(2)}%)</span>
        </span>
      </div>

      {/* Extended hours row */}
      {info.isAfterHours && info.regularPrice != null && (() => {
        const extUp  = info.changePct >= 0;
        const label  = info.session === "PRE" ? "Pre Market" : "After Market";
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end", marginTop: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, fontWeight: 600, color: "var(--gray-500)", letterSpacing: "0.03em" }}>
              {label}
            </span>
            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 18, fontWeight: 700, color: "var(--gray-800)" }}>
              {fmtP(info.price)}
            </span>
            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 13, fontWeight: 600, color: extUp ? "var(--up)" : "var(--down)", whiteSpace: "nowrap" }}>
              {extUp ? "▲" : "▼"}{fmtA(info.changeAmt ?? 0)}
              <span style={{ fontSize: 12, marginLeft: 4, opacity: 0.9 }}>({Math.abs(info.changePct).toFixed(2)}%)</span>
            </span>
          </div>
        );
      })()}
    </div>
  );
}
