"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import AuthModal from "@/components/AuthModal";
import AttendanceCalendar from "@/components/AttendanceCalendar";
import LeaderboardModal from "@/components/LeaderboardModal";
import MyBetsModal from "@/components/MyBetsModal";
import VisionModal from "@/components/VisionModal";
import RfcShopModal from "@/components/RfcShopModal";
import MyPageModal from "@/components/MyPageModal";
import SettingsModal from "@/components/SettingsModal";
import DisplayModal from "@/components/DisplayModal";

const PB: React.CSSProperties = {
  width: 104, padding: 0, textAlign: "center",
  background: "none", border: "none",
  borderRight: "1px solid rgba(0,0,0,0.06)",
  cursor: "pointer",
  fontFamily: "var(--font-sans), sans-serif",
  fontSize: 14, fontWeight: 500, color: "#52525b",
  whiteSpace: "nowrap", letterSpacing: "-0.01em",
  height: "100%", flexShrink: 0,
};

const PILL: React.CSSProperties = {
  display: "flex", alignItems: "stretch", height: 48,
  background: "rgba(255,255,255,0.72)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(0,0,0,0.09)",
  borderRadius: 12, overflow: "hidden",
  boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
};

function RfMark() {
  return (
    <svg width="42" height="42" viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="9" fill="#18181b"/>
      <rect x="8"   y="20" width="5" height="9"  rx="1.5" fill="white" opacity="0.45"/>
      <rect x="15.5" y="14" width="5" height="15" rx="1.5" fill="white" opacity="0.7"/>
      <rect x="23"  y="8"  width="5" height="21" rx="1.5" fill="white"/>
    </svg>
  );
}

