"use client";
import { useState, useEffect } from "react";

interface Entry {
  username: string;
  rfcBalance: number;
  wins: number;
  total: number;
  winRate: number | null;
}

interface Props { onClose: () => void }

export default function LeaderboardModal({ onClose }: Props) {
  const [data, setData] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard").then(r => r.json()).then(d => { setData(d); setLoading(false); });
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
                Leaderboard
              </div>
              <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "#a1a1aa", marginTop: 3 }}>
                Ranked by RFC balance
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#a1a1aa" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Column headers */}
          <div style={{
            display: "grid", gridTemplateColumns: "32px 1fr 110px 80px",
            padding: "0 0 8px", borderBottom: "1px solid #f4f4f5",
            fontFamily: "var(--font-sans), sans-serif", fontSize: 10,
            fontWeight: 600, color: "#a1a1aa",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            <span>#</span>
            <span>User</span>
            <span style={{ textAlign: "right" }}>RFC Balance</span>
            <span style={{ textAlign: "right" }}>Win Rate</span>
          </div>
        </div>

        {/* List */}
        <div style={{ maxHeight: 420, overflowY: "auto", padding: "4px 28px 24px" }}>
          {loading ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#a1a1aa", fontSize: 13 }}>Loading…</div>
          ) : data.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#a1a1aa", fontSize: 13 }}>No data yet</div>
          ) : (
            data.map((entry, i) => (
              <div key={entry.username} style={{
                display: "grid", gridTemplateColumns: "32px 1fr 110px 80px",
                alignItems: "center", padding: "10px 0",
                borderBottom: i < data.length - 1 ? "1px solid #fafafa" : "none",
              }}>
                <span style={{
                  fontFamily: "var(--font-mono), monospace", fontSize: 12,
                  fontWeight: 700,
                  color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c54" : "#d4d4d8",
                }}>{i + 1}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, background: "#18181b",
                    display: "grid", placeItems: "center",
                    fontFamily: "var(--font-sans), sans-serif",
                    fontSize: 11, fontWeight: 700, color: "white",
                  }}>{entry.username[0].toUpperCase()}</div>
                  <span style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 13, fontWeight: 600, color: "#18181b" }}>
                    {entry.username}
                  </span>
                </div>
                <span style={{
                  fontFamily: "var(--font-mono), monospace", fontSize: 12, fontWeight: 600,
                  color: "#16a34a", textAlign: "right",
                }}>{entry.rfcBalance.toLocaleString()} RFC</span>
                <span style={{
                  fontFamily: "var(--font-mono), monospace", fontSize: 11,
                  color: entry.winRate !== null ? "#18181b" : "#d4d4d8",
                  textAlign: "right",
                }}>
                  {entry.winRate !== null ? `${entry.winRate}%` : "–"}
                  {entry.total > 0 && (
                    <span style={{ color: "#a1a1aa", fontSize: 10 }}> ({entry.total})</span>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
