"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  initialTab?: "login" | "register";
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px",
  border: "1px solid #e4e4e7", borderRadius: 10,
  fontFamily: "var(--font-sans), sans-serif", fontSize: 14,
  color: "#18181b", outline: "none", background: "#fafafa",
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: "block", fontFamily: "var(--font-sans), sans-serif",
      fontSize: 11, fontWeight: 600, color: "#52525b",
      marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase",
    }}>{children}</label>
  );
}

export default function AuthModal({ initialTab = "login", onClose }: Props) {
  const [tab, setTab] = useState<"login" | "register">(initialTab);
  const [step, setStep] = useState<"form" | "verify">("form");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { login, register } = useAuth();

  useEffect(() => {
    setError(""); setEmail(""); setPassword("");
    setUsername(""); setConfirm(""); setCode(""); setStep("form");
  }, [tab]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const submitForm = async () => {
    setError(""); setLoading(true);
    try {
      if (tab === "login") {
        await login(email, password);
        setDone(true);
        setTimeout(onClose, 900);
      } else {
        if (password !== confirm) { setError("Passwords do not match."); setLoading(false); return; }
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, username, password }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error); setLoading(false); return; }
        setStep("verify");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "An error occurred.");
    }
    setLoading(false);
  };

  const submitVerify = async () => {
    setError(""); setLoading(true);
    try {
      await register(email, username, password, code);
      setDone(true);
      setTimeout(onClose, 900);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    }
    setLoading(false);
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "white", borderRadius: 20, width: "100%", maxWidth: 420,
        boxShadow: "0 24px 80px rgba(0,0,0,0.18)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "28px 32px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
                <rect width="36" height="36" rx="9" fill="#18181b"/>
                <rect x="8"   y="20" width="5" height="9"  rx="1.5" fill="white" opacity="0.5"/>
                <rect x="15.5" y="14" width="5" height="15" rx="1.5" fill="white" opacity="0.75"/>
                <rect x="23"  y="8"  width="5" height="21" rx="1.5" fill="white"/>
              </svg>
              <span style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 16, fontWeight: 700, color: "#18181b", letterSpacing: "-0.02em" }}>
                Research For
              </span>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#a1a1aa" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {step === "form" && (
            <div style={{ display: "flex", borderBottom: "1px solid #f0f0f0", marginBottom: 28 }}>
              {(["login", "register"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1, background: "none", border: "none", cursor: "pointer",
                  padding: "10px 0", fontFamily: "var(--font-sans), sans-serif",
                  fontSize: 14, fontWeight: tab === t ? 600 : 400,
                  color: tab === t ? "#18181b" : "#a1a1aa", position: "relative",
                }}>
                  {t === "login" ? "Sign in" : "Sign up"}
                  {tab === t && <span style={{ position: "absolute", bottom: -1, left: "15%", right: "15%", height: 2, background: "#18181b", borderRadius: "2px 2px 0 0" }} />}
                </button>
              ))}
            </div>
          )}

          {step === "verify" && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#18181b", marginBottom: 6 }}>Email Verification</div>
              <div style={{ fontSize: 13, color: "#71717a" }}>
                Enter the 6-digit code sent to <strong>{email}</strong>.
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        {done ? (
          <div style={{ padding: "8px 32px 36px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 16, fontWeight: 600, color: "#16a34a" }}>
              {tab === "login" ? "Signed in!" : "Welcome! 300 RFC has been credited to your account."}
            </div>
          </div>
        ) : step === "verify" ? (
          <div style={{ padding: "0 32px 32px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <Label>6-digit code</Label>
              <input
                type="text" value={code} maxLength={6}
                onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={e => e.key === "Enter" && submitVerify()}
                placeholder="000000"
                style={{ ...inputStyle, textAlign: "center", fontSize: 24, fontFamily: "var(--font-mono), monospace", letterSpacing: "0.3em" }}
                onFocus={e => (e.target.style.borderColor = "#18181b")}
                onBlur={e => (e.target.style.borderColor = "#e4e4e7")}
              />
            </div>
            {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>{error}</div>}
            <button onClick={submitVerify} disabled={loading || code.length !== 6} style={{
              marginTop: 4, background: (loading || code.length !== 6) ? "#d4d4d8" : "#18181b",
              color: "white", border: "none", padding: "13px 0", borderRadius: 10,
              fontFamily: "var(--font-sans), sans-serif", fontSize: 14, fontWeight: 600,
              cursor: (loading || code.length !== 6) ? "not-allowed" : "pointer",
            }}>
              {loading ? "Verifying…" : "Verify"}
            </button>
            <button onClick={() => setStep("form")} style={{ background: "none", border: "none", color: "#a1a1aa", fontSize: 13, cursor: "pointer" }}>
              ← Back
            </button>
          </div>
        ) : (
          <div style={{ padding: "0 32px 32px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <Label>Email</Label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && submitForm()} placeholder="you@example.com"
                style={inputStyle} onFocus={e => (e.target.style.borderColor = "#18181b")} onBlur={e => (e.target.style.borderColor = "#e4e4e7")} />
            </div>
            {tab === "register" && (
              <div>
                <Label>Nickname</Label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && submitForm()} placeholder="2–20 characters"
                  style={inputStyle} onFocus={e => (e.target.style.borderColor = "#18181b")} onBlur={e => (e.target.style.borderColor = "#e4e4e7")} />
              </div>
            )}
            <div>
              <Label>Password</Label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submitForm()} placeholder="At least 6 characters"
                style={inputStyle} onFocus={e => (e.target.style.borderColor = "#18181b")} onBlur={e => (e.target.style.borderColor = "#e4e4e7")} />
            </div>
            {tab === "register" && (
              <div>
                <Label>Confirm Password</Label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && submitForm()} placeholder="Re-enter password"
                  style={inputStyle} onFocus={e => (e.target.style.borderColor = "#18181b")} onBlur={e => (e.target.style.borderColor = "#e4e4e7")} />
              </div>
            )}
            {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>{error}</div>}
            <button onClick={submitForm} disabled={loading} style={{
              marginTop: 4, background: loading ? "#d4d4d8" : "#18181b",
              color: "white", border: "none", padding: "13px 0", borderRadius: 10,
              fontFamily: "var(--font-sans), sans-serif", fontSize: 14, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}>
              {loading ? "Processing…" : tab === "login" ? "Sign in" : "Next →"}
            </button>
            {tab === "register" && (
              <p style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 12, color: "#a1a1aa", textAlign: "center", lineHeight: 1.6 }}>
                You will receive <strong>300 RFC</strong> tokens upon joining.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