export default function TopNav() {
  const { user, loading, logout, updateRfcBalance } = useAuth();
  const [modal, setModal]               = useState<"login" | "register" | null>(null);
  const [dropdown, setDropdown]         = useState(false);
  const [dropdownPos, setDropdownPos]   = useState<{ top: number; right: number } | null>(null);
  const [avatarPhoto, setAvatarPhoto]   = useState<string | null>(null);
  const [showAttendance, setShowAttendance] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showMyBets, setShowMyBets]     = useState(false);
  const [showVision, setShowVision]     = useState(false);
  const [showShop, setShowShop]         = useState(false);
  const [showMyPage, setShowMyPage]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDisplay, setShowDisplay]   = useState(false);
  const profileRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const load = () => { try { setAvatarPhoto(localStorage.getItem("rf_avatar")); } catch {} };
    load();
    window.addEventListener("rf_avatar_changed", load);
    return () => window.removeEventListener("rf_avatar_changed", load);
  }, []);

  const openDropdown = () => {
    const rect = profileRef.current?.getBoundingClientRect();
    if (rect) {
      setDropdownPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setDropdown(true);
  };

  const closeDropdown = () => { setDropdown(false); setDropdownPos(null); };

  return (
    <>
      {/* ── Nav bar ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 200,
        background: "var(--nav-bg)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        borderBottom: "1px solid var(--nav-border)",
        boxShadow: "0 1px 0 var(--nav-shadow)",
      }}>
        <nav style={{
          padding: "0 28px", height: 80,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          maxWidth: 1080, margin: "0 auto", gap: 12,
        }} className="nav-bar">
          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", flexShrink: 0 }}>
            <RfMark />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1, gap: 4 }}>
              <span style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 23, fontWeight: 800, letterSpacing: "-0.04em", color: "white" }}>
                Research For
              </span>
              <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, color: "rgba(255,255,255,0.65)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                Stock · Crypto
              </span>
            </div>
          </Link>

          {/* Nav pill */}
          {loading ? (
            <div style={{ width: 280, height: 42, background: "rgba(0,0,0,0.05)", borderRadius: 12 }} />
          ) : (
            <div style={PILL} className="nav-pill">
              <button style={PB} onClick={() => setShowVision(true)}>Vision</button>
              <button style={PB} onClick={() => setShowShop(true)}>RFC Shop</button>

              {user ? (
                <>
                  <button style={PB} onClick={() => setShowMyBets(true)}>My Bets</button>
                  <button style={PB} onClick={() => setShowLeaderboard(true)}>Leaderboard</button>
                  <button style={PB} onClick={() => setShowAttendance(true)}>Attendance</button>

                  <div style={{ width: 1, background: "rgba(0,0,0,0.06)", margin: "8px 0", flexShrink: 0 }} />

                  {/* Profile button */}
                  <button
                    ref={profileRef}
                    onClick={dropdown ? closeDropdown : openDropdown}
                    style={{
                      display: "flex", alignItems: "center", gap: 9,
                      padding: "0 14px 0 12px",
                      background: "none", border: "none", cursor: "pointer", height: "100%",
                    }}
                  >
                    {avatarPhoto ? (
                      <img src={avatarPhoto} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{
                        width: 30, height: 30, borderRadius: 8,
                        background: "#18181b", display: "grid", placeItems: "center",
                        fontFamily: "var(--font-sans), sans-serif",
                        fontSize: 13, fontWeight: 700, color: "white", flexShrink: 0,
                      }}>
                        {user.username[0].toUpperCase()}
                      </div>
                    )}
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 14, fontWeight: 600, color: "#18181b", lineHeight: 1.3 }}>
                        {user.username}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "#16a34a", fontWeight: 600, lineHeight: 1.3 }}>
                        {user.rfcBalance.toLocaleString()} RFC
                      </div>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c4c4c7" strokeWidth="2.5">
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <button style={PB} onClick={() => setModal("login")}>Sign in</button>
                  <button
                    onClick={() => setModal("register")}
                    style={{ ...PB, borderRight: "none", background: "#18181b", color: "white", fontWeight: 600 }}
                  >Sign up</button>
                </>
              )}
            </div>
          )}
        </nav>
      </div>

      {/* ── Dropdown (outside nav stacking context, fixed position) ── */}
      {dropdown && user && dropdownPos && (
        <div style={{
          position: "fixed",
          top: dropdownPos.top,
          right: dropdownPos.right,
          background: "white",
          border: "1px solid #e4e4e7",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          minWidth: 210,
          zIndex: 1000,
        }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f4f4f5" }}>
            <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 11, color: "#a1a1aa", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Signed in as
            </div>
            <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 13, fontWeight: 500, color: "#18181b" }}>
              {user.email}
            </div>
          </div>

          <div style={{ padding: "4px 0" }}>
            {[
              {
                label: "My Page",
                icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
                action: () => { closeDropdown(); setShowMyPage(true); },
              },
              {
                label: "Settings",
                icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
                action: () => { closeDropdown(); setShowSettings(true); },
              },
              {
                label: "Display",
                icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
                action: () => { closeDropdown(); setShowDisplay(true); },
              },
            ].map(item => (
              <button key={item.label} onClick={item.action} style={{
                width: "100%", background: "none", border: "none",
                padding: "10px 16px", textAlign: "left", cursor: "pointer",
                fontFamily: "var(--font-sans), sans-serif",
                fontSize: 13, fontWeight: 500, color: "#18181b",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>

          <div style={{ borderTop: "1px solid #f4f4f5" }}>
            <button
              onClick={() => { closeDropdown(); logout(); }}
              style={{
                width: "100%", background: "none", border: "none",
                padding: "11px 16px", textAlign: "left", cursor: "pointer",
                fontFamily: "var(--font-sans), sans-serif",
                fontSize: 13, fontWeight: 500, color: "#dc2626",
                display: "flex", alignItems: "center", gap: 10,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Backdrop — closes dropdown, zIndex below dropdown (999 < 1000) */}
      {dropdown && (
        <div onClick={closeDropdown} style={{ position: "fixed", inset: 0, zIndex: 999 }} />
      )}

      {/* ── Modals ── */}
      {modal && <AuthModal initialTab={modal} onClose={() => setModal(null)} />}
      {showAttendance && user && (
        <AttendanceCalendar
          token={typeof window !== "undefined" ? localStorage.getItem("rf_token") ?? "" : ""}
          onClose={() => setShowAttendance(false)}
          onRfcUpdate={updateRfcBalance}
        />
      )}
      {showLeaderboard && <LeaderboardModal onClose={() => setShowLeaderboard(false)} />}
      {showMyBets    && user && <MyBetsModal    onClose={() => setShowMyBets(false)} />}
      {showVision    && <VisionModal            onClose={() => setShowVision(false)} />}
      {showShop      && <RfcShopModal           onClose={() => setShowShop(false)} />}
      {showMyPage    && user && <MyPageModal    onClose={() => setShowMyPage(false)} />}
      {showSettings  && user && <SettingsModal  onClose={() => setShowSettings(false)} />}
      {showDisplay   && <DisplayModal           onClose={() => setShowDisplay(false)} />}
    </>
  );
}
