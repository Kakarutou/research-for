"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

interface Props { onClose: () => void }

const INPUT: React.CSSProperties = {
  width: "100%", padding: "10px 12px",
  border: "1px solid #e4e4e7", borderRadius: 9,
  fontFamily: "var(--font-sans), sans-serif", fontSize: 13,
  color: "#18181b", outline: "none", background: "#fafafa",
  boxSizing: "border-box",
};

const LABEL: React.CSSProperties = {
  display: "block", fontFamily: "var(--font-sans), sans-serif",
  fontSize: 11, fontWeight: 600, color: "#52525b",
  marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase",
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 26, borderRadius: 13,
        background: checked ? "#18181b" : "#e4e4e7",
        position: "relative", cursor: "pointer", flexShrink: 0,
        transition: "background 0.18s",
      }}
    >
      <div style={{
        position: "absolute", top: 3, left: checked ? 21 : 3,
        width: 20, height: 20, borderRadius: 10, background: "white",
        boxShadow: "0 1px 4px rgba(0,0,0,0.22)",
        transition: "left 0.18s",
      }} />
    </div>
  );
}

function PrefRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 0", borderBottom: "1px solid #f4f4f5" }}>
      <div>
        <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 13, fontWeight: 500, color: "#18181b" }}>{label}</div>
        <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 11, color: "#a1a1aa", marginTop: 2 }}>{desc}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

const MARKETS = ["NASDAQ", "KOSPI", "N225", "BTC"] as const;

function readPref(key: string, fallback: string) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
function readBool(key: string) { try { return localStorage.getItem(key) !== "0"; } catch { return true; } }

