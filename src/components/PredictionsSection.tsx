"use client";
import { useEffect, useState, useCallback } from "react";
import { MARKETS } from "@/lib/mockData";
import type { MarketItem } from "@/app/api/market/live/route";
import { useAuth } from "@/hooks/useAuth";
import { isBettingOpen, minsUntilClose, formatCountdown, SCHEDULES } from "@/lib/marketSchedule";

const MARKET_IMG: Record<string, { src: string; w: number; h: number; bg: string; radius: number }> = {
  NASDAQ: { src: "/nasdaq.svg", w: 42, h: 26, bg: "#3c3b6e", radius: 6 },
  KOSPI:  { src: "/kospi.svg",  w: 42, h: 26, bg: "#fff",    radius: 6 },
  N225:   { src: "/nikkei.svg", w: 42, h: 26, bg: "#fff",    radius: 6 },
  BTC:    { src: "/btc.png",    w: 30, h: 30, bg: "#f7931a", radius: 15 },
};

const PARTICIPANTS: Record<string, number> = {
  NASDAQ: 2841, KOSPI: 1204, N225: 876, BTC: 5392,
};

interface UserBet {
  date: string;
  market: string;
  side: "long" | "short";
  amount: number;
}

export default function PredictionsSection() {
  const { user, updateRfcBalance } = useAuth();
  const [liveData, setLiveData] = useState<Record<string, MarketItem>>({});
  const [userBet, setUserBet] = useState<UserBet | null>(null);
  const [confirming, setConfirming] = useState<{ market: string; side: "long" | "short" } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Refresh countdown every minute
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/market/live");
        if (!res.ok) return;
        const items: MarketItem[] = await res.json();
        const map: Record<string, MarketItem> = {};
        items.forEach(item => { map[item.id] = item; });
        setLiveData(map);
      } catch {}
    };
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadBet = useCallback(async () => {
    if (!user) return;
    const token = localStorage.getItem("rf_token") ?? "";
    const res = await fetch("/api/bets", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setUserBet(data.bet);
    }
  }, [user]);

  useEffect(() => { loadBet(); }, [loadBet]);

  const handleBetClick = (market: string, side: "long" | "short") => {
    if (!user || userBet || !isBettingOpen(market)) return;
    if (confirming?.market === market && confirming?.side === side) {
      submitBet(market, side);
    } else {
      setConfirming({ market, side });
    }
  };

  const submitBet = async (market: string, side: "long" | "short") => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem("rf_token") ?? "";
      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ market, side }),
      });
      const data = await res.json();
      if (res.ok) {
        setUserBet(data.bet);
        updateRfcBalance(data.rfcBalance);
      }
    } finally {
      setSubmitting(false);
      setConfirming(null);
    }
  };

  // suppress unused warning — `now` triggers re-render for countdown
  void now;

  const totalParticipants = Object.values(PARTICIPANTS).reduce((a, b) => a + b, 0);
  const hasBet = !!userBet;

  return (
    <section
      style={{ position: "relative", zIndex: 5, maxWidth: 960, margin: "36px auto 0", padding: "0 24px" }}
      onClick={() => setConfirming(null)}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 7, height: 7, background: "var(--up)", borderRadius: "50%",
              boxShadow: "0 0 8px var(--up)", display: "inline-block",
              animation: "pulse-dot 1.6s infinite",
            }} />
            <span style={{
              fontFamily: "var(--font-sans), sans-serif",
              fontSize: 15, fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.02em",
            }}>Today&apos;s Predictions</span>
          </div>
          <span style={{
            fontFamily: "var(--font-mono), monospace", fontSize: 11,
            background: "var(--gray-100)", color: "var(--gray-600)",
            padding: "3px 10px", borderRadius: 20, letterSpacing: "0.04em",
          }}>
            {totalParticipants.toLocaleString()} active today
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {user && hasBet && (
            <span style={{
              fontFamily: "var(--font-sans), sans-serif", fontSize: 11, fontWeight: 600,
              color: "#16a34a", background: "#f0fdf4",
              border: "1px solid #bbf7d0", borderRadius: 6, padding: "3px 10px",
            }}>
              Voted · {userBet.market} {userBet.side === "long" ? "Long" : "Short"}
            </span>
          )}
        </div>
      </div>

      {MARKETS.map(m => {
        const live = liveData[m.id];
        const price  = live ? live.price  : m.price;
        const change = live ? live.change : m.change;
        const isUp   = live ? live.isUp   : m.isUp;

        const longN   = Number(m.longPool.replace(",", ""));
        const shortN  = Number(m.shortPool.replace(",", ""));
        const longPct = Math.round((longN / (longN + shortN)) * 100);

        const myBetOnThis = userBet?.market === m.id ? userBet.side : null;
        const betOpen = isBettingOpen(m.id);
        const isLocked = hasBet && !myBetOnThis;
        const isConfirmingLong  = confirming?.market === m.id && confirming?.side === "long";
        const isConfirmingShort = confirming?.market === m.id && confirming?.side === "short";
        const schedule = SCHEDULES[m.id];
        const countdown = betOpen ? formatCountdown(minsUntilClose(m.id)) : null;

        return (
          <div key={m.id} style={{
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(20px)",
            border: "1px solid var(--gray-200)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 7,
            opacity: isLocked ? 0.62 : 1,
            transition: "opacity 0.2s",
          }}>
            <div className="market-row-grid" style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr 1fr", alignItems: "center", gap: 12, marginBottom: 10 }}>

              {/* Market info */}
              <div className="market-info-cell" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {(() => {
                  const mi = MARKET_IMG[m.id];
                  if (!mi) return null;
                  return (
                    <div style={{
                      width: mi.w, height: mi.h,
                      borderRadius: mi.radius,
                      overflow: "hidden", flexShrink: 0,
                      background: mi.bg,
                      boxShadow: "0 1px 5px rgba(0,0,0,0.18)",
                    }}>
                      <img
                        src={mi.src}
                        alt={m.id}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    </div>
                  );
                })()}
                <div>
                  <div style={{ fontFamily: "var(--font-mono), monospace", fontWeight: 700, fontSize: 13, color: "var(--gray-900)", letterSpacing: "0.02em" }}>{m.id}</div>
                  <div style={{ fontSize: 11, color: "var(--gray-400)", marginTop: 2 }}>{m.name}</div>
                </div>
              </div>

              {/* Price */}
              <div className="market-price-cell" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 14, fontWeight: 600, color: "var(--gray-900)" }}>{price}</span>
                <span style={{
                  fontFamily: "var(--font-mono), monospace", fontSize: 11, fontWeight: 600,
                  padding: "2px 7px", borderRadius: 4,
                  color: isUp ? "var(--up)" : "var(--down)",
                  background: isUp ? "var(--up-bg)" : "var(--down-bg)",
                }}>{change}</span>
              </div>

              <div className="market-long-cell">
                <BetButton
                  side="long"
                  pool={m.longPool}
                  disabled={isLocked || submitting || !betOpen}
                  myPick={myBetOnThis === "long"}
                  confirming={isConfirmingLong}
                  onClick={e => { e.stopPropagation(); handleBetClick(m.id, "long"); }}
                  notLoggedIn={!user}
                />
              </div>
              <div className="market-short-cell">
                <BetButton
                  side="short"
                  pool={m.shortPool}
                  disabled={isLocked || submitting || !betOpen}
                  myPick={myBetOnThis === "short"}
                  confirming={isConfirmingShort}
                  onClick={e => { e.stopPropagation(); handleBetClick(m.id, "short"); }}
                  notLoggedIn={!user}
                />
              </div>
            </div>

            {/* Bottom bar */}
            <div style={{ paddingTop: 8, borderTop: "1px solid var(--gray-100)", display: "flex", alignItems: "center", gap: 10 }}>
              {/* Long/Short bar — left label */}
              <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, fontWeight: 700, color: "var(--up)", whiteSpace: "nowrap", width: 44, flexShrink: 0 }}>
                ▲ {longPct}%
              </span>
              {/* Bar — always fills the remaining space equally */}
              <div style={{ flex: 1, height: 4, borderRadius: 2, overflow: "hidden", display: "flex" }}>
                <div style={{ width: `${longPct}%`, height: "100%", background: "var(--up)" }} />
                <div style={{ flex: 1, height: "100%", background: "var(--down)" }} />
              </div>
              {/* Right label */}
              <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, fontWeight: 700, color: "var(--down)", whiteSpace: "nowrap", width: 44, flexShrink: 0, textAlign: "right" }}>
                {100 - longPct}% ▼
              </span>
              <span className="bottom-bar-votes" style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, color: "var(--gray-400)", whiteSpace: "nowrap", width: 64, flexShrink: 0 }}>
                {(PARTICIPANTS[m.id] ?? 0).toLocaleString()} votes
              </span>

              {/* Spacer */}
              <div className="bottom-bar-divider" style={{ flex: "0 0 1px", background: "var(--gray-200)", height: 12, margin: "0 4px", flexShrink: 0 }} />

              {/* Betting window status — fixed width so bar length is consistent */}
              {betOpen ? (
                <span className="bottom-bar-status" style={{
                  fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 600,
                  color: "#16a34a", whiteSpace: "nowrap", width: 180, flexShrink: 0, textAlign: "right",
                }}>
                  Open · closes {schedule.closeLabel}{countdown ? ` (${countdown})` : ""}
                </span>
              ) : (
                <span className="bottom-bar-status" style={{
                  fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 600,
                  color: "#a1a1aa", whiteSpace: "nowrap", width: 180, flexShrink: 0, textAlign: "right",
                }}>
                  Closed · opens {schedule.openLabel}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {!user && (
        <p style={{
          textAlign: "center", marginTop: 12,
          fontFamily: "var(--font-sans), sans-serif", fontSize: 12, color: "var(--gray-400)",
        }}>
          Sign in to place bets · 100 RFC per prediction
        </p>
      )}
    </section>
  );
}

