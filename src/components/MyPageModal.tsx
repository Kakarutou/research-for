"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

interface Props { onClose: () => void }
interface Stats { attendanceDates: string[]; streak: number; rfcBalance: number }
interface BetStats { total: number; wins: number; pending: number }

export default function MyPageModal({ onClose }: Props) {
  const { user } = useAuth();
  const [tab, setTab]           = useState<"profile" | "posts" | "comments">("profile");
  const [stats, setStats]       = useState<Stats | null>(null);
  const [betStats, setBetStats] = useState<BetStats>({ total: 0, wins: 0, pending: 0 });
  const [avatarPhoto, setAvatarPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    try { setAvatarPhoto(localStorage.getItem("rf_avatar")); } catch {}
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("rf_token") ?? "";

    fetch("/api/attendance", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setStats(d));

    fetch("/api/bets", { method: "PUT", headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.bets) return;
        const total = d.bets.length;
        const wins = d.bets.filter((b: { settled: boolean; won?: boolean }) => b.settled && b.won).length;
        const pending = d.bets.filter((b: { settled: boolean }) => !b.settled).length;
        setBetStats({ total, wins, pending });
      });
  }, [user]);

  const handlePhotoClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 200; canvas.height = 200;
        const ctx = canvas.getContext("2d")!;
        const size = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 200, 200);
        const b64 = canvas.toDataURL("image/jpeg", 0.82);
        try { localStorage.setItem("rf_avatar", b64); } catch {}
        setAvatarPhoto(b64);
        window.dispatchEvent(new Event("rf_avatar_changed"));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  if (!user) return null;

  const winRate = betStats.total > 0 ? Math.round((betStats.wins / betStats.total) * 100) : null;
  const joined = (user as { createdAt?: string }).createdAt
    ? new Date((user as { createdAt?: string }).createdAt!).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : null;

  const TABS = [
    { id: "profile",  label: "Profile" },
    { id: "posts",    label: "My Posts" },
    { id: "comments", label: "My Comments" },
  ] as const;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "white", borderRadius: 20, width: "100%", maxWidth: 440,
        boxShadow: "0 24px 80px rgba(0,0,0,0.18)", overflow: "hidden",
        maxHeight: "90vh", display: "flex", flexDirection: "column",
      }}>
        {/* Dark header */}
        <div style={{ background: "#18181b", padding: "28px 28px 20px", position: "relative", flexShrink: 0 }}>
          <button onClick={onClose} style={{
            position: "absolute", top: 16, right: 16,
            background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8,
            cursor: "pointer", color: "rgba(255,255,255,0.7)",
            width: 30, height: 30, display: "grid", placeItems: "center",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Avatar — clickable to change photo */}
            <div
              onClick={handlePhotoClick}
              title="Change photo"
              style={{
                width: 56, height: 56, borderRadius: 14, flexShrink: 0,
                overflow: "hidden", cursor: "pointer", position: "relative",
                border: "2px solid rgba(255,255,255,0.15)",
              }}
            >
              {avatarPhoto ? (
                <img src={avatarPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{
                  width: "100%", height: "100%",
                  background: "rgba(255,255,255,0.15)", display: "grid", placeItems: "center",
                  fontFamily: "var(--font-sans), sans-serif",
                  fontSize: 22, fontWeight: 800, color: "white",
                }}>
                  {user.username[0].toUpperCase()}
                </div>
              )}
              {/* Hover overlay */}
              <div style={{
                position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: 0,
                transition: "opacity 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "0")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />

            <div>
              <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 18, fontWeight: 700, color: "white" }}>
                {user.username}
              </div>
              <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>
                {user.email}
              </div>
              {joined && (
                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                  Joined {joined}
                </div>
              )}
            </div>
          </div>

          {/* RFC balance */}
          <div style={{
            marginTop: 18, background: "rgba(255,255,255,0.08)", borderRadius: 10,
            padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>RFC Balance</span>
            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 18, fontWeight: 700, color: "#4ade80" }}>
              {user.rfcBalance.toLocaleString()} RFC
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #f0f0f0", flexShrink: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, background: "none", border: "none", cursor: "pointer",
              padding: "11px 0", fontFamily: "var(--font-sans), sans-serif",
              fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? "#18181b" : "#a1a1aa", position: "relative",
            }}>
              {t.label}
              {tab === t.id && <span style={{ position: "absolute", bottom: -1, left: "10%", right: "10%", height: 2, background: "#18181b", borderRadius: "2px 2px 0 0" }} />}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {tab === "profile" && (
            <div style={{ padding: "20px 28px 28px" }}>
              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                {[
                  { label: "Attendance", value: stats ? `${stats.attendanceDates.length}d` : "–" },
                  { label: "Streak",     value: stats ? `${stats.streak}d` : "–" },
                  { label: "Win Rate",   value: winRate !== null ? `${winRate}%` : "–" },
                ].map(s => (
                  <StatCard key={s.label} label={s.label} value={s.value} />
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Total Bets", value: String(betStats.total) },
                  { label: "Wins",       value: String(betStats.wins) },
                ].map(s => (
                  <StatCard key={s.label} label={s.label} value={s.value} />
                ))}
              </div>
              <div style={{ marginTop: 16, padding: "9px 12px", background: "#fafafa", borderRadius: 8, border: "1px solid #f0f0f0" }}>
                <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 11, color: "#a1a1aa" }}>
                  Click your profile photo above to change it
                </div>
              </div>
            </div>
          )}

          {tab === "posts" && (
            <EmptyState
              icon={
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d4d4d8" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              }
              title="No posts yet"
              desc="Posts you write will appear here. Community posts are coming soon."
            />
          )}

          {tab === "comments" && (
            <EmptyState
              icon={
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d4d4d8" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              }
              title="No comments yet"
              desc="Comments you leave on posts will show up here."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: "#fafafa", borderRadius: 10, border: "1px solid #f0f0f0",
      padding: "14px 0", textAlign: "center",
    }}>
      <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 18, fontWeight: 700, color: "#18181b" }}>
        {value}
      </div>
      <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 10, color: "#a1a1aa", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div style={{ padding: "52px 28px", textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>{icon}</div>
      <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 14, fontWeight: 600, color: "#18181b", marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}
