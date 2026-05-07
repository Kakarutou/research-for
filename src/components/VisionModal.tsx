"use client";
import { useEffect } from "react";

interface Props { onClose: () => void }

export default function VisionModal({ onClose }: Props) {
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
        background: "white", borderRadius: 20, width: "100%", maxWidth: 520,
        boxShadow: "0 24px 80px rgba(0,0,0,0.18)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          background: "#18181b", padding: "32px 32px 28px",
          position: "relative",
        }}>
          <button onClick={onClose} style={{
            position: "absolute", top: 20, right: 20,
            background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8,
            cursor: "pointer", color: "rgba(255,255,255,0.7)",
            width: 32, height: 32, display: "grid", placeItems: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="9" fill="rgba(255,255,255,0.12)"/>
              <rect x="8"   y="20" width="5" height="9"  rx="1.5" fill="white" opacity="0.45"/>
              <rect x="15.5" y="14" width="5" height="15" rx="1.5" fill="white" opacity="0.7"/>
              <rect x="23"  y="8"  width="5" height="21" rx="1.5" fill="white"/>
            </svg>
            <span style={{
              fontFamily: "var(--font-sans), sans-serif",
              fontSize: 20, fontWeight: 800, color: "white", letterSpacing: "-0.04em",
            }}>Research For</span>
          </div>

          <p style={{
            fontFamily: "var(--font-sans), sans-serif",
            fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, margin: 0,
          }}>
            A platform where anyone can understand markets, participate, and earn.
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: "28px 32px 32px" }}>
          <Section title="Our Vision">
            Financial market data has long been the exclusive domain of professionals and institutional investors.
            Research For aims to deliver stock and crypto data clearly to everyone, and empower individual investors
            to analyze markets on their own through prediction games and community.
          </Section>

          <Section title="What We Build">
            We combine real-time market data, community-driven long/short predictions, and the RFC token economy
            to design a &ldquo;learn and earn&rdquo; experience. Accurate predictions are rewarded,
            and consistent participation opens up more opportunities.
          </Section>

          <Section title="RFC Token Economy">
            RFC (Research For Coin) is the platform&apos;s participation reward token.
            Earn it through daily check-ins, correct predictions, and community activity.
            It will be used for premium features, RFC Shop exchanges, and real-world or NFT rewards.
          </Section>

          <div style={{
            marginTop: 24, padding: "14px 16px",
            background: "#fafafa", borderRadius: 12,
            border: "1px solid #f0f0f0",
          }}>
            <div style={{ display: "flex", gap: 24 }}>
              {[
                { label: "Markets", value: "4" },
                { label: "Daily active", value: "10.3K" },
                { label: "RFC distributed", value: "2.1M" },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 18, fontWeight: 700, color: "#18181b" }}>
                    {s.value}
                  </div>
                  <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 11, color: "#a1a1aa", marginTop: 2 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontFamily: "var(--font-sans), sans-serif",
        fontSize: 11, fontWeight: 700, color: "#18181b",
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
      }}>{title}</div>
      <p style={{
        fontFamily: "var(--font-sans), sans-serif",
        fontSize: 13, color: "#52525b", lineHeight: 1.7, margin: 0,
      }}>{children}</p>
    </div>
  );
}
