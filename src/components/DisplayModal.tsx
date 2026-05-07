"use client";
import { useEffect } from "react";

interface Props { onClose: () => void }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontFamily: "var(--font-sans), sans-serif", fontSize: 11, fontWeight: 600,
        color: "#52525b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12,
      }}>{title}</div>
      {children}
    </div>
  );
}

export default function DisplayModal({ onClose }: Props) {
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
        background: "white", borderRadius: 20, width: "100%", maxWidth: 380,
        boxShadow: "0 24px 80px rgba(0,0,0,0.18)", overflow: "hidden",
      }}>
        <div style={{ padding: "24px 28px 28px" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 16, fontWeight: 700, color: "#18181b" }}>
              Display
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#a1a1aa" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Theme */}
          <Section title="Theme">
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { value: "light", label: "Light",            disabled: false },
                { value: "dark",  label: "Dark · Coming Soon", disabled: true },
              ].map(o => (
                <button key={o.value} disabled={o.disabled} style={{
                  flex: 1, padding: "10px 0", borderRadius: 10,
                  cursor: o.disabled ? "not-allowed" : "pointer",
                  border: !o.disabled ? "1.5px solid #18181b" : "1px solid #e4e4e7",
                  background: !o.disabled ? "#18181b" : "#fafafa",
                  fontFamily: "var(--font-sans), sans-serif", fontSize: 13,
                  fontWeight: !o.disabled ? 600 : 400,
                  color: !o.disabled ? "white" : "#d4d4d8",
                }}>{o.label}</button>
              ))}
            </div>
          </Section>

          <p style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 11, color: "#a1a1aa", textAlign: "center", marginTop: 4 }}>
            Changes apply immediately
          </p>
        </div>
      </div>
    </div>
  );
}