export default function SettingsModal({ onClose }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"account" | "password" | "preferences">("account");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteErr, setDeleteErr] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Account tab
  const [username, setUsername] = useState(user?.username ?? "");
  const [accountMsg, setAccountMsg] = useState("");
  const [accountErr, setAccountErr] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);

  // Password tab
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // Preferences (localStorage only)
  const [notifySettle, setNotifySettle] = useState(() => readBool("rf_notify_settle"));
  const [notifyWin, setNotifyWin]       = useState(() => readBool("rf_notify_win"));
  const [notifyStreak, setNotifyStreak] = useState(() => readBool("rf_notify_streak"));
  const [defaultMarket, setDefaultMarket] = useState(() => readPref("rf_default_market", "NASDAQ"));

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const { logout } = useAuth();

  const deleteAccount = async () => {
    setDeleteErr(""); setDeleteLoading(true);
    try {
      const token = localStorage.getItem("rf_token") ?? "";
      const res = await fetch("/api/auth/delete", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePw }),
      });
      const data = await res.json();
      if (!res.ok) { setDeleteErr(data.error); setDeleteLoading(false); return; }
      logout();
      onClose();
    } catch { setDeleteErr("An error occurred."); }
    finally { setDeleteLoading(false); }
  };

  const setPref = (key: string, setter: (v: boolean) => void) => (v: boolean) => {
    setter(v);
    try { localStorage.setItem(key, v ? "1" : "0"); } catch {}
  };

  const saveAccount = async () => {
    setAccountErr(""); setAccountMsg(""); setAccountLoading(true);
    try {
      const token = localStorage.getItem("rf_token") ?? "";
      const res = await fetch("/api/auth/update", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) { setAccountErr(data.error); return; }
      localStorage.setItem("rf_token", data.token);
      setAccountMsg("Nickname updated. Please refresh to see changes.");
    } catch { setAccountErr("An error occurred."); }
    finally { setAccountLoading(false); }
  };

  const savePassword = async () => {
    setPwErr(""); setPwMsg(""); setPwLoading(true);
    if (newPw !== confirmPw) { setPwErr("Passwords do not match."); setPwLoading(false); return; }
    try {
      const token = localStorage.getItem("rf_token") ?? "";
      const res = await fetch("/api/auth/update", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setPwErr(data.error); return; }
      setPwMsg("Password changed successfully.");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch { setPwErr("An error occurred."); }
    finally { setPwLoading(false); }
  };

  if (!user) return null;

  const TABS = [
    { id: "account", label: "Account" },
    { id: "password", label: "Password" },
    { id: "preferences", label: "Preferences" },
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
      }}>
        {/* Header */}
        <div style={{ padding: "24px 28px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 16, fontWeight: 700, color: "#18181b" }}>
              Settings
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#a1a1aa" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #f0f0f0", marginBottom: 24 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, background: "none", border: "none", cursor: "pointer",
                padding: "8px 0", fontFamily: "var(--font-sans), sans-serif",
                fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                color: tab === t.id ? "#18181b" : "#a1a1aa", position: "relative",
              }}>
                {t.label}
                {tab === t.id && <span style={{ position: "absolute", bottom: -1, left: "10%", right: "10%", height: 2, background: "#18181b", borderRadius: "2px 2px 0 0" }} />}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: "0 28px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
          {tab === "account" && (
            <>
              <div>
                <label style={LABEL}>Email</label>
                <input style={{ ...INPUT, color: "#a1a1aa", cursor: "not-allowed" }} value={user.email} readOnly />
              </div>
              <div>
                <label style={LABEL}>Nickname</label>
                <input
                  style={INPUT} value={username}
                  onChange={e => setUsername(e.target.value)}
                  onFocus={e => (e.target.style.borderColor = "#18181b")}
                  onBlur={e => (e.target.style.borderColor = "#e4e4e7")}
                />
              </div>
              {accountErr && <Msg text={accountErr} isErr />}
              {accountMsg && <Msg text={accountMsg} />}
              <button onClick={saveAccount} disabled={accountLoading} style={submitBtn(accountLoading)}>
                {accountLoading ? "Saving…" : "Save Changes"}
              </button>

              {/* Danger Zone */}
              <div style={{ marginTop: 12, padding: "16px", background: "#fff5f5", borderRadius: 12, border: "1px solid #fecaca" }}>
                <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Danger Zone
                </div>
                {!deleteConfirm ? (
                  <button onClick={() => setDeleteConfirm(true)} style={{
                    background: "none", border: "1px solid #fecaca", borderRadius: 8,
                    padding: "8px 14px", cursor: "pointer", color: "#dc2626",
                    fontFamily: "var(--font-sans), sans-serif", fontSize: 12, fontWeight: 500,
                  }}>
                    Delete Account
                  </button>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 12, color: "#52525b" }}>
                      This action is permanent and cannot be undone. Enter your password to confirm.
                    </div>
                    <input
                      type="password" placeholder="Your password" value={deletePw}
                      onChange={e => setDeletePw(e.target.value)}
                      style={{ ...INPUT, borderColor: "#fecaca" }}
                      onFocus={e => (e.target.style.borderColor = "#dc2626")}
                      onBlur={e => (e.target.style.borderColor = "#fecaca")}
                    />
                    {deleteErr && <Msg text={deleteErr} isErr />}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => { setDeleteConfirm(false); setDeletePw(""); setDeleteErr(""); }} style={{
                        flex: 1, background: "white", border: "1px solid #e4e4e7",
                        borderRadius: 8, padding: "9px 0", cursor: "pointer",
                        fontFamily: "var(--font-sans), sans-serif", fontSize: 12, color: "#52525b",
                      }}>Cancel</button>
                      <button onClick={deleteAccount} disabled={deleteLoading || !deletePw} style={{
                        flex: 1, background: (deleteLoading || !deletePw) ? "#fecaca" : "#dc2626",
                        border: "none", borderRadius: 8, padding: "9px 0", cursor: (deleteLoading || !deletePw) ? "not-allowed" : "pointer",
                        fontFamily: "var(--font-sans), sans-serif", fontSize: 12, fontWeight: 600, color: "white",
                      }}>
                        {deleteLoading ? "Deleting…" : "Delete Forever"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "password" && (
            <>
              {[
                { label: "Current Password", val: currentPw, set: setCurrentPw },
                { label: "New Password",     val: newPw,     set: setNewPw },
                { label: "Confirm Password", val: confirmPw, set: setConfirmPw },
              ].map(f => (
                <div key={f.label}>
                  <label style={LABEL}>{f.label}</label>
                  <input
                    type="password" style={INPUT} value={f.val}
                    onChange={e => f.set(e.target.value)}
                    onFocus={e => (e.target.style.borderColor = "#18181b")}
                    onBlur={e => (e.target.style.borderColor = "#e4e4e7")}
                  />
                </div>
              ))}
              {pwErr && <Msg text={pwErr} isErr />}
              {pwMsg && <Msg text={pwMsg} />}
              <button onClick={savePassword} disabled={pwLoading} style={submitBtn(pwLoading)}>
                {pwLoading ? "Saving…" : "Change Password"}
              </button>
            </>
          )}

          {tab === "preferences" && (
            <div>
              <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 11, fontWeight: 600, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                Notifications
              </div>
              <PrefRow
                label="Bet settled"
                desc="Alert when your daily prediction resolves"
                checked={notifySettle}
                onChange={setPref("rf_notify_settle", setNotifySettle)}
              />
              <PrefRow
                label="Win alert"
                desc="Extra alert when you win RFC tokens"
                checked={notifyWin}
                onChange={setPref("rf_notify_win", setNotifyWin)}
              />
              <PrefRow
                label="Streak reminder"
                desc="Daily nudge to keep your attendance streak"
                checked={notifyStreak}
                onChange={setPref("rf_notify_streak", setNotifyStreak)}
              />

              <div style={{ marginTop: 20 }}>
                <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 11, fontWeight: 600, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  App Defaults
                </div>
                <label style={LABEL}>Default Market</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {MARKETS.map(m => {
                    const active = defaultMarket === m;
                    return (
                      <button key={m} onClick={() => { setDefaultMarket(m); try { localStorage.setItem("rf_default_market", m); } catch {} }} style={{
                        padding: "7px 14px", borderRadius: 8, cursor: "pointer",
                        border: active ? "1.5px solid #18181b" : "1px solid #e4e4e7",
                        background: active ? "#18181b" : "white",
                        fontFamily: "var(--font-sans), sans-serif", fontSize: 12,
                        fontWeight: active ? 600 : 400,
                        color: active ? "white" : "#52525b",
                      }}>{m}</button>
                    );
                  })}
                </div>
                <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 11, color: "#a1a1aa", marginTop: 8 }}>
                  Shown first on the predictions section
                </div>
              </div>

              <div style={{ marginTop: 20, padding: "10px 14px", background: "#fafafa", borderRadius: 10, border: "1px solid #f0f0f0" }}>
                <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 11, color: "#a1a1aa" }}>
                  Notification delivery requires browser permission. In-app indicators are always active regardless of these settings.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Msg({ text, isErr }: { text: string; isErr?: boolean }) {
  return (
    <div style={{
      background: isErr ? "#fef2f2" : "#f0fdf4",
      border: `1px solid ${isErr ? "#fecaca" : "#bbf7d0"}`,
      borderRadius: 8, padding: "9px 12px",
      fontFamily: "var(--font-sans), sans-serif", fontSize: 12,
      color: isErr ? "#dc2626" : "#15803d",
    }}>{text}</div>
  );
}

function submitBtn(loading: boolean): React.CSSProperties {
  return {
    marginTop: 4, background: loading ? "#d4d4d8" : "#18181b",
    color: "white", border: "none", padding: "12px 0", borderRadius: 10,
    fontFamily: "var(--font-sans), sans-serif", fontSize: 13, fontWeight: 600,
    cursor: loading ? "not-allowed" : "pointer", width: "100%",
  };
}
