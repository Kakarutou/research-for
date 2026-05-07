"use client";
import { useState, useEffect } from "react";

interface Bet {
  id: string;
  market: string;
  side: "long" | "short";
  amount: number;
  kstDate: string;
  settled: boolean;
  won?: boolean;
  payout?: number;
}

interface Props { onClose: () => void }

export default function MyBetsModal({ onClose }: Props) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("rf_token") ?? "";
    fetch("/api/bets", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setBets(d.bets ?? []); setLoading(false); });
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "white", borderRadius: 20, width: "100%", maxWidth: 480,
        boxShadow: "0 24px 80px rgba(0,0,0,0.18)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "24px 28px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 16, fontWeight: 700, color: "#18181b" }}>
                My Bets
              </div>
              <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "#a1a1aa", marginTop: 3 }}>
                Recent prediction history
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#a1a1aa" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "1fr 60px 90px 90px",
            padding: "0 0 8px", borderBottom: "1px solid #f4f4f5",
            fontFamily: "var(--font-sans), sans-serif", fontSize: 10,
            fontWeight: 600, color: "#a1a1aa",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            <span>Market · Date</span>
            <span>Side</span>
            <span style={{ textAlign: "right" }}>Bet</span>
            <span style={{ textAlign: "right" }}>Result</span>
          </div>
        </div>

        <div style={{ maxHeight: 420, overflowY: "auto", padding: "4px 28px 24px" }}>
          {loading ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#a1a1aa", fontSize: 13 }}>Loading…</div>
          ) : bets.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#a1a1aa", fontSize: 13 }}>
              No bets yet. Place your first prediction!
            </div>
          ) : (
            bets.map((bet, i) => (
              <div key={bet.id} style={{
                display: "grid", gridTemplateColumns: "1fr 60px 90px 90px",
                alignItems: "center", padding: "11px 0",
                borderBottom: i < bets.length - 1 ? "1px solid #fafafa" : "none",
              }}>
                <div>
                  <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, fontWeight: 700, color: "#18181b" }}>
                    {bet.market}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, color: "#a1a1aa", marginTop: 2 }}>
                    {bet.kstDate}
                  </div>
                </div>
                <span style={{
                  fontFamily: "var(--font-mono), monospace", fontSize: 11, fontWeight: 700,
                  color: bet.side === "long" ? "#16a34a" : "#dc2626",
                }}>
                  {bet.side === "long" ? "▲ L" : "▼ S"}
                </span>
                <span style={{
                  fontFamily: "var(--font-mono), monospace", fontSize: 12,
                  color: "#52525b", textAlign: "right",
                }}>−{bet.amount} RFC</span>
                <span style={{
                  fontFamily: "var(--font-mono), monospace", fontSize: 12, fontWeight: 600,
                  textAlign: "right",
                  color: !bet.settled ? "#a1a1aa" : bet.won ? "#16a34a" : "#dc2626",
                }}>
                  {!bet.settled
                    ? "Pending"
                    : bet.won
                    ? `+${(bet.payout ?? 0) - bet.amount} RFC`
                    : "–"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