interface BetButtonProps {
  side: "long" | "short";
  pool: string;
  disabled: boolean;
  myPick: boolean;
  confirming: boolean;
  notLoggedIn: boolean;
  onClick: (e: React.MouseEvent) => void;
}

function BetButton({ side, pool, disabled, myPick, confirming, notLoggedIn, onClick }: BetButtonProps) {
  const isLong = side === "long";

  const bg = myPick || confirming
    ? (isLong ? "var(--up-bg)" : "var(--down-bg)")
    : "rgba(255,255,255,0.5)";

  const border = myPick || confirming
    ? (isLong ? "1px solid var(--up)" : "1px solid var(--down)")
    : "1px solid var(--gray-200)";

  return (
    <button
      onClick={onClick}
      disabled={disabled && !myPick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8, border, background: bg,
        padding: "9px 12px", borderRadius: 10,
        cursor: (disabled && !myPick) || notLoggedIn ? "default" : "pointer",
        width: "100%", transition: "all 0.15s",
        opacity: notLoggedIn ? 0.45 : 1,
      }}
      onMouseEnter={e => {
        if (disabled || myPick || notLoggedIn) return;
        (e.currentTarget as HTMLButtonElement).style.borderColor = isLong ? "var(--up)" : "var(--down)";
        (e.currentTarget as HTMLButtonElement).style.background  = isLong ? "var(--up-bg)" : "var(--down-bg)";
      }}
      onMouseLeave={e => {
        if (disabled || myPick || confirming || notLoggedIn) return;
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--gray-200)";
        (e.currentTarget as HTMLButtonElement).style.background  = "rgba(255,255,255,0.5)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{
          fontFamily: "var(--font-mono), monospace", fontSize: 12, fontWeight: 700,
          width: 22, height: 22, borderRadius: 5, display: "grid", placeItems: "center",
          color: isLong ? "var(--up)" : "var(--down)",
          background: isLong ? "var(--up-bg)" : "var(--down-bg)",
        }}>{isLong ? "▲" : "▼"}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-700)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {myPick ? "My pick" : confirming ? "Confirm?" : isLong ? "Long" : "Short"}
        </span>
      </div>
      <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, fontWeight: 600, color: "var(--gray-800)" }}>
        {confirming && !myPick
          ? <span style={{ color: isLong ? "var(--up)" : "var(--down)" }}>−100 RFC</span>
          : <>{pool} <span style={{ fontSize: 9, color: "var(--gray-400)" }}>RFC</span></>
        }
      </span>
    </button>
  );
}
