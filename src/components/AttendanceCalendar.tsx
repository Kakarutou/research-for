"use client";
import { useState, useEffect, useCallback } from "react";

interface Props {
  token: string;
  onClose: () => void;
  onRfcUpdate: (newBalance: number) => void;
}

interface AttendanceData {
  attendanceDates: string[];
  checkedToday: boolean;
  streak: number;
  rfcBalance: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AttendanceCalendar({ token, onClose, onRfcUpdate }: Props) {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [toast, setToast] = useState("");
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

  const load = useCallback(async () => {
    const res = await fetch('/api/attendance', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const checkIn = async () => {
    setChecking(true);
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await res.json();
    if (res.ok) {
      setData(prev => prev ? { ...prev, ...result, checkedToday: true } : null);
      onRfcUpdate(result.rfcBalance);
      setToast(result.bonusMsg || `Check-in complete! +${result.reward} RFC`);
      setTimeout(() => setToast(""), 3000);
    }
    setChecking(false);
  };

  const today = new Date();
  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const dateStr = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "white", borderRadius: 20, width: "100%", maxWidth: 400,
        boxShadow: "0 24px 80px rgba(0,0,0,0.18)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "24px 24px 0", borderBottom: "1px solid #f4f4f5" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 16, fontWeight: 700, color: "#18181b" }}>Attendance</div>
              {data && (
                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "#16a34a", fontWeight: 600, marginTop: 3 }}>
                  {data.streak}-day streak · {data.rfcBalance.toLocaleString()} RFC
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#a1a1aa" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* RFC info */}
          <div style={{
            marginBottom: 16,
            fontFamily: "var(--font-sans), sans-serif", fontSize: 12, color: "#a1a1aa",
          }}>
            Daily <strong style={{ color: "#18181b" }}>+10 RFC</strong> &nbsp;·&nbsp; 7-day streak bonus <strong style={{ color: "#18181b" }}>+20 RFC</strong>
          </div>

          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button onClick={() => { const d = new Date(viewYear, viewMonth - 1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#a1a1aa", padding: 4 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <span style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 14, fontWeight: 600, color: "#18181b" }}>
              {new Date(viewYear, viewMonth).toLocaleString("en-US", { month: "long", year: "numeric" })}
            </span>
            <button onClick={() => { const d = new Date(viewYear, viewMonth + 1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }}
              disabled={viewYear === today.getFullYear() && viewMonth >= today.getMonth()}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#a1a1aa", padding: 4, opacity: viewYear === today.getFullYear() && viewMonth >= today.getMonth() ? 0.3 : 1 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        <div style={{ padding: "16px 20px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#a1a1aa", fontSize: 13 }}>Loading…</div>
          ) : (
            <>
              {/* Day headers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 8 }}>
                {DAYS.map((d, i) => (
                  <div key={d} style={{
                    textAlign: "center", fontSize: 11, fontWeight: 600,
                    color: i === 0 ? "#ef4444" : i === 6 ? "#3b82f6" : "#a1a1aa",
                    padding: "4px 0", fontFamily: "var(--font-sans), sans-serif",
                  }}>{d}</div>
                ))}
              </div>

              {/* Date cells */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const ds = dateStr(day);
                  const isAttended = data?.attendanceDates.includes(ds);
                  const isToday = ds === todayStr;
                  const isFuture = ds > todayStr;
                  const dow = (firstDow + day - 1) % 7;

                  return (
                    <div key={i} style={{
                      aspectRatio: "1",
                      display: "grid", placeItems: "center",
                      borderRadius: 8,
                      background: isAttended ? "#16a34a" : isToday ? "#f4f4f5" : "transparent",
                      border: isToday && !isAttended ? "1.5px solid #18181b" : "1.5px solid transparent",
                      position: "relative",
                    }}>
                      <span style={{
                        fontFamily: "var(--font-sans), sans-serif",
                        fontSize: 12, fontWeight: isToday ? 700 : 400,
                        color: isAttended ? "white" : isFuture ? "#d4d4d8" : dow === 0 ? "#ef4444" : dow === 6 ? "#3b82f6" : "#18181b",
                      }}>{day}</span>
                      {isAttended && (
                        <span style={{ position: "absolute", top: 1, right: 2, fontSize: 7 }}>✓</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Check-in button */}
        <div style={{ padding: "0 20px 20px" }}>
          {toast && (
            <div style={{
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 10, padding: "10px 14px", marginBottom: 10,
              fontFamily: "var(--font-sans), sans-serif", fontSize: 13, color: "#15803d", textAlign: "center",
            }}>{toast}</div>
          )}
          <button
            onClick={checkIn}
            disabled={data?.checkedToday || checking}
            style={{
              width: "100%", padding: "13px 0",
              background: data?.checkedToday ? "#f4f4f5" : "#18181b",
              color: data?.checkedToday ? "#a1a1aa" : "white",
              border: "none", borderRadius: 12, cursor: data?.checkedToday ? "not-allowed" : "pointer",
              fontFamily: "var(--font-sans), sans-serif", fontSize: 14, fontWeight: 600,
            }}
          >
            {checking ? "Processing…" : data?.checkedToday ? "Attendance done" : "Check In  +10 RFC"}
          </button>
        </div>
      </div>
    </div>
  );
}
