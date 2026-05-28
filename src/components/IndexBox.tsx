"use client";
import { useEffect, useState } from "react";
import type { CountryGroup } from "@/app/api/market/indices/route";

const blank = (id: string, name: string) => ({
  id, name, symbol: "", price: "—", rawPrice: 0, change: "—", changePct: 0, isUp: true,
});

const FALLBACK: CountryGroup[] = [
  { region: "US",        indices: [blank("SPX", "S&P 500"), blank("IXIC", "Nasdaq"), blank("DJI", "Dow Jones")] },
  { region: "Europe",    indices: [blank("STOXX", "STOXX 50"), blank("DAX", "DAX"), blank("FTSE", "FTSE 100")] },
  { region: "Korea",     indices: [blank("KOSPI", "KOSPI"), blank("KOSDAQ", "KOSDAQ")] },
  { region: "China",     indices: [blank("SSEC", "Shanghai"), blank("CSI300", "CSI 300")] },
  { region: "Hong Kong", indices: [blank("HSI", "Hang Seng")] },
  { region: "Japan",     indices: [blank("N225", "Nikkei 225")] },
  { region: "Crypto",    indices: [blank("BTC", "Bitcoin"), blank("ETH", "Ethereum")] },
  { region: "Others",    indices: [blank("RUT", "Russell 2000"), blank("VIX", "VIX")] },
  { region: "Metals",    indices: [blank("GOLD", "Gold"), blank("SILVER", "Silver"), blank("COPPER", "Copper")] },
  { region: "Energy",    indices: [blank("WTI", "WTI"), blank("BRENT", "Brent"), blank("NATGAS", "Nat Gas")] },
];

// 지역 → 국기/아이콘 이미지 (배팅 시스템 국기 재활용 + 신규 SVG)
const ICON: Record<string, string> = {
  US: "/nasdaq.svg",
  Europe: "/eu.svg",
  Korea: "/kospi.svg",
  China: "/cn.svg",
  "Hong Kong": "/hsi.svg",
  Japan: "/nikkei.svg",
  Crypto: "/btc.png",
  Others: "/others.svg",
  Metals: "/metals.svg",
  Energy: "/energy.svg",
};

export default function IndexBox() {
  const [groups, setGroups] = useState<CountryGroup[]>(FALLBACK);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/market/indices");
        if (!res.ok) return;
        const data: CountryGroup[] = await res.json();
        if (Array.isArray(data) && data.length) setGroups(data);
      } catch {}
    };
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section style={{ position: "relative", zIndex: 5, padding: "16px 32px 48px" }}>
      <div style={{
        background: "rgba(255,255,255,0.06)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.2), 0 16px 48px rgba(0,0,0,0.28)",
        overflow: "hidden",
      }}>
        <div className="index-strip" style={{ display: "flex", alignItems: "stretch", overflowX: "auto" }}>
          {groups.map((g, gi) => (
            <div key={g.region} style={{
              flexShrink: 0, minWidth: 168,
              padding: "13px 16px",
              borderRight: gi < groups.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              {/* Region header: 국기 + 라벨 (가로 가운데) */}
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {ICON[g.region] && (
                  <img
                    src={ICON[g.region]}
                    alt={g.region}
                    width={28}
                    height={18}
                    style={{
                      borderRadius: 3, objectFit: "cover", display: "block", flexShrink: 0,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.45)",
                    }}
                  />
                )}
                <span style={{
                  fontFamily: "var(--font-sans), sans-serif", fontSize: 15, fontWeight: 700,
                  color: "white", letterSpacing: "0.01em",
                }}>
                  {g.region}
                </span>
              </div>

              {/* Index rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {g.indices.map(m => {
                  const up = m.isUp;
                  const color = m.price === "—" ? "rgba(255,255,255,0.4)" : up ? "#4ade80" : "#f87171";
                  return (
                    <div key={m.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
                      <span style={{
                        fontFamily: "var(--font-sans), sans-serif", fontSize: 12.5, fontWeight: 500,
                        color: "rgba(255,255,255,0.62)", whiteSpace: "nowrap", paddingTop: 2,
                      }}>
                        {m.name}
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, flexShrink: 0 }}>
                        <span style={{
                          fontFamily: "var(--font-mono), monospace", fontSize: 15, fontWeight: 700,
                          color: "white", letterSpacing: "-0.01em", whiteSpace: "nowrap",
                        }}>
                          {m.price}
                        </span>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 3,
                          fontFamily: "var(--font-mono), monospace", fontSize: 11.5, fontWeight: 600,
                          color, whiteSpace: "nowrap",
                        }}>
                          {m.price !== "—" && (
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"
                              style={{ transform: up ? "none" : "rotate(180deg)" }}>
                              <path d="M12 19V5M5 12l7-7 7 7" />
                            </svg>
                          )}
                          {m.change}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
